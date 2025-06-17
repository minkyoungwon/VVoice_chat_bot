
# TTS 속도 최적화 개선안 - 캐싱 및 병렬 처리
import asyncio
import hashlib
import pickle
import os
import time
from typing import Dict, Optional, List
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import torch
import torchaudio
from pathlib import Path

class AdvancedTTSCache:
    """고급 TTS 캐싱 시스템"""
    
    def __init__(self, cache_dir: str = "cache/tts", max_cache_size_gb: float = 2.0):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_cache_size = max_cache_size_gb * 1024 * 1024 * 1024  # GB to bytes
        self.memory_cache: Dict[str, np.ndarray] = {}
        self.cache_metadata: Dict[str, Dict] = {}
        self.access_times: Dict[str, float] = {}
        
        # 캐시 통계
        self.cache_hits = 0
        self.cache_misses = 0
        
        self._load_cache_index()
    
    def _get_cache_key(self, text: str, model: str, settings: Dict) -> str:
        """텍스트와 설정으로 캐시 키 생성"""
        # 중요한 TTS 설정만 키에 포함
        key_data = {
            'text': text.strip().lower(),
            'model': model,
            'language': settings.get('language', 'ko'),
            'emotion': settings.get('emotion', []),
            'speaking_rate': settings.get('speaking_rate', 15.0),
            'pitch_std': settings.get('pitch_std', 20.0)
        }
        key_str = str(sorted(key_data.items()))
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def _load_cache_index(self):
        """캐시 인덱스 로드"""
        index_file = self.cache_dir / "cache_index.pkl"
        if index_file.exists():
            try:
                with open(index_file, 'rb') as f:
                    data = pickle.load(f)
                    self.cache_metadata = data.get('metadata', {})
                    self.access_times = data.get('access_times', {})
                print(f"📂 캐시 인덱스 로드됨: {len(self.cache_metadata)}개 항목")
            except Exception as e:
                print(f"⚠️ 캐시 인덱스 로드 실패: {e}")
    
    def _save_cache_index(self):
        """캐시 인덱스 저장"""
        index_file = self.cache_dir / "cache_index.pkl"
        try:
            with open(index_file, 'wb') as f:
                pickle.dump({
                    'metadata': self.cache_metadata,
                    'access_times': self.access_times
                }, f)
        except Exception as e:
            print(f"⚠️ 캐시 인덱스 저장 실패: {e}")
    
    def get_cached_audio(self, text: str, model: str, settings: Dict) -> Optional[np.ndarray]:
        """캐시된 오디오 조회"""
        cache_key = self._get_cache_key(text, model, settings)
        
        # 메모리 캐시 먼저 확인
        if cache_key in self.memory_cache:
            self.access_times[cache_key] = time.time()
            self.cache_hits += 1
            print(f"🎯 메모리 캐시 히트: {text[:30]}...")
            return self.memory_cache[cache_key]
        
        # 디스크 캐시 확인
        cache_file = self.cache_dir / f"{cache_key}.npz"
        if cache_file.exists():
            try:
                data = np.load(cache_file)
                audio_data = data['audio']
                
                # 메모리 캐시에도 저장 (LRU 방식)
                self._add_to_memory_cache(cache_key, audio_data)
                
                self.access_times[cache_key] = time.time()
                self.cache_hits += 1
                print(f"💾 디스크 캐시 히트: {text[:30]}...")
                return audio_data
                
            except Exception as e:
                print(f"⚠️ 캐시 파일 로드 실패: {e}")
                cache_file.unlink(missing_ok=True)
        
        self.cache_misses += 1
        return None
    
    def save_cached_audio(self, text: str, model: str, settings: Dict, audio_data: np.ndarray, sample_rate: int):
        """오디오를 캐시에 저장"""
        cache_key = self._get_cache_key(text, model, settings)
        
        # 메모리 캐시에 추가
        self._add_to_memory_cache(cache_key, audio_data)
        
        # 디스크 캐시에 저장
        cache_file = self.cache_dir / f"{cache_key}.npz"
        try:
            np.savez_compressed(
                cache_file,
                audio=audio_data,
                sample_rate=sample_rate,
                text=text,
                model=model
            )
            
            # 메타데이터 업데이트
            self.cache_metadata[cache_key] = {
                'text': text[:100],  # 첫 100자만 저장
                'model': model,
                'file_size': cache_file.stat().st_size,
                'created_at': time.time(),
                'sample_rate': sample_rate
            }
            self.access_times[cache_key] = time.time()
            
            print(f"💾 캐시 저장됨: {text[:30]}... ({len(audio_data)} samples)")
            
            # 캐시 크기 관리
            self._manage_cache_size()
            
        except Exception as e:
            print(f"⚠️ 캐시 저장 실패: {e}")
    
    def _add_to_memory_cache(self, cache_key: str, audio_data: np.ndarray):
        """메모리 캐시에 추가 (LRU 방식)"""
        # 메모리 캐시 크기 제한 (50MB)
        max_memory_items = 100
        if len(self.memory_cache) >= max_memory_items:
            # 가장 오래된 항목 제거
            oldest_key = min(self.access_times.keys(), key=lambda k: self.access_times.get(k, 0))
            if oldest_key in self.memory_cache:
                del self.memory_cache[oldest_key]
        
        self.memory_cache[cache_key] = audio_data.copy()
    
    def _manage_cache_size(self):
        """캐시 크기 관리"""
        total_size = sum(
            self.cache_dir.joinpath(f"{key}.npz").stat().st_size 
            for key in self.cache_metadata 
            if self.cache_dir.joinpath(f"{key}.npz").exists()
        )
        
        if total_size > self.max_cache_size:
            # 오래된 캐시 파일부터 삭제
            sorted_keys = sorted(
                self.cache_metadata.keys(), 
                key=lambda k: self.access_times.get(k, 0)
            )
            
            for key in sorted_keys:
                cache_file = self.cache_dir / f"{key}.npz"
                if cache_file.exists():
                    file_size = cache_file.stat().st_size
                    cache_file.unlink()
                    total_size -= file_size
                    
                    # 메타데이터에서도 제거
                    del self.cache_metadata[key]
                    if key in self.access_times:
                        del self.access_times[key]
                    if key in self.memory_cache:
                        del self.memory_cache[key]
                    
                    if total_size <= self.max_cache_size * 0.8:  # 80%까지 정리
                        break
            
            self._save_cache_index()
            print(f"🧹 캐시 정리 완료. 현재 크기: {total_size / 1024 / 1024:.1f}MB")
    
    def get_cache_stats(self) -> Dict:
        """캐시 통계 반환"""
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'hit_rate': f"{hit_rate:.1f}%",
            'memory_cache_size': len(self.memory_cache),
            'disk_cache_size': len(self.cache_metadata),
            'total_cache_size_mb': sum(
                meta.get('file_size', 0) for meta in self.cache_metadata.values()
            ) / 1024 / 1024
        }


