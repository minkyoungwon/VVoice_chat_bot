import os
import asyncio
import json
import logging
import time
from typing import Dict, Optional, Any, List
from contextlib import asynccontextmanager
# 기존 import들 아래에 추가
from tts_speed_optimization import AdvancedTTSCache, ParallelTTSProcessor, ModelWarmupManager, GPUOptimizer
import numpy as np

import torch
import torchaudio
import uvicorn

# 🔧 PyTorch 컴파일 완전 비활성화 (비호환성 문제 해결)
try:
    import torch._dynamo
    torch._dynamo.config.suppress_errors = True
    # PyTorch 컴파일 전역 비활성화
    torch._dynamo.config.disable = True
    # Triton 컴파일러 에러 억제
    os.environ["PYTORCH_DISABLE_DYNAMO_COMPILATION"] = "1"
    os.environ["TORCH_COMPILE_DISABLE"] = "1"
except ImportError:
    pass

# PyTorch 컴파일 완전 비활성화 환경변수 설정
os.environ["PYTORCH_DISABLE_DYNAMO_COMPILATION"] = "1"
os.environ["TORCH_COMPILE_DISABLE"] = "1"
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from huggingface_hub import login, HfApi

# .env 파일 로드
load_dotenv()

# 🔥 Hugging Face 토큰 설정
hf_token = os.getenv("HUGGINGFACE_TOKEN")
if hf_token:
    try:
        login(token=hf_token, add_to_git_credential=False)
        print("✅ Hugging Face 토큰 로그인 성공")
        
        # 토큰 유효성 검증
        api = HfApi()
        whoami = api.whoami(token=hf_token)
        print(f"🔑 Hugging Face 사용자: {whoami['name']}")
        
    except Exception as e:
        print(f"❌ Hugging Face 토큰 로그인 실패: {e}")
        print("⚠️ Zonos 모델 로드에 실패할 수 있습니다.")
else:
    print("⚠️ HUGGINGFACE_TOKEN 환경 변수가 설정되지 않았습니다.")
    print("💡 .env 파일에 HUGGINGFACE_TOKEN을 설정해주세요.")

# 🔥 디바이스 설정 로직 개선
def setup_device():
    """GPU/CPU 디바이스 설정"""
    device_setting = os.getenv("DEVICE", "auto").lower()
    force_cpu = os.getenv("FORCE_CPU", "false").lower() == "true"
    cuda_device_id = int(os.getenv("CUDA_DEVICE_ID", "0"))
    
    if force_cpu:
        device = torch.device("cpu")
        logger.info("🔧 강제로 CPU 사용")
    elif device_setting == "cpu":
        device = torch.device("cpu")
        logger.info("🔧 CPU 디바이스 선택됨")
    elif device_setting == "cuda":
        if torch.cuda.is_available():
            device = torch.device(f"cuda:{cuda_device_id}")
            logger.info(f"🚀 CUDA 디바이스 선택됨: {device} (GPU: {torch.cuda.get_device_name(cuda_device_id)})")
            
            # CUDA 최적화 설정
            if os.getenv("TORCH_CUDNN_BENCHMARK", "true").lower() == "true":
                torch.backends.cudnn.benchmark = True
                logger.info("🚀 cuDNN 벤치마크 모드 활성화")
                
        else:
            device = torch.device("cpu")
            logger.warning("⚠️ CUDA가 사용할 수 없어 CPU로 fallback")
    else:  # auto
        if torch.cuda.is_available():
            device = torch.device(f"cuda:{cuda_device_id}")
            logger.info(f"🚀 자동 선택: CUDA 디바이스 (GPU: {torch.cuda.get_device_name(cuda_device_id)})")
            torch.backends.cudnn.benchmark = True
        else:
            device = torch.device("cpu")
            logger.info("🔧 자동 선택: CPU 디바이스")
    
    return device

# Zonos 모델 import
from zonos.model import Zonos
from zonos.backbone import BACKBONES
from zonos.conditioning import make_cond_dict, supported_language_codes

# STT 서비스 import
from stt_service import add_stt_routes, get_stt_service

# GPT 서비스 import
from gpt_service import add_gpt_routes, initialize_gpt_service, get_gpt_service

# Firebase 서비스 import
from firebase_service import (
    add_firebase_routes, 
    initialize_firebase_service, 
    log_user_message, 
    log_assistant_message, 
    log_system_message
)

# 대화형 WebSocket import
from conversation_websocket import set_dependencies, add_conversation_routes

# 목소리 관리 시스템 import
from voice_manager import VoiceManager, EmotionManager

# eSpeak 환경 설정
espeak_path = os.getenv("ESPEAK_NG_PATH", r"C:\Program Files\eSpeak NG")
espeak_data_path = os.getenv("ESPEAK_NG_LIBRARY_PATH", r"C:\Program Files\eSpeak NG\espeak-ng-data")

os.environ["PATH"] += f";{espeak_path}"
os.environ["ESPEAK_NG_PATH"] = espeak_data_path

# 로깅 설정
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level))
logger = logging.getLogger(__name__)

# Hugging Face 로그인 상태를 로거로 다시 출력
if hf_token:
    try:
        api = HfApi()
        whoami = api.whoami(token=hf_token)
        logger.info(f"✅ Hugging Face 인증 성공: {whoami['name']}")
    except Exception as e:
        logger.error(f"❌ Hugging Face 인증 실패: {e}")
else:
    logger.warning("⚠️ HUGGINGFACE_TOKEN이 설정되지 않음")

# 디바이스 설정
device = setup_device()

