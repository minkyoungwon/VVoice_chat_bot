# voice_manager.py - 목소리 관리 시스템

import os
import time
import base64
import tempfile
import logging
from typing import Dict, Optional, Any
import torch
import torchaudio
from zonos.model import Zonos

logger = logging.getLogger(__name__)

class VoiceManager:
    """목소리 선택 및 관리 시스템"""
    
    def __init__(self, device: torch.device):
        self.device = device
        self.predefined_voices: Dict[str, str] = {}
        self.user_voice_cache: Dict[str, torch.Tensor] = {}
        self.speaker_embedding_cache: Dict[str, torch.Tensor] = {}
        self.load_predefined_voices()
    
    def load_predefined_voices(self):
        """미리 정의된 목소리들 로드"""
        voice_dir = "assets/voices"
        
        # 기본 목소리 디렉토리 생성
        os.makedirs(voice_dir, exist_ok=True)
        os.makedirs(f"{voice_dir}/user", exist_ok=True)
        
        if os.path.exists(voice_dir):
            for voice_file in os.listdir(voice_dir):
                if voice_file.endswith(('.wav', '.mp3', '.flac')):
                    voice_id = voice_file.split('.')[0]
                    self.predefined_voices[voice_id] = os.path.join(voice_dir, voice_file)
                    logger.info(f"🎤 미리 정의된 목소리 로드: {voice_id}")
        
        # 샘플 목소리가 없으면 안내 메시지
        if not self.predefined_voices:
            logger.warning("⚠️ assets/voices/ 폴더에 목소리 파일이 없습니다.")
            logger.info("💡 .wav, .mp3, .flac 파일을 assets/voices/ 폴더에 추가하세요.")
    
    async def process_voice_request(self, voice_data: dict, model: Zonos) -> Optional[torch.Tensor]:
        """목소리 요청 처리"""
        try:
            # 1. 미리 정의된 목소리 ID 사용
            if "voice_id" in voice_data and voice_data["voice_id"]:
                voice_id = voice_data["voice_id"]
                if voice_id in self.predefined_voices:
                    logger.info(f"🎤 미리 정의된 목소리 사용: {voice_id}")
                    return await self._load_speaker_embedding(self.predefined_voices[voice_id], model, voice_id)
                else:
                    logger.warning(f"⚠️ 존재하지 않는 목소리 ID: {voice_id}")
            
            # 2. Base64 오디오 업로드 처리
            if "voice_audio_base64" in voice_data and voice_data["voice_audio_base64"]:
                logger.info("🎤 Base64 오디오 데이터 처리 중...")
                return await self._process_base64_audio(voice_data["voice_audio_base64"], model)
            
            # 3. 오디오 파일 경로 직접 지정
            if "voice_file_path" in voice_data and voice_data["voice_file_path"]:
                file_path = voice_data["voice_file_path"]
                if os.path.exists(file_path):
                    logger.info(f"🎤 파일 경로로 목소리 로드: {file_path}")
                    return await self._load_speaker_embedding(file_path, model)
            
            # 4. 기본값: 랜덤 목소리 (None 반환)
            logger.info("🎲 랜덤 목소리 사용")
            return None
            
        except Exception as e:
            logger.error(f"❌ 목소리 처리 실패: {e}")
            return None
    
    async def _load_speaker_embedding(self, audio_path: str, model: Zonos, cache_key: str = None) -> torch.Tensor:
        """오디오 파일에서 스피커 임베딩 생성 (캐싱 지원)"""
        cache_key = cache_key or audio_path
        
        # 캐시에서 확인
        if cache_key in self.speaker_embedding_cache:
            logger.info(f"🚀 캐시된 스피커 임베딩 사용: {cache_key}")
            return self.speaker_embedding_cache[cache_key]
        
        try:
            logger.info(f"📥 스피커 임베딩 생성 중: {audio_path}")
            wav, sr = torchaudio.load(audio_path)
            
            # 스테레오를 모노로 변환
            if wav.shape[0] > 1:
                wav = wav.mean(dim=0, keepdim=True)
            
            speaker_embedding = model.make_speaker_embedding(wav, sr)
            speaker_embedding = speaker_embedding.to(self.device, dtype=torch.bfloat16)
            
            # 캐시에 저장
            self.speaker_embedding_cache[cache_key] = speaker_embedding
            logger.info(f"✅ 스피커 임베딩 생성 및 캐시 완료: {cache_key}")
            
            return speaker_embedding
            
        except Exception as e:
            logger.error(f"❌ 스피커 임베딩 생성 실패: {e}")
            raise e
    
    async def _process_base64_audio(self, base64_data: str, model: Zonos) -> torch.Tensor:
        """Base64 오디오 데이터 처리"""
        try:
            # Base64 헤더 제거
            if base64_data.startswith('data:audio'):
                base64_data = base64_data.split(',')[1]
            
            # Base64 디코딩
            audio_bytes = base64.b64decode(base64_data)
            
            # 임시 파일로 저장 후 처리
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            try:
                return await self._load_speaker_embedding(temp_file_path, model)
            finally:
                # 임시 파일 삭제
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"❌ Base64 오디오 처리 실패: {e}")
            raise e
    
    def get_available_voices(self) -> Dict[str, Any]:
        """사용 가능한 목소리 목록 반환"""
        return {
            "predefined_voices": list(self.predefined_voices.keys()),
            "cached_voices": list(self.speaker_embedding_cache.keys()),
            "upload_supported": True,
            "supported_formats": ["wav", "mp3", "flac"],
            "max_file_size_mb": 10,
            "voice_info": {
                voice_id: {
                    "file_path": file_path,
                    "cached": voice_id in self.speaker_embedding_cache
                }
                for voice_id, file_path in self.predefined_voices.items()
            }
        }
    
    async def add_voice_from_file(self, file_content: bytes, filename: str) -> str:
        """파일로부터 새 목소리 추가"""
        try:
            # 고유한 voice_id 생성
            voice_id = f"user_{int(time.time())}_{filename.split('.')[0]}"
            
            # 파일 저장
            file_path = f"assets/voices/user/{voice_id}.wav"
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # 목소리 등록
            self.predefined_voices[voice_id] = file_path
            logger.info(f"✅ 새 목소리 추가됨: {voice_id}")
            
            return voice_id
            
        except Exception as e:
            logger.error(f"❌ 목소리 파일 추가 실패: {e}")
            raise e
    
    def clear_cache(self):
        """스피커 임베딩 캐시 클리어"""
        self.speaker_embedding_cache.clear()
        logger.info("🧹 스피커 임베딩 캐시 클리어됨")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """캐시 통계 반환"""
        return {
            "cached_embeddings": len(self.speaker_embedding_cache),
            "predefined_voices": len(self.predefined_voices),
            "cache_keys": list(self.speaker_embedding_cache.keys())
        }


# 감정 설정 헬퍼 클래스
class EmotionManager:
    """감정 설정 관리"""
    
    EMOTION_PRESETS = {
        "happy": [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.1],
        "sad": [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.1, 0.1],
        "angry": [0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.1, 0.1],
        "surprised": [0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.1, 0.1],
        "neutral": [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3],
        "default": [0.3077, 0.0256, 0.0256, 0.0256, 0.0256, 0.0256, 0.2564, 0.3077]
    }
    
    @staticmethod
    def get_emotion_vector(emotion_preset: str = None, emotion_custom: list = None) -> list:
        """감정 벡터 반환"""
        if emotion_custom:
            return emotion_custom
        elif emotion_preset and emotion_preset in EmotionManager.EMOTION_PRESETS:
            return EmotionManager.EMOTION_PRESETS[emotion_preset]
        else:
            return EmotionManager.EMOTION_PRESETS["default"]
    
    @staticmethod
    def get_available_presets() -> Dict[str, list]:
        """사용 가능한 감정 프리셋 반환"""
        return EmotionManager.EMOTION_PRESETS.copy()