class ParallelTTSProcessor:
    """병렬 TTS 처리 시스템"""
    
    def __init__(self, max_workers: int = 2):
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.text_splitter = SmartTextSplitter()
    
    async def process_long_text_parallel(self, text: str, tts_function, **kwargs) -> List[np.ndarray]:
        """긴 텍스트를 병렬로 처리"""
        
        # 텍스트 분할
        text_chunks = self.text_splitter.split_text(text)
        
        if len(text_chunks) <= 1:
            # 분할할 필요 없는 경우
            result = await tts_function(text, **kwargs)
            return [result] if result is not None else []
        
        print(f"🔄 텍스트를 {len(text_chunks)}개 청크로 분할하여 병렬 처리")
        
        # 병렬 처리
        loop = asyncio.get_event_loop()
        tasks = []
        
        for i, chunk in enumerate(text_chunks):
            task = loop.run_in_executor(
                self.executor,
                lambda c=chunk, i=i: asyncio.run(tts_function(c, chunk_id=i, **kwargs))
            )
            tasks.append(task)
        
        # 모든 청크 완료 대기
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 결과 정리 (예외 제거)
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"⚠️ 청크 {i} 처리 실패: {result}")
            elif result is not None:
                valid_results.append(result)
        
        return valid_results
    
    def combine_audio_chunks(self, audio_chunks: List[np.ndarray], sample_rate: int) -> np.ndarray:
        """오디오 청크들을 하나로 결합"""
        if not audio_chunks:
            return np.array([])
        
        if len(audio_chunks) == 1:
            return audio_chunks[0]
        
        # 청크 사이에 짧은 무음 추가 (자연스러운 연결)
        silence_duration = 0.1  # 100ms
        silence_samples = int(sample_rate * silence_duration)
        silence = np.zeros(silence_samples, dtype=audio_chunks[0].dtype)
        
        combined = []
        for i, chunk in enumerate(audio_chunks):
            combined.append(chunk)
            if i < len(audio_chunks) - 1:  # 마지막 청크가 아니면 무음 추가
                combined.append(silence)
        
        return np.concatenate(combined)