# 🎯 지원되는 모델 확인 함수
def get_supported_models() -> List[str]:
    """현재 백본이 지원하는 모델들만 반환"""
    supported_models = []
    
    # 🔥 실제 존재하는 Transformer 모델만 추가
    transformer_models = [
        "Zyphra/Zonos-v0.1-transformer"  # 유일한 작동하는 모델
        # "Zyphra/Zonos-v0.1-tiny"  # 404 에러 - 존재하지 않음
    ]
    
    for model in transformer_models:
        supported_models.append(model)
        
    logger.info(f"🎯 지원되는 모델: {supported_models}")
    return supported_models

# 📊 성능 모니터링 클래스
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {}
        self.enable_logging = os.getenv("ENABLE_PERFORMANCE_LOGGING", "true").lower() == "true"
    
    def start_timer(self, operation: str) -> str:
        """타이머 시작"""
        timer_id = f"{operation}_{int(time.time() * 1000)}"
        self.metrics[timer_id] = {"start": time.time(), "operation": operation}
        return timer_id
    
    def end_timer(self, timer_id: str) -> float:
        """타이머 종료 및 시간 반환"""
        if timer_id in self.metrics:
            elapsed = time.time() - self.metrics[timer_id]["start"]
            operation = self.metrics[timer_id]["operation"]
            
            if self.enable_logging:
                logger.info(f"⏱️ {operation}: {elapsed:.3f}초")
                
            return elapsed
        return 0.0
    
    def log_memory_usage(self, context: str = ""):
        """메모리 사용량 로깅"""
        if self.enable_logging and torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024**3
            reserved = torch.cuda.memory_reserved() / 1024**3
            logger.info(f"🧠 GPU 메모리 {context}: 할당={allocated:.2f}GB, 예약={reserved:.2f}GB")

perf_monitor = PerformanceMonitor()

