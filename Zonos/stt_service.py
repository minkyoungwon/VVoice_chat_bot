import asyncio
import io
import logging
import tempfile
import wave
from typing import Optional, Dict, Any
from pathlib import Path

import torch
import torchaudio
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect, UploadFile, File

# Whisper import 시도
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("Warning: Whisper not installed. STT features will be disabled.")
    print("Install with: pip install openai-whisper")

logger = logging.getLogger(__name__)

class WhisperSTTService:
    """Whisper 기반 STT 서비스"""
    
    def __init__(self, model_size: str = "small"): #small #medium
        self.model_size = model_size
        self.model: Optional[Any] = None  # whisper.Whisper
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.available = WHISPER_AVAILABLE
        
    def load_model(self):
        """Whisper 모델 로드"""
        if not self.available:
            logger.warning("Whisper is not available. STT features will be disabled.")
            return
            
        if self.model is None:
            try:
                logger.info(f"Loading Whisper {self.model_size} model...")
                self.model = whisper.load_model(self.model_size, device=self.device)
                logger.info(f"Whisper {self.model_size} model loaded on {self.device}")
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}")
                self.available = False
    
    def transcribe_audio(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        """오디오 데이터를 텍스트로 변환"""
        if not self.available:
            logger.warning("Whisper not available, returning empty transcription")
            return ""
            
        if self.model is None:
            self.load_model()
            
        if not self.available or self.model is None:
            return ""
        
        try:
            # bytes를 numpy array로 변환
            audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Whisper가 요구하는 16kHz로 리샘플링 (필요한 경우)
            if sample_rate != 16000:
                audio_tensor = torch.from_numpy(audio_np).unsqueeze(0)
                audio_tensor = torchaudio.functional.resample(
                    audio_tensor, sample_rate, 16000
                )
                audio_np = audio_tensor.squeeze().numpy()
            
            # 정규화 및 패딩
            audio_np = whisper.pad_or_trim(audio_np)
            
            # 멜 스펙트로그램 생성
            mel = whisper.log_mel_spectrogram(audio_np).to(self.model.device)
            
            # 언어 감지
            _, probs = self.model.detect_language(mel)
            detected_language = max(probs, key=probs.get)
            
            # 텍스트 변환
            options = whisper.DecodingOptions(
                language=detected_language,
                without_timestamps=True,
                fp16=False if self.device == "cpu" else True
            )
            
            result = whisper.decode(self.model, mel, options)
            
            return result.text.strip()
            
        except Exception as e:
            logger.error(f"STT transcription error: {e}")
            return ""
    
    async def transcribe_audio_async(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        """비동기 오디오 변환"""
        if not self.available:
            return ""
            
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.transcribe_audio, audio_data, sample_rate
        )

class STTConnectionManager:
    """STT WebSocket 연결 관리자"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.audio_buffers: Dict[str, bytearray] = {}
        self.stt_service = WhisperSTTService()
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """클라이언트 연결"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.audio_buffers[client_id] = bytearray()
        logger.info(f"Client {client_id} connected to STT WebSocket")
        
        # Whisper 모델 미리 로드 (사용 가능한 경우에만)
        if self.stt_service.available and self.stt_service.model is None:
            await asyncio.get_event_loop().run_in_executor(
                None, self.stt_service.load_model
            )
    
    def disconnect(self, client_id: str):
        """클라이언트 연결 해제"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.audio_buffers:
            del self.audio_buffers[client_id]
        logger.info(f"Client {client_id} disconnected from STT WebSocket")
    
    async def handle_audio_chunk(self, client_id: str, audio_chunk: bytes):
        """오디오 청크 처리"""
        if client_id in self.audio_buffers:
            self.audio_buffers[client_id].extend(audio_chunk)
    
    async def process_final_audio(self, client_id: str, websocket: WebSocket):
        """최종 오디오 처리 및 텍스트 변환"""
        if client_id not in self.audio_buffers:
            await websocket.send_json({"error": "No audio buffer found"})
            return
        
        audio_data = bytes(self.audio_buffers[client_id])
        
        if len(audio_data) == 0:
            await websocket.send_json({"transcript": ""})
            return
        
        try:
            # STT 처리 (Whisper 사용 가능한 경우에만)
            if self.stt_service.available:
                transcript = await self.stt_service.transcribe_audio_async(
                    audio_data, sample_rate=16000
                )
            else:
                # Whisper를 사용할 수 없는 경우 더미 STT (테스트용)
                transcript = self._dummy_stt_for_testing()
                logger.warning("Using dummy STT - Whisper not available")
            
            # 결과 전송
            await websocket.send_json({
                "transcript": transcript,
                "audio_length": len(audio_data),
                "success": True
            })
            
            logger.info(f"STT result for {client_id}: {transcript}")
            
        except Exception as e:
            logger.error(f"STT processing error for {client_id}: {e}")
            await websocket.send_json({
                "error": str(e),
                "success": False
            })
        finally:
            # 버퍼 초기화
            self.audio_buffers[client_id] = bytearray()
    
    def _dummy_stt_for_testing(self) -> str:
        """테스트용 더미 STT - Whisper가 없을 때 사용"""
        import random
        
        # 더미 응답 리스트 (한국어)
        dummy_responses = [
            "안녕하세요",
            "오늘 날씨가 좋네요",
            "좋은 하루 보내세요",
            "고맙습니다",
            "도움이 필요해요",
            "감사합니다",
            "좋은 아이디어네요",
            "이해했습니다",
            "다시 설명해 주세요",
            "정말 좋네요"
        ]
        
        return random.choice(dummy_responses)

# 글로벌 STT 매니저
stt_manager = STTConnectionManager()

def get_stt_service():
    """전역 STT 서비스 인스턴스 반환"""
    return stt_manager.stt_service

async def websocket_stt_endpoint(websocket: WebSocket, client_id: str):
    """STT WebSocket 엔드포인트"""
    await stt_manager.connect(websocket, client_id)
    
    try:
        while True:
            # 바이너리 데이터 수신 (PCM 오디오 청크)
            try:
                data = await websocket.receive()
                
                if "bytes" in data:
                    # 오디오 청크 처리
                    audio_chunk = data["bytes"]
                    await stt_manager.handle_audio_chunk(client_id, audio_chunk)
                    
                elif "text" in data and data["text"] == "end":
                    # 최종 처리 신호
                    await stt_manager.process_final_audio(client_id, websocket)
                    
            except Exception as e:
                logger.error(f"STT WebSocket receive error: {e}")
                await websocket.send_json({"error": "Data receive failed"})
                
    except WebSocketDisconnect:
        stt_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"STT WebSocket connection error: {e}")
        stt_manager.disconnect(client_id)

# FastAPI 앱에 추가할 라우터
def add_stt_routes(app):
    """STT 관련 라우터를 FastAPI 앱에 추가"""
    
    @app.websocket("/ws/stt/{client_id}")
    async def websocket_stt(websocket: WebSocket, client_id: str):
        await websocket_stt_endpoint(websocket, client_id)
    
    @app.get("/api/stt/status")
    async def stt_status():
        """STT 서비스 상태 확인"""
        return {
            "whisper_available": stt_manager.stt_service.available,
            "model_loaded": stt_manager.stt_service.model is not None,
            "model_size": stt_manager.stt_service.model_size,
            "device": stt_manager.stt_service.device,
            "active_connections": len(stt_manager.active_connections),
            "dummy_mode": not stt_manager.stt_service.available
        }
    
    @app.post("/api/stt/test")
    async def test_stt_upload(file: UploadFile = File(...)):
        """파일 업로드를 통한 STT 테스트"""
        try:
            # 업로드된 파일 읽기
            audio_data = await file.read()
            
            # STT 처리
            if stt_manager.stt_service.available:
                transcript = await stt_manager.stt_service.transcribe_audio_async(
                    audio_data, sample_rate=16000
                )
            else:
                transcript = stt_manager.stt_service._dummy_stt_for_testing()
                logger.warning("Using dummy STT - Whisper not available")
            
            return {
                "success": True,
                "transcript": transcript,
                "audio_length": len(audio_data),
                "filename": file.filename,
                "whisper_available": stt_manager.stt_service.available
            }
            
        except Exception as e:
            logger.error(f"STT 테스트 오류: {e}")
            return {
                "success": False,
                "error": str(e)
            }