class SmartTextSplitter:
    """스마트 텍스트 분할기"""
    
    def __init__(self, max_chunk_length: int = 100, min_chunk_length: int = 20):
        self.max_chunk_length = max_chunk_length
        self.min_chunk_length = min_chunk_length
    
    def split_text(self, text: str) -> List[str]:
        """텍스트를 의미 단위로 분할"""
        if len(text) <= self.max_chunk_length:
            return [text]
        
        # 문장 단위로 분할
        sentences = self._split_into_sentences(text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # 현재 청크에 문장을 추가했을 때 길이 확인
            test_chunk = current_chunk + (" " if current_chunk else "") + sentence
            
            if len(test_chunk) <= self.max_chunk_length:
                current_chunk = test_chunk
            else:
                # 현재 청크가 너무 짧지 않으면 저장
                if len(current_chunk) >= self.min_chunk_length:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    # 현재 청크가 너무 짧으면 긴 문장과 함께 저장
                    current_chunk = test_chunk
        
        # 마지막 청크 추가
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """문장 단위로 분할"""
        import re
        
        # 한국어와 영어 문장 구분자
        sentence_endings = r'[.!?।।]+\s+'
        sentences = re.split(sentence_endings, text.strip())
        
        # 빈 문장 제거
        sentences = [s.strip() for s in sentences if s.strip()]
        
        return sentences


class ModelWarmupManager:
    """모델 웜업 관리자"""
    
    def __init__(self):
        self.warmup_texts = [
            "안녕하세요",
            "테스트입니다",
            "Hello world",
            "This is a test"
        ]
        self.warmed_up_models = set()
    
    async def warmup_model(self, model, model_name: str, make_cond_dict_func, device):
        """모델 웜업 (첫 실행 시 지연 시간 단축)"""
        if model_name in self.warmed_up_models:
            return
        
        print(f"🔥 모델 웜업 시작: {model_name}")
        start_time = time.time()
        
        try:
            # 짧은 텍스트들로 몇 번 실행하여 모델을 웜업
            for text in self.warmup_texts[:2]:  # 처음 2개만
                cond_dict = make_cond_dict_func(
                    text=text,
                    language="ko",
                    speaker=None,
                    emotion=[0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.3],
                    device=device
                )
                
                conditioning = model.prepare_conditioning(cond_dict)
                
                # 작은 토큰 수로 빠르게 생성
                with torch.no_grad():
                    codes = model.generate(
                        prefix_conditioning=conditioning,
                        max_new_tokens=50,  # 매우 적은 토큰
                        cfg_scale=1.0,  # 낮은 CFG로 빠르게
                        batch_size=1,
                        progress_bar=False,
                        disable_torch_compile=True
                    )
                
                # 메모리 정리
                del codes
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            
            warmup_time = time.time() - start_time
            self.warmed_up_models.add(model_name)
            print(f"✅ 모델 웜업 완료: {model_name} ({warmup_time:.2f}s)")
            
        except Exception as e:
            print(f"⚠️ 모델 웜업 실패: {e}")


# GPU 최적화 설정
class GPUOptimizer:
    """GPU 최적화 관리자"""
    
    @staticmethod
    def optimize_gpu_settings():
        """GPU 최적화 설정 적용"""
        if not torch.cuda.is_available():
            return
        
        # CUDA 최적화
        torch.backends.cudnn.benchmark = True
        torch.backends.cudnn.deterministic = False
        
        # 메모리 최적화
        torch.cuda.empty_cache()
        
        # Mixed precision 권장 설정
        if torch.cuda.get_device_capability()[0] >= 7:  # V100, RTX 시리즈 등
            print("🚀 Mixed precision (Tensor Core) 최적화 활성화 권장")
        
        print(f"🎮 GPU 최적화 완료: {torch.cuda.get_device_name()}")
    
    @staticmethod
    def get_optimal_batch_size(model_name: str) -> int:
        """모델별 최적 배치 크기 반환"""
        if not torch.cuda.is_available():
            return 1
        
        gpu_memory_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
        
        if "tiny" in model_name.lower():
            return min(4, int(gpu_memory_gb // 2))
        else:
            return min(2, int(gpu_memory_gb // 4))