# 개선된 모델 캐시 클래스
class EnhancedModelCache:
    def __init__(self):
        self.models: Dict[str, Zonos] = {}
        self.current_model_type: Optional[str] = None
        self.speaker_embedding: Optional[torch.Tensor] = None
        self.speaker_audio_path: Optional[str] = None
        self.loading_progress: Dict[str, float] = {}
        self.loading_status: Dict[str, str] = {}
        self.supported_models = get_supported_models()
        self.warmup_completed = set()
        self.compilation_cache = {}
        
    def _validate_model(self, model_choice: str) -> str:
        """모델 유효성 검사 및 대체 모델 제안"""
        if model_choice in self.supported_models:
            return model_choice
            
        # 지원되지 않는 모델인 경우 대체 모델 제안
        if "hybrid" in model_choice.lower():
            replacement = "Zyphra/Zonos-v0.1-transformer"
            logger.warning(f"⚠️ {model_choice} 모델은 지원되지 않습니다. {replacement}로 대체합니다.")
            return replacement
        elif "tiny" in model_choice.lower():
            return "Zyphra/Zonos-v0.1-tiny"
        else:
            # 기본 모델로 fallback
            default_model = self.supported_models[0] if self.supported_models else "Zyphra/Zonos-v0.1-transformer"
            logger.warning(f"⚠️ {model_choice} 모델을 찾을 수 없습니다. {default_model}로 대체합니다.")
            return default_model
        
    async def load_model_with_progress(self, model_choice: str, websocket: WebSocket = None) -> Zonos:
        """프로그레스바와 함께 모델 로드"""
        # 모델 유효성 검사
        validated_model = self._validate_model(model_choice)
        
        if validated_model in self.models:
            self.current_model_type = validated_model
            if validated_model not in self.warmup_completed:
                await self._warmup_model(validated_model, websocket)
            
            if websocket:
                await websocket.send_json({
                    "type": "model_already_loaded",
                    "model": validated_model,
                    "memory_usage": self._get_memory_usage()
                })
            return self.models[validated_model]
        
        # 타이머 시작
        timer_id = perf_monitor.start_timer(f"model_load_{validated_model}")
        
        # 로딩 상태 초기화
        self.loading_progress[validated_model] = 0.0
        self.loading_status[validated_model] = "모델 다운로드 시작..."
        
        try:
            if websocket:
                await websocket.send_json({
                    "type": "model_loading_progress",
                    "model": validated_model,
                    "progress": 0.0,
                    "status": "모델 다운로드 시작"
                })
            
            logger.info(f"📥 Loading {validated_model} model...")
            
            # 단계별 진행률 업데이트
            steps = [
                (10, "모델 구성 파일 확인 중..."),
                (25, "가중치 파일 다운로드 중..."),
                (50, "모델 초기화 중..."),
                (75, f"{'GPU' if device.type == 'cuda' else 'CPU'} 메모리 할당 중..."),
                (90, "모델 컴파일 중..."),
                (100, "모델 로드 완료")
            ]
            
            for i, (progress, status) in enumerate(steps):
                self.loading_progress[validated_model] = progress
                self.loading_status[validated_model] = status
                
                if websocket:
                    await websocket.send_json({
                        "type": "model_loading_progress",
                        "model": validated_model,
                        "progress": progress,
                        "status": status
                    })
                
                # 실제 모델 로딩은 50% 지점에서 수행
                if progress == 50:
                    try:
                        # 메모리 사용량 체크 (로딩 전)
                        perf_monitor.log_memory_usage("모델 로딩 전")
                        
                        # 실제 모델 로드
                        model = Zonos.from_pretrained(validated_model, device=device)
                        model.requires_grad_(False).eval()
                        
                        # Mixed precision 설정
                        if os.getenv("MIXED_PRECISION", "true").lower() == "true" and device.type == "cuda":
                            model = model.to(dtype=torch.bfloat16)
                            logger.info("🚀 Mixed precision (bfloat16) 적용됨")
                        
                        # PyTorch 컴파일 비활성화 (대신 Eager 모드 사용)
                        # 컴파일러 문제로 인해 완전 비활성화
                        logger.info("🚀 PyTorch Eager 모드 사용 (컴파일 비활성화)")
                        
                        logger.info(f"✅ Model {validated_model} loaded to device: {device}")
                        
                        # 메모리 사용량 체크 (로딩 후)
                        perf_monitor.log_memory_usage("모델 로딩 후")
                        
                    except Exception as e:
                        logger.error(f"❌ Failed to load model {validated_model}: {e}")
                        raise e
                
                # 각 단계마다 약간의 지연 (사용자 경험 개선)
                await asyncio.sleep(0.3 if i < len(steps) - 1 else 0.1)
            
            self.models[validated_model] = model
            self.current_model_type = validated_model
            
            # 타이머 종료
            load_time = perf_monitor.end_timer(timer_id)
            
            logger.info(f"✅ {validated_model} model loaded successfully in {load_time:.2f}s!")
            
            if websocket:
                await websocket.send_json({
                    "type": "model_loading_complete",
                    "model": validated_model,
                    "load_time": load_time,
                    "memory_usage": self._get_memory_usage(),
                    "device": str(device)
                })
            
            return model
            
        except Exception as e:
            self.loading_status[validated_model] = f"로딩 실패: {str(e)}"
            logger.error(f"❌ Failed to load {validated_model}: {e}")
            
            if websocket:
                await websocket.send_json({
                    "type": "model_loading_error",
                    "model": validated_model,
                    "error": str(e)
                })
            
            raise e
    
    def _get_memory_usage(self) -> Dict[str, float]:
        """메모리 사용량 정보 반환"""
        memory_info = {}
        if torch.cuda.is_available():
            memory_info["gpu_allocated"] = torch.cuda.memory_allocated() / 1024**3  # GB
            memory_info["gpu_reserved"] = torch.cuda.memory_reserved() / 1024**3   # GB
            memory_info["gpu_total"] = torch.cuda.get_device_properties(0).total_memory / 1024**3
        return memory_info
    
    def load_model_if_needed(self, model_choice: str) -> Zonos:
        """동기식 모델 로드 (기존 호환성)"""
        validated_model = self._validate_model(model_choice)
        
        if validated_model not in self.models:
            timer_id = perf_monitor.start_timer(f"sync_model_load_{validated_model}")
            logger.info(f"📥 Loading {validated_model} model synchronously...")
            
            try:
                perf_monitor.log_memory_usage("동기 모델 로딩 전")
                
                model = Zonos.from_pretrained(validated_model, device=device)
                model.requires_grad_(False).eval()
                
                # Mixed precision 설정
                if os.getenv("MIXED_PRECISION", "true").lower() == "true" and device.type == "cuda":
                    model = model.to(dtype=torch.bfloat16)
                
                self.models[validated_model] = model
                
                load_time = perf_monitor.end_timer(timer_id)
                perf_monitor.log_memory_usage("동기 모델 로딩 후")
                
                logger.info(f"✅ {validated_model} model loaded successfully in {load_time:.2f}s!")
                
            except Exception as e:
                logger.error(f"❌ Failed to load {validated_model}: {e}")
                raise e
        
        self.current_model_type = validated_model
        return self.models[validated_model]
    
    def get_speaker_embedding(self, audio_path: str) -> torch.Tensor:
        """스피커 임베딩 캐시 관리"""
        if audio_path != self.speaker_audio_path:
            current_model = self.models.get(self.current_model_type)
            if current_model is None:
                raise ValueError("No model loaded")
                
            wav, sr = torchaudio.load(audio_path)
            self.speaker_embedding = current_model.make_speaker_embedding(wav, sr)
            self.speaker_embedding = self.speaker_embedding.to(device, dtype=torch.bfloat16)
            self.speaker_audio_path = audio_path
            logger.info("🎤 Recomputed speaker embedding")
            
        return self.speaker_embedding
    
    async def _warmup_model(self, model_name: str, websocket: "WebSocket" = None):
        """모델 웜업 (비동기)"""
        if model_name in self.warmup_completed:
            return
        
        if websocket:
            await websocket.send_json({
                "type": "model_warmup_start", 
                "model": model_name,
                "status": "모델 웜업 중..."
            })
        
        try:
            model = self.models[model_name]
            await warmup_manager.warmup_model(model, model_name, make_cond_dict, device)
            self.warmup_completed.add(model_name)
            
            if websocket:
                await websocket.send_json({
                    "type": "model_warmup_complete",
                    "model": model_name,
                    "status": "웜업 완료"
                })
        except Exception as e:
            logger.warning(f"⚠️ 모델 웜업 실패: {e}")
    
    



# 글로벌 모델 캐시 인스턴스
model_cache = EnhancedModelCache()

# 글로벌 목소리 관리자 인스턴스
voice_manager = VoiceManager(device)



# 기존 model_cache 선언 아래에 추가
tts_cache = AdvancedTTSCache(
    cache_dir=os.getenv("TTS_CACHE_DIR", "cache/tts"),
    max_cache_size_gb=float(os.getenv("TTS_CACHE_SIZE_GB", "2.0"))
)
parallel_processor = ParallelTTSProcessor(
    max_workers=int(os.getenv("TTS_MAX_WORKERS", "2"))
)
warmup_manager = ModelWarmupManager()

# GPU 최적화 적용
GPUOptimizer.optimize_gpu_settings()






# WebSocket 연결 관리자 개선
class EnhancedConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_info: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_info[client_id] = {
            "connected_at": time.time(),
            "last_activity": time.time(),
            "status": "connected"
        }
        logger.info(f"🔗 Client {client_id} connected to TTS WebSocket")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            del self.connection_info[client_id]
            logger.info(f"🔌 Client {client_id} disconnected from TTS WebSocket")
    
    async def send_to_client(self, client_id: str, message: dict):
        """특정 클라이언트에게 메시지 전송"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
                self.connection_info[client_id]["last_activity"] = time.time()
            except Exception as e:
                logger.error(f"❌ Failed to send message to {client_id}: {e}")
                self.disconnect(client_id)

tts_manager = EnhancedConnectionManager()

# 🚀 울트라 최적화된 실시간 오디오 스트리밍
async def ultra_optimized_stream_audio_generation(
    websocket: WebSocket, 
    model: Zonos, 
    conditioning: torch.Tensor,
    request_data: Dict[str, Any],
    format_type: str = "pcm",
    client_id: str = None
):
    """울트라 최적화된 실시간 오디오 스트리밍"""
    
    text = request_data.get("text", "")
    model_name = request_data.get("model", "")
    
    # 1. 캐시 확인 단계
    cache_settings = {
        'model': model_name,
        'language': request_data.get('language', 'ko'),
        'emotion': request_data.get('emotion', []),
        'speaking_rate': request_data.get('speaking_rate', 15.0),
        'pitch_std': request_data.get('pitch_std', 20.0),
        'cfg_scale': request_data.get('cfg_scale', 2.0)
    }
    
    cached_audio = tts_cache.get_cached_audio(text, model_name, cache_settings)
    
    if cached_audio is not None:
        # 캐시 히트! 즉시 스트리밍
        try:
            await websocket.send_json({
                "type": "cache_hit",
                "message": "캐시된 오디오 사용 (초고속)",
                "latency": "~0.05s"
            })
            
            sr = model.autoencoder.sampling_rate
            await websocket.send_json({
                "type": "generation_metadata",
                "sample_rate": int(sr),
                "total_duration": len(cached_audio) / sr,
                "generation_time": 0.05,  # 캐시 히트 시간
                "latency": 0.05,
                "source": "cache",
                "performance": "🚀 캐시"
            })
            
            # 캐시된 오디오 스트리밍
            await _stream_cached_audio(websocket, cached_audio, sr, format_type)
            return
            
        except Exception as e:
            logger.error(f"❌ 캐시 오디오 스트리밍 실패: {e}")
            # 캐시 실패 시 일반 생성으로 fallback
    
    
    # 2. 긴 텍스트 병렬 처리 확인
    
    if len(text) > int(os.getenv("PARALLEL_TEXT_THRESHOLD", "150")):
        try:
            await websocket.send_json({
                "type": "parallel_processing",
                "message": "긴 텍스트 병렬 처리 중...",
                "text_length": len(text)
            })
            
            audio_chunks = await _process_text_parallel(model, conditioning, request_data)
            
            if audio_chunks:
                # 오디오 청크 결합
                sr = model.autoencoder.sampling_rate
                combined_audio = parallel_processor.combine_audio_chunks(audio_chunks, sr)
                
                # 캐시에 저장
                tts_cache.save_cached_audio(text, model_name, cache_settings, combined_audio, sr)
                
                # 결합된 오디오 스트리밍
                await _stream_generated_audio(websocket, combined_audio, sr, format_type, "parallel")
                return
                
        except Exception as e:
            logger.warning(f"⚠️ 병렬 처리 실패, 일반 처리로 fallback: {e}")
    
    
    # 3. 일반 생성 (최적화 적용)
    
    timer_id = perf_monitor.start_timer("optimized_audio_generation")
    
    try:
        await websocket.send_json({
            "type": "generation_started",
            "text": text,
            "model": model_name,
            "mode": "optimized_single"
        })
        
        # GPU 메모리 최적화
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        perf_monitor.log_memory_usage("최적화 생성 전")
        
        # 🚀 최적화된 생성 파라미터
        optimal_batch_size = GPUOptimizer.get_optimal_batch_size(model_name)
        max_new_tokens = min(86 * 30, len(text) * 12)  # 더 효율적인 토큰 계산
        
        # Mixed precision 사용
        with torch.autocast(device_type=device.type, enabled=device.type == 'cuda'):
            codes = model.generate(
                prefix_conditioning=conditioning,
                audio_prefix_codes=None,
                max_new_tokens=max_new_tokens,
                cfg_scale=request_data.get("cfg_scale", 2.0),
                batch_size=optimal_batch_size,
                sampling_params=dict(
                    min_p=0.1,
                    temperature=0.8,  # 약간 낮춰서 안정성 향상
                ),
                progress_bar=False,
                disable_torch_compile=True,
            )
        
        # 오디오 디코딩
        wav_out = model.autoencoder.decode(codes).cpu().detach()
        if wav_out.dim() == 2 and wav_out.size(0) > 1:
            wav_out = wav_out[0:1, :]
        
        audio_data = wav_out.squeeze().numpy()
        sr = model.autoencoder.sampling_rate
        
        generation_time = perf_monitor.end_timer(timer_id)
        perf_monitor.log_memory_usage("최적화 생성 후")
        
        # 캐시에 저장
        tts_cache.save_cached_audio(text, model_name, cache_settings, audio_data, sr)
        
        # 오디오 스트리밍
        await _stream_generated_audio(websocket, audio_data, sr, format_type, "optimized", generation_time)
        
    except Exception as e:
        logger.error(f"❌ 최적화 오디오 생성 실패: {e}")
        await websocket.send_json({
            "type": "generation_error",
            "error": f"최적화 생성 실패: {str(e)}",
            "error_code": "OPTIMIZED_GENERATION_ERROR"
        })

# 보조 함수들
async def _stream_cached_audio(websocket: WebSocket, audio_data: np.ndarray, sr: int, format_type: str):
    """캐시된 오디오 스트리밍"""
    chunk_duration = 0.05  # 캐시는 더 작은 청크로 빠르게
    chunk_size = int(sr * chunk_duration)
    
    for i in range(0, len(audio_data), chunk_size):
        chunk = audio_data[i:i + chunk_size]
        
        if format_type == "pcm":
            chunk_int16 = (chunk * 32767).astype('int16')
            await websocket.send_bytes(chunk_int16.tobytes())
        else:
            await websocket.send_bytes(chunk.astype('float32').tobytes())
        
        await asyncio.sleep(0.005)  # 더 빠른 스트리밍

async def _stream_generated_audio(websocket: WebSocket, audio_data: np.ndarray, sr: int, format_type: str, source: str, generation_time: float = 0):
    """생성된 오디오 스트리밍"""
    audio_duration = len(audio_data) / sr
    rtf = generation_time / audio_duration if audio_duration > 0 else 0
    
    await websocket.send_json({
        "type": "generation_metadata",
        "sample_rate": int(sr),
        "total_duration": audio_duration,
        "generation_time": generation_time,
        "latency": generation_time,
        "rtf": rtf,
        "source": source,
        "performance": "🚀 최적화됨" if rtf < 0.5 else "⚡ 빠름" if rtf < 1.0 else "⚠️ 느림"
    })
    
    chunk_duration = float(os.getenv("TTS_CHUNK_DURATION", "0.1"))
    chunk_size = int(sr * chunk_duration)
    
    for i in range(0, len(audio_data), chunk_size):
        chunk = audio_data[i:i + chunk_size]
        
        if format_type == "pcm":
            chunk_int16 = (chunk * 32767).astype('int16')
            await websocket.send_bytes(chunk_int16.tobytes())
        else:
            await websocket.send_bytes(chunk.astype('float32').tobytes())
        
        await asyncio.sleep(0.01)

async def _process_text_parallel(model: Zonos, base_conditioning: torch.Tensor, request_data: Dict) -> List[np.ndarray]:
    """텍스트 병렬 처리"""
    text = request_data.get("text", "")
    text_chunks = parallel_processor.text_splitter.split_text(text)
    
    if len(text_chunks) <= 1:
        return []
    
    async def generate_chunk(chunk_text: str, chunk_id: int = 0):
        # 청크별 컨디셔닝 생성
        cond_dict = make_cond_dict(
            text=chunk_text,
            language=request_data.get("language", "ko"),
            speaker=None,
            emotion=request_data.get("emotion", [0.3077, 0.0256, 0.0256, 0.0256, 0.0256, 0.0256, 0.2564, 0.3077]),
            fmax=request_data.get("fmax", 22050.0),
            pitch_std=request_data.get("pitch_std", 20.0),
            speaking_rate=request_data.get("speaking_rate", 15.0),
            vqscore_8=request_data.get("vqscore_8", [0.78] * 8),
            dnsmos_ovrl=request_data.get("dnsmos_ovrl", 4.0),
            device=device,
            unconditional_keys={"vqscore_8", "dnsmos_ovrl"}
        )
        
        conditioning = model.prepare_conditioning(cond_dict)
        
        # 청크 생성
        max_new_tokens = min(86 * 20, len(chunk_text) * 10)
        
        with torch.autocast(device_type=device.type, enabled=device.type == 'cuda'):
            codes = model.generate(
                prefix_conditioning=conditioning,
                max_new_tokens=max_new_tokens,
                cfg_scale=request_data.get("cfg_scale", 2.0),
                batch_size=1,
                sampling_params=dict(min_p=0.1),
                progress_bar=False,
                disable_torch_compile=True,
            )
        
        wav_out = model.autoencoder.decode(codes).cpu().detach()
        if wav_out.dim() == 2 and wav_out.size(0) > 1:
            wav_out = wav_out[0:1, :]
        
        return wav_out.squeeze().numpy()
    
    # 병렬 처리 실행
    return await parallel_processor.process_long_text_parallel(text, generate_chunk)

# 기존 함수 (호환성을 위해 유지)
async def enhanced_stream_audio_generation(
    websocket: WebSocket, 
    model: Zonos, 
    conditioning: torch.Tensor,
    request_data: Dict[str, Any],
    format_type: str = "pcm",
    client_id: str = None
):
    """기존 함수 -> 최적화 함수로 리다이렉트"""
    return await ultra_optimized_stream_audio_generation(
        websocket, model, conditioning, request_data, format_type, client_id
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 앱 생명주기 관리"""
    logger.info("🚀 Starting up Enhanced Zonos FastAPI server...")
    
    # 디바이스 정보 출력
    logger.info(f"🔧 디바이스: {device}")
    if torch.cuda.is_available():
        logger.info(f"🎮 GPU 정보: {torch.cuda.get_device_name()}")
        logger.info(f"🧠 GPU 메모리: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
    
    # 지원되는 모델 목록
    supported_models = get_supported_models()
    app.state.supported_models = supported_models
    logger.info(f"🎯 지원 모델: {supported_models}")
    
    # 기본 모델 미리 로드 (선택사항)
    try_preload = os.getenv("PRELOAD_DEFAULT_MODEL", "false").lower() == "true"
    if supported_models and try_preload:
        try:
            logger.info("📥 기본 모델 미리 로드 중...")
            default_model = os.getenv("DEFAULT_TTS_MODEL", supported_models[0])
            await model_cache.load_model_with_progress(default_model)
            logger.info("✅ 기본 모델 미리 로드 완료")
        except Exception as e:
            logger.warning(f"⚠️ 기본 모델 미리 로드 실패: {e}")
    
    # GPT 서비스 초기화
    gpt_api_key = os.getenv("DEEPSEEK_API_KEY")
    if gpt_api_key:
        initialize_gpt_service(gpt_api_key)
        logger.info("✅ GPT 서비스 초기화 완료")
    else:
        logger.warning("⚠️ DEEPSEEK_API_KEY 환경 변수가 설정되지 않았습니다.")
    
    # Firebase 서비스 초기화
    firebase_creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if firebase_creds_path and os.path.exists(firebase_creds_path):
        initialize_firebase_service(firebase_creds_path)
        logger.info("✅ Firebase 서비스 초기화 완료")
    else:
        logger.warning("⚠️ Firebase credentials not found, logging disabled")
    
    # 대화형 WebSocket 의존성 주입
    set_dependencies({
        'model_cache': model_cache,
        'make_cond_dict': make_cond_dict,
        'device': device,
        'log_user_message': log_user_message,
        'log_assistant_message': log_assistant_message,
        'log_system_message': log_system_message,
        'get_gpt_service': get_gpt_service,
        'get_stt_service': get_stt_service
    })
    
    yield
    
    # 종료 시 정리
    logger.info("🛑 Shutting down Enhanced Zonos FastAPI server...")
    model_cache.models.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

# FastAPI 앱 생성
app = FastAPI(
    title="Enhanced Zonos TTS API",
    description="실시간 WebSocket 기반 Text-to-Speech API with GPU/CPU Support",
    version="2.1.0",
    lifespan=lifespan
)

# 서비스 라우터들 추가
add_stt_routes(app)
add_gpt_routes(app)
add_firebase_routes(app)
add_conversation_routes(app)

# CORS 설정
allowed_origins = os.getenv("ALLOWED_ORIGINS", '["*"]')
try:
    import ast
    origins_list = ast.literal_eval(allowed_origins)
except:
    origins_list = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response 모델들
class TTSRequest(BaseModel):
    text: str
    model: str = "Zyphra/Zonos-v0.1-transformer"
    language: str = "ko"
    format: str = "pcm"
    emotion: list[float] = [0.3077, 0.0256, 0.0256, 0.0256, 0.0256, 0.0256, 0.2564, 0.3077]
    fmax: float = 22050.0
    pitch_std: float = 20.0
    speaking_rate: float = 15.0
    vqscore_8: list[float] = [0.78] * 8
    dnsmos_ovrl: float = 4.0
    cfg_scale: float = 2.0
    seed: int = 420
    randomize_seed: bool = True

class ModelInfoResponse(BaseModel):
    supported_models: list[str]
    current_model: Optional[str]
    device: str
    device_info: Dict[str, Any]

# REST API 엔드포인트들
@app.get("/", response_model=dict)
async def root():
    """헬스체크 엔드포인트"""
    return {
        "message": "Enhanced Zonos TTS API v2.1.0",
        "status": "running",
        "device": str(device),
        "supported_models": getattr(app.state, 'supported_models', []),
        "memory_usage": model_cache._get_memory_usage(),
        "features": {
            "gpu_support": torch.cuda.is_available(),
            "mixed_precision": os.getenv("MIXED_PRECISION", "true").lower() == "true",
            "torch_compile": os.getenv("ENABLE_TORCH_COMPILE", "true").lower() == "true"
        }
    }

@app.get("/api/models", response_model=ModelInfoResponse)
async def get_models():
    """지원되는 모델 목록 반환"""
    device_info = {
        "type": device.type,
        "name": torch.cuda.get_device_name() if torch.cuda.is_available() else "CPU"
    }
    
    if torch.cuda.is_available():
        props = torch.cuda.get_device_properties(0)
        device_info.update({
            "total_memory_gb": props.total_memory / 1024**3,
            "compute_capability": f"{props.major}.{props.minor}"
        })
    
    return ModelInfoResponse(
        supported_models=getattr(app.state, 'supported_models', []),
        current_model=model_cache.current_model_type,
        device=str(device),
        device_info=device_info
    )

@app.get("/api/tts/status")
async def get_tts_status():
    """TTS 서비스 상태 반환"""
    return {
        "status": "running",
        "loaded_models": list(model_cache.models.keys()),
        "current_model": model_cache.current_model_type,
        "memory_usage": model_cache._get_memory_usage(),
        "active_connections": len(tts_manager.active_connections),
        "device": str(device),
        "supported_models": getattr(app.state, 'supported_models', []),
        "performance_features": {
            "gpu_enabled": device.type == "cuda",
            "mixed_precision": os.getenv("MIXED_PRECISION", "true").lower() == "true",
            "torch_compile": os.getenv("ENABLE_TORCH_COMPILE", "true").lower() == "true",
            "cudnn_benchmark": torch.backends.cudnn.benchmark if torch.cuda.is_available() else False
        }
    }

@app.post("/api/tts/preload")
async def preload_model(model_name: str):
    """모델 미리 로드"""
    try:
        await model_cache.load_model_with_progress(model_name)
        return {
            "status": "success",
            "message": f"Model {model_name} preloaded successfully",
            "memory_usage": model_cache._get_memory_usage()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🎤 목소리 관리 API 엔드포인트들
@app.get("/api/tts/voices")
async def get_available_voices():
    """사용 가능한 목소리 목록 반환"""
    try:
        logger.info("🎤 목소리 목록 요청 수신")
        
        # voice_manager 인스턴스 확인
        if voice_manager is None:
            logger.error("❌ VoiceManager 인스턴스가 없습니다")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error", 
                    "message": "VoiceManager 초기화 실패",
                    "data": {"predefined_voices": [], "voice_info": {}}
                }
            )
        
        voices_info = voice_manager.get_available_voices()
        logger.info(f"✅ 목소리 정보 가져오기 성공: {len(voices_info.get('predefined_voices', []))}개")
        
        response_data = {
            "status": "success",
            "data": voices_info,
            "message": f"확인 {len(voices_info.get('predefined_voices', []))}개 목소리 사용 가능",
            "timestamp": time.time()
        }
        
        logger.info(f"📤 목소리 API 응답 전송: {response_data}")
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"❌ 목소리 목록 가져오기 실패: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"목소리 목록 로드 실패: {str(e)}",
                "data": {"predefined_voices": [], "voice_info": {}},
                "error_type": type(e).__name__
            }
        )

@app.post("/api/tts/upload-voice")
async def upload_voice_file(file: UploadFile = File(...)):
    """목소리 파일 업로드"""
    try:
        logger.info(f"📤 목소리 업로드 요청: {file.filename}, {file.content_type}")
        
        # voice_manager 인스턴스 확인
        if voice_manager is None:
            logger.error("❌ VoiceManager 인스턴스가 없습니다")
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "VoiceManager 초기화 실패"
                }
            )
        
        # 파일 검증
        if not file.content_type or not file.content_type.startswith('audio/'):
            logger.warning(f"⚠️ 잘못된 파일 타입: {file.content_type}")
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "오디오 파일만 업로드 가능합니다"
                }
            )
        
        # 파일 크기 검증 (10MB 제한)
        max_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        logger.info(f"💾 파일 크기: {len(file_content)} bytes")
        
        if len(file_content) > max_size:
            logger.warning(f"⚠️ 파일 크기 초과: {len(file_content)} > {max_size}")
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "파일 크기는 10MB 이하여야 합니다"
                }
            )
        
        # 목소리 추가
        voice_id = await voice_manager.add_voice_from_file(file_content, file.filename)
        logger.info(f"✅ 목소리 업로드 성공: {voice_id}")
        
        response_data = {
            "status": "success",
            "voice_id": voice_id,
            "message": "목소리 업로드 성공",
            "filename": file.filename,
            "file_size_mb": round(len(file_content) / (1024 * 1024), 2),
            "timestamp": time.time()
        }
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"❌ 목소리 업로드 실패: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"업로드 실패: {str(e)}",
                "error_type": type(e).__name__
            }
        )

@app.get("/api/tts/emotions")
async def get_emotion_presets():
    """사용 가능한 감정 프리셋 목록 반환"""
    try:
        presets = EmotionManager.get_available_presets()
        return {
            "status": "success",
            "emotion_presets": presets,
            "emotion_labels": [
                "Happiness", "Sadness", "Disgust", "Fear", 
                "Surprise", "Anger", "Other", "Neutral"
            ],
            "usage": {
                "emotion_preset": "네임드 프리셋 사용 (happy, sad, angry, 등)",
                "emotion": "커스텀 감정 벡터 [8개 값] 사용",
                "enable_emotion": "감정 효과 활성화/비활성화"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tts/voice-cache/clear")
async def clear_voice_cache():
    """목소리 캐시 삭제"""
    try:
        voice_manager.clear_cache()
        return {
            "status": "success",
            "message": "목소리 캐시가 삭제되었습니다"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tts/voice-cache/stats")
async def get_voice_cache_stats():
    """목소리 캐시 통계"""
    try:
        stats = voice_manager.get_cache_stats()
        return {
            "status": "success",
            "cache_stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 개선된 WebSocket TTS 엔드포인트
@app.websocket("/ws/tts/{client_id}")
async def enhanced_websocket_tts(websocket: WebSocket, client_id: str):
    """개선된 WebSocket TTS 엔드포인트 - GPU/CPU 최적화"""
    await tts_manager.connect(websocket, client_id)
    
    # 연결 시 캐시 통계 전송
    cache_stats = tts_cache.get_cache_stats()
    
    # 연결 성공 메시지 전송
    try:
        await websocket.send_json({
            "type": "connection_established",
            "client_id": client_id,
            "server_info": {
                "supported_models": getattr(app.state, 'supported_models', []),
                "device": str(device),
                "memory_info": model_cache._get_memory_usage(),
                "version": "2.1.0-optimized",
                "performance_mode": "🚀 GPU 최적화" if device.type == "cuda" else "🔧 CPU",
                "cache_stats": cache_stats,
                "optimizations": {
                    "caching": True,
                    "parallel_processing": True,
                    "model_warmup": True,
                    "gpu_optimization": device.type == "cuda"
                }
            }
        })
        logger.info(f"✅ 클라이언트 {client_id} 연결 메시지 전송 성공")
    except Exception as e:
        logger.error(f"❌ 연결 메시지 전송 실패: {e}")
        tts_manager.disconnect(client_id)
        return
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if data == "stop":
                try:
                    await websocket.send_json({
                        "type": "generation_stopped",
                        "message": "Audio generation stopped by user"
                    })
                except:
                    logger.warning(f"⚠️ stop 메시지 전송 실패")
                continue
                
            if data == "ping":
                try:
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": time.time(),
                        "device": str(device)
                    })
                except:
                    logger.warning(f"⚠️ pong 메시지 전송 실패")
                continue
                
            try:
                request_data = json.loads(data)
                text = request_data.get("text", "")
                model_choice = request_data.get("model", "Zyphra/Zonos-v0.1-transformer")
                format_type = request_data.get("format", "pcm")
                
                if not text.strip():
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "error": "Empty text provided",
                            "error_code": "EMPTY_TEXT"
                        })
                    except:
                        logger.error(f"❌ 빈 텍스트 오류 메시지 전송 실패")
                    continue
                
                # 모델 로드 (프로그레스바 포함)
                model = await model_cache.load_model_with_progress(model_choice, websocket)
                
                # 시드 설정
                seed = request_data.get("seed", 420)
                if request_data.get("randomize_seed", True):
                    seed = torch.randint(0, 2**32 - 1, (1,)).item()
                torch.manual_seed(seed)
                
                # 🎤 목소리 처리
                speaker_embedding = await voice_manager.process_voice_request(request_data, model)
                
                # 😊 감정 처리 개선
                emotion_preset = request_data.get("emotion_preset")
                emotion_custom = request_data.get("emotion")
                emotion = EmotionManager.get_emotion_vector(emotion_preset, emotion_custom)
                enable_emotion = request_data.get("enable_emotion", True)
                
                # unconditional_keys 동적 설정
                unconditional_keys = {"vqscore_8", "dnsmos_ovrl"}
                if not enable_emotion:
                    unconditional_keys.add("emotion")
                
                # 컨디셔닝 설정
                cond_dict = make_cond_dict(
                    text=text,
                    language=request_data.get("language", "ko"),
                    speaker=speaker_embedding,  # 🎤 목소리 적용
                    emotion=emotion,  # 😊 감정 적용
                    fmax=request_data.get("fmax", 22050.0),
                    pitch_std=request_data.get("pitch_std", 20.0),
                    speaking_rate=request_data.get("speaking_rate", 15.0),
                    vqscore_8=request_data.get("vqscore_8", [0.78] * 8),
                    dnsmos_ovrl=request_data.get("dnsmos_ovrl", 4.0),
                    device=device,
                    unconditional_keys=unconditional_keys  # 동적 설정
                )
                
                conditioning = model.prepare_conditioning(cond_dict)
                
                # 🚀 울트라 최적화된 오디오 생성 및 스트리밍
                await ultra_optimized_stream_audio_generation(
                    websocket, model, conditioning, request_data, format_type, client_id
                )
                
                # 완료 신호
                try:
                    await websocket.send_json({
                        "type": "generation_complete",
                        "message": "Audio generation completed successfully",
                        "device": str(device)
                    })
                except Exception as e:
                    logger.warning(f"⚠️ 완료 신호 전송 실패: {e}")
                
            except json.JSONDecodeError:
                try:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Invalid JSON format",
                        "error_code": "JSON_DECODE_ERROR"
                    })
                except:
                    logger.error(f"❌ JSON 오류 메시지 전송 실패")
            except Exception as e:
                logger.error(f"❌ TTS WebSocket error: {e}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "error": str(e),
                        "error_code": "TTS_ERROR"
                    })
                except:
                    logger.error(f"❌ TTS 오류 메시지 전송 실패")
                
    except WebSocketDisconnect:
        tts_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"❌ WebSocket connection error: {e}")
        tts_manager.disconnect(client_id)

# 캐시 및 성능 API 엔드포인트들
@app.get("/api/cache/stats")
async def get_cache_stats():
    """캐시 통계 조회"""
    return tts_cache.get_cache_stats()

@app.post("/api/cache/clear")
async def clear_cache():
    """캐시 완전 삭제"""
    try:
        # 메모리 캐시 클리어
        tts_cache.memory_cache.clear()
        tts_cache.cache_metadata.clear()
        tts_cache.access_times.clear()
        
        # 디스크 캐시 파일들 삭제
        import shutil
        if tts_cache.cache_dir.exists():
            shutil.rmtree(tts_cache.cache_dir)
            tts_cache.cache_dir.mkdir(parents=True, exist_ok=True)
        
        tts_cache.cache_hits = 0
        tts_cache.cache_misses = 0
        
        return {"status": "success", "message": "캐시가 완전히 삭제되었습니다"}
    except Exception as e:
        return {"status": "error", "message": f"캐시 삭제 실패: {str(e)}"}

@app.get("/api/performance/stats")
async def get_performance_stats():
    """전체 성능 통계"""
    return {
        "cache_stats": tts_cache.get_cache_stats(),
        "gpu_info": {
            "available": torch.cuda.is_available(),
            "device_name": torch.cuda.get_device_name() if torch.cuda.is_available() else None,
            "memory_usage": model_cache._get_memory_usage()
        },
        "model_info": {
            "loaded_models": list(model_cache.models.keys()),
            "warmed_up_models": list(model_cache.warmup_completed) if hasattr(model_cache, 'warmup_completed') else []
        },
        "optimization_features": {
            "advanced_caching": True,
            "parallel_processing": True,
            "model_warmup": True,
            "gpu_optimization": device.type == "cuda",
            "mixed_precision": os.getenv("MIXED_PRECISION", "true").lower() == "true"
        }
    }

if __name__ == "__main__":
    # 환경 변수에서 서버 설정 가져오기
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level=log_level.lower()
    )