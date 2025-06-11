import asyncio
import json
import logging
import time
from typing import Dict, Optional, Any
import numpy as np
from concurrent.futures import ThreadPoolExecutor

import torch
from fastapi import WebSocket, WebSocketDisconnect

# Zonos 모델 import 추가
from zonos.model import Zonos

# 로깅 설정
logger = logging.getLogger(__name__)

# 🔥 글로벌 스레드 풀 - 병렬 처리용
executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="zonos-")

# 이 함수들은 main.py에서 주입될 예정
model_cache = None
make_cond_dict = None
device = None
log_user_message = None
log_assistant_message = None
log_system_message = None
get_gpt_service = None
get_stt_service = None

def set_dependencies(deps):
    """main.py에서 의존성들을 주입"""
    global model_cache, make_cond_dict, device, log_user_message, log_assistant_message, log_system_message, get_gpt_service, get_stt_service
    model_cache = deps['model_cache']
    make_cond_dict = deps['make_cond_dict']
    device = deps['device']
    log_user_message = deps['log_user_message']
    log_assistant_message = deps['log_assistant_message']
    log_system_message = deps['log_system_message']
    get_gpt_service = deps['get_gpt_service']
    get_stt_service = deps['get_stt_service']

# 📊 성능 모니터링 함수들
def log_performance_metrics(operation: str, start_time: float, **kwargs):
    """성능 메트릭 로깅"""
    duration = time.time() - start_time
    logger.info(f"⏱️ {operation}: {duration:.3f}초")
    
    # GPU 메모리 사용량 로깅
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1024**3
        logger.info(f"🧠 GPU 메모리: {allocated:.2f}GB")

# 🎯 지원 모델 확인 함수
def get_best_model_for_task(requested_model: str = None, task_type: str = "general") -> str:
    """작업에 최적화된 모델 선택"""
    supported_models = [
        "Zyphra/Zonos-v0.1-transformer"  # 🔥 유일한 작동하는 모델
    ]
    
    if requested_model and requested_model in supported_models:
        return requested_model
    
    # 지원되지 않는 모델 처리
    if requested_model:
        if "hybrid" in requested_model.lower() or "tiny" in requested_model.lower():
            logger.warning(f"⚠️ {requested_model}은 지원되지 않습니다. transformer 모델로 대체합니다.")
            return "Zyphra/Zonos-v0.1-transformer"
    
    # 🔥 모든 작업에 동일한 모델 사용 (tiny 모델 없음)
    return "Zyphra/Zonos-v0.1-transformer"

# 대화형 WebSocket 관리자
class ConversationManager:
    def __init__(self):
        self.active_conversations: Dict[str, WebSocket] = {}
        self.conversation_states: Dict[str, Dict[str, Any]] = {}
        self.audio_buffers: Dict[str, bytearray] = {}
        self.performance_stats: Dict[str, Dict] = {}  # 성능 통계
    
    def is_connected(self, client_id: str) -> bool:
        """클라이언트 연결 상태 확인"""
        return client_id in self.active_conversations
    
    async def safe_send_json(self, client_id: str, data: dict) -> bool:
        """안전한 JSON 메시지 전송"""
        if not self.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id}가 연결되어 있지 않음")
            return False
        
        try:
            websocket = self.active_conversations[client_id]
            await websocket.send_json(data)
            return True
        except Exception as e:
            logger.error(f"❌ 메시지 전송 실패 (클라이언트 {client_id}): {e}")
            # 연결이 끊어진 경우 정리
            if client_id in self.active_conversations:
                del self.active_conversations[client_id]
            return False
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_conversations[client_id] = websocket
        self.conversation_states[client_id] = {
            "session_active": True,
            "waiting_for_response": False,
            "current_message": "",
            "language": "ko",
            "preferred_model": "Zyphra/Zonos-v0.1-transformer",  # 기본값을 지원되는 모델로
            "performance_mode": "auto"  # auto, fast, quality
        }
        self.audio_buffers[client_id] = bytearray()
        self.performance_stats[client_id] = {
            "total_requests": 0,
            "avg_stt_time": 0,
            "avg_gpt_time": 0,
            "avg_tts_time": 0,
            "session_start": time.time()
        }
        
        logger.info(f"🔗 Client {client_id} connected to conversation WebSocket")
        logger.info(f"🎯 기본 모델: {self.conversation_states[client_id]['preferred_model']}")
        
        # 🔥 프론트엔드에 연결 완료 신호 전송
        await self.safe_send_json(client_id, {
            "type": "connection_established",
            "event": "connection_established",
            "message": "서버 연결이 완료되었습니다!",
            "server_info": {
                "device": str(device),
                "model": self.conversation_states[client_id]['preferred_model'],
                "gpu_available": torch.cuda.is_available(),
                "status": "ready"
            }
        })
        
        # 연결 시 시스템 메시지 로그
        try:
            await log_system_message(
                client_id, 
                "대화 세션이 시작되었습니다.",
                metadata={
                    "event": "session_start",
                    "device": str(device),
                    "default_model": self.conversation_states[client_id]['preferred_model']
                }
            )
        except Exception as e:
            logger.warning(f"⚠️ Firebase 로깅 실패 (무시): {e}")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_conversations:
            del self.active_conversations[client_id]
        if client_id in self.conversation_states:
            del self.conversation_states[client_id]
        if client_id in self.audio_buffers:
            del self.audio_buffers[client_id]
        if client_id in self.performance_stats:
            # 세션 종료 시 성능 통계 로깅
            stats = self.performance_stats[client_id]
            session_duration = time.time() - stats["session_start"]
            logger.info(f"📊 세션 {client_id} 통계: 요청 {stats['total_requests']}회, 지속시간 {session_duration:.1f}초")
            del self.performance_stats[client_id]
        
        logger.info(f"🔌 Client {client_id} disconnected from conversation WebSocket")

# 🔥 초고속 대화 파이프라인 클래스
class FastConversationPipeline:
    """초고속 대화 파이프라인"""
    
    def __init__(self):
        self.model_cache = {}
        self.preprocessing_cache = {}
        
    async def parallel_stt_gpt_pipeline(self, websocket: WebSocket, client_id: str, audio_data: bytes):
        """STT와 GPT 준비를 병렬로 처리"""
        start_time = time.time()
        
        # 🔥 병렬 작업 정의
        async def fast_stt_task():
            stt_service = get_stt_service()
            return await stt_service.transcribe_audio_async(audio_data, sample_rate=16000)
        
        async def prepare_gpt_task():
            # GPT 서비스 워밍업
            gpt = get_gpt_service()
            return gpt
            
        async def prepare_tts_task():
            # TTS 모델 미리 로드
            tiny_model = "Zyphra/Zonos-v0.1-tiny"
            return model_cache.load_model_if_needed(tiny_model)
        
        # 🔥 3가지 작업을 동시에 실행
        try:
            stt_result, gpt_service, tts_model = await asyncio.gather(
                fast_stt_task(),
                prepare_gpt_task(),
                prepare_tts_task(),
                return_exceptions=True
            )
            
            if isinstance(stt_result, Exception):
                raise stt_result
                
            parallel_time = time.time() - start_time
            logger.info(f"⚡ 병렬 처리 완료: {parallel_time:.2f}초")
            
            return stt_result, gpt_service, tts_model, parallel_time
            
        except Exception as e:
            logger.error(f"❌ 병렬 처리 실패: {e}")
            raise e

    async def ultra_fast_response(self, websocket: WebSocket, client_id: str, transcript: str):
        """초고속 GPT + TTS 응답 생성"""
        
        # 🔥 매우 짧은 응답을 위한 특별 프롬프트  
        ultra_short_prompt = f"3단어 이내로 간단히: {transcript}"
        
        gpt_start = time.time()
        gpt = get_gpt_service()
        
        # 🔥 극도로 제한된 GPT 응답
        response = await gpt.chat_completion(
            session_id=client_id,
            user_message=ultra_short_prompt,
            max_tokens=15,  # 극도로 제한
            temperature=0.3,  # 더 결정적인 응답
            top_p=0.8
        )
        
        gpt_time = time.time() - gpt_start
        logger.info(f"⚡ 초고속 GPT: {gpt_time:.2f}초, 응답: '{response}'")
        
        # 🔥 TTS 즉시 시작 (GPT 완료와 동시에)
        await self.instant_tts_generation(websocket, client_id, response)
        
        return response, gpt_time

    async def instant_tts_generation(self, websocket: WebSocket, client_id: str, text: str):
        """즉시 TTS 생성 - 최소 지연"""
        
        if not text.strip():
            return
            
        tts_start = time.time()
        
        # 🔥 가장 빠른 설정으로 TTS
        tiny_model = model_cache.load_model_if_needed("Zyphra/Zonos-v0.1-tiny")
        
        # 🎤 목소리 처리 (초고속 모드에서도 적용)
        state = conversation_manager.conversation_states.get(client_id, {})
        tts_settings = state.get("tts_settings", {})
        
        from voice_manager import VoiceManager
        voice_manager = VoiceManager(device)
        speaker_embedding = await voice_manager.process_voice_request(tts_settings, tiny_model)
        
        # 🔥 초고속 컨디셔닝 (목소리 적용)
        fast_cond_dict = make_cond_dict(
            text=text,
            language="ko",
            speaker=speaker_embedding,  # 🔥 목소리 임베딩 적용!
            emotion=[0.8, 0.1, 0.1],  # 간소화된 감정
            fmax=16000.0,  # 낮은 주파수 (더 빠름)
            pitch_std=15.0,
            speaking_rate=25.0,  # 빠른 말하기
            device=device,
            unconditional_keys=set()  # 비조건부 키 제거
        )
        
        conditioning = tiny_model.prepare_conditioning(fast_cond_dict)
        
        # 🔥 극도로 최적화된 생성 파라미터
        text_len = len(text.strip())
        max_tokens = min(500, text_len * 40)  # 매우 적은 토큰
        
        codes = tiny_model.generate(
            prefix_conditioning=conditioning,
            max_new_tokens=max_tokens,
            cfg_scale=1.0,  # 낮은 CFG로 빠른 생성
            batch_size=1,
            sampling_params=dict(min_p=0.15, temperature=0.9),
            progress_bar=False,
            disable_torch_compile=True
        )
        
        # 오디오 디코딩
        wav_out = tiny_model.autoencoder.decode(codes).cpu().detach()
        audio_data = wav_out.squeeze().numpy()
        
        # 즉시 전송
        await self.instant_audio_stream(websocket, client_id, audio_data, tiny_model.autoencoder.sampling_rate)
        
        tts_time = time.time() - tts_start
        logger.info(f"⚡ 초고속 TTS: {tts_time:.2f}초")
        
        return tts_time

    async def instant_audio_stream(self, websocket: WebSocket, client_id: str, audio_data, sample_rate: int):
        """즉시 오디오 스트리밍 - 최소 지연"""
        
        # 🔥 더 작은 청크로 더 빠른 스트리밍
        chunk_size = int(sample_rate * 0.02)  # 20ms 청크
        
        # 정규화
        max_val = abs(audio_data).max()
        if max_val > 0:
            audio_data = audio_data / max_val * 0.9
        
        # 16비트 변환
        audio_int16 = (audio_data * 32767).astype('int16')
        
        # 🔥 메타데이터 먼저 전송
        await conversation_manager.safe_send_json(client_id, {
            "event": "instant_audio_start",
            "sr": sample_rate,
            "total_size": len(audio_int16),
            "chunk_size": chunk_size
        })
        
        # 🔥 초고속 스트리밍 (지연 최소화)
        for i in range(0, len(audio_int16), chunk_size):
            chunk = audio_int16[i:i + chunk_size]
            chunk_bytes = chunk.tobytes()
            
            try:
                await websocket.send_bytes(chunk_bytes)
                await asyncio.sleep(0.003)  # 3ms 지연만
            except Exception as e:
                logger.warning(f"⚠️ 즉시 스트리밍 중단: {e}")
                break
        
        # 완료 신호
        await conversation_manager.safe_send_json(client_id, {
            "event": "instant_audio_complete"
        })

conversation_manager = ConversationManager()

async def websocket_conversation(websocket: WebSocket, client_id: str):
    """통합 대화 WebSocket - STT, GPT, TTS를 모두 처리"""
    await conversation_manager.connect(websocket, client_id)
    
    try:
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                message = data["text"]
                
                if message == "stop_recording":
                    await handle_stt_completion(websocket, client_id)
                    
                elif message == "stop_speaking":
                    await conversation_manager.safe_send_json(client_id, {"event": "tts_stopped"})
                    
                elif message.startswith("{"):
                    try:
                        config = json.loads(message)
                        await handle_configuration(websocket, client_id, config)
                    except json.JSONDecodeError:
                        await conversation_manager.safe_send_json(client_id, {"error": "Invalid JSON configuration"})
                        
            elif "bytes" in data:
                await handle_stt_audio_chunk(websocket, client_id, data["bytes"])
                
    except WebSocketDisconnect:
        conversation_manager.disconnect(client_id)
        try:
            await log_system_message(
                client_id, 
                "대화 세션이 종료되었습니다.",
                metadata={"event": "session_end"}
            )
        except Exception as e:
            logger.warning(f"⚠️ Firebase 로깅 실패 (무시): {e}")
    except Exception as e:
        logger.error(f"❌ Conversation WebSocket error: {e}")
        conversation_manager.disconnect(client_id)

async def handle_configuration(websocket: WebSocket, client_id: str, config: Dict[str, Any]):
    """설정 변경 처리"""
    # 연결 상태 확인
    if not conversation_manager.is_connected(client_id):
        logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - 설정 변경 무시")
        return
        
    state = conversation_manager.conversation_states.get(client_id, {})
    
    # 언어 설정
    if "language" in config:
        state["language"] = config["language"]
    
    # TTS 설정
    if "tts_settings" in config:
        state["tts_settings"] = config["tts_settings"]
        
        # 모델 설정도 함께 검증
        if "model" in config["tts_settings"]:
            requested_model = config["tts_settings"]["model"]
            validated_model = get_best_model_for_task(requested_model)
            
            if requested_model != validated_model:
                logger.warning(f"⚠️ 모델 {requested_model} → {validated_model} 변경")
                config["tts_settings"]["model"] = validated_model
                state["tts_settings"]["model"] = validated_model
            
            state["preferred_model"] = validated_model
    
    # 성능 모드 설정
    if "performance_mode" in config:
        performance_mode = config["performance_mode"]
        state["performance_mode"] = performance_mode
        
        # 🔥 성능 모드에 관계없이 동일한 모델 사용 (tiny 모델 없음)
        state["preferred_model"] = "Zyphra/Zonos-v0.1-transformer"
        
        logger.info(f"🎯 성능 모드: {performance_mode}, 모델: {state['preferred_model']}")
    
    # 시스템 프롬프트 설정
    if "system_prompt" in config:
        state["system_prompt"] = config["system_prompt"]
    
    await conversation_manager.safe_send_json(client_id, {
        "event": "config_updated",
        "settings": state,
        "device_info": {
            "device": str(device),
            "gpu_available": torch.cuda.is_available()
        }
    })

async def handle_stt_audio_chunk(websocket: WebSocket, client_id: str, audio_chunk: bytes):
    """STT 오디오 청크 처리"""
    if client_id not in conversation_manager.audio_buffers:
        conversation_manager.audio_buffers[client_id] = bytearray()
    
    conversation_manager.audio_buffers[client_id].extend(audio_chunk)
    logger.debug(f"🎤 오디오 청크 수신: {len(audio_chunk)} bytes, 총: {len(conversation_manager.audio_buffers[client_id])} bytes")

async def handle_stt_completion(websocket: WebSocket, client_id: str):
    """STT 완료 처리 및 GPT 호출"""
    start_time = time.time()
    
    try:
        # 연결 상태 확인
        if not conversation_manager.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - STT 처리 중단")
            return
            
        audio_buffer = conversation_manager.audio_buffers.get(client_id)
        
        if not audio_buffer or len(audio_buffer) == 0:
            await conversation_manager.safe_send_json(client_id, {"event": "stt_empty"})
            return
        
        stt_service = get_stt_service()
        audio_data = bytes(audio_buffer)
        
        logger.info(f"🎤 STT 처리 시작: {len(audio_data)} bytes")
        
        # STT 처리
        if stt_service.available:
            transcript = await stt_service.transcribe_audio_async(
                audio_data, sample_rate=16000
            )
            logger.info(f"✅ STT 처리 완료: {transcript}")
        else:
            transcript = stt_service._dummy_stt_for_testing()
            logger.warning("⚠️ Using dummy STT - Whisper not available")
        
        # 성능 통계 업데이트
        stt_time = time.time() - start_time
        if client_id in conversation_manager.performance_stats:
            stats = conversation_manager.performance_stats[client_id]
            stats["avg_stt_time"] = (stats["avg_stt_time"] * stats["total_requests"] + stt_time) / (stats["total_requests"] + 1)
        
        conversation_manager.audio_buffers[client_id] = bytearray()
        
        if not transcript.strip():
            await conversation_manager.safe_send_json(client_id, {"event": "stt_empty"})
            return
        
        # 연결 상태 재확인
        if not conversation_manager.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - STT 완료 후 처리 중단")
            return
        
        # 사용자 메시지 로그 (원본 텍스트로 로깅, 프리픽스 제외)
        try:
            await log_user_message(
                client_id, 
                transcript,  # 🔥 원본 내용만 로깅 (프리픽스 제외)
                metadata={
                    "source": "voice_input", 
                    "audio_length": len(audio_data),
                    "stt_time": stt_time,
                    "device": str(device),
                    "enhanced_with_prefix": True  # 🔥 프리픽스 추가 플래그
                }
            )
        except Exception as e:
            logger.warning(f"⚠️ Firebase 로깅 실패 (무시): {e}")
        
        # STT 결과 전송
        if not await conversation_manager.safe_send_json(client_id, {
            "event": "stt_completed",
            "transcript": transcript,
            "processing_time": stt_time
        }):
            logger.warning(f"⚠️ STT 결과 전송 실패 - 클라이언트 {client_id} 연결 끊어짐")
            return
        
        # GPT 응답 생성
        await generate_gpt_response(websocket, client_id, transcript)
        
    except Exception as e:
        logger.error(f"❌ STT completion error: {e}")
        await conversation_manager.safe_send_json(client_id, {"error": f"STT processing failed: {str(e)}"})

async def generate_gpt_response(websocket: WebSocket, client_id: str, user_message: str):
    """GPT 응답 생성"""
    start_time = time.time()
    
    try:
        # 연결 상태 확인
        if not conversation_manager.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - GPT 처리 중단")
            return
            
        gpt = get_gpt_service()
        state = conversation_manager.conversation_states.get(client_id, {})
        system_prompt = state.get("system_prompt")
        
        logger.info(f"🤖 GPT 응답 생성 시작")
        
        # GPT 처리 시작 알림
        await conversation_manager.safe_send_json(client_id, {
            "event": "gpt_processing",
            "message": "AI가 응답을 생성하고 있습니다..."
        })
        
        # 🔥 짧은 답변을 위한 프리픽스 추가
        enhanced_message = f"한줄 반 정도로 간단하게 대답해주세요: {user_message}"
        logger.info(f"🎯 프리픽스 추가된 메시지: '{enhanced_message}'")
        
        response = await gpt.chat_completion(
            session_id=client_id,
            user_message=enhanced_message,
            system_prompt=system_prompt,
            max_tokens=100  # 🔥 더욱 짧은 답변을 위해 토큰 수 추가 제한
        )
        
        # 성능 통계 업데이트
        gpt_time = time.time() - start_time
        if client_id in conversation_manager.performance_stats:
            stats = conversation_manager.performance_stats[client_id]
            stats["avg_gpt_time"] = (stats["avg_gpt_time"] * stats["total_requests"] + gpt_time) / (stats["total_requests"] + 1)
        
        logger.info(f"✅ GPT 짧은 응답 생성 완료: {gpt_time:.2f}초, 응답 길이: {len(response)}자")
        
        # 연결 상태 재확인
        if not conversation_manager.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - GPT 완료 후 처리 중단")
            return
        
        # 어시스턴트 메시지 로그
        try:
            await log_assistant_message(
                client_id,
                response,
                metadata={
                    "source": "gpt_response", 
                    "model": "deepseek-chat",
                    "gpt_time": gpt_time,
                    "device": str(device),
                    "response_length": len(response),  # 🔥 응답 길이 추가
                    "short_response_mode": True  # 🔥 짧은 답변 모드 플래그
                }
            )
        except Exception as e:
            logger.warning(f"⚠️ Firebase 로깅 실패 (무시): {e}")
        
        # GPT 짧은 응답 전송
        if not await conversation_manager.safe_send_json(client_id, {
            "event": "gpt_response",
            "response": response,
            "processing_time": gpt_time,
            "response_length": len(response),  # 🔥 응답 길이 정보 추가
            "mode": "short_response"  # 🔥 짧은 답변 모드 표시
        }):
            logger.warning(f"⚠️ GPT 짧은 응답 전송 실패 - 클라이언트 {client_id} 연결 끊어짐")
            return
        
        # 자동으로 TTS 생성 (짧은 응답 버전)
        await generate_tts_response(websocket, client_id, response)
        
    except Exception as e:
        logger.error(f"❌ GPT response error: {e}")
        await conversation_manager.safe_send_json(client_id, {"error": f"GPT processing failed: {str(e)}"})

async def generate_tts_response(websocket: WebSocket, client_id: str, text: str):
    """TTS 응답 생성 - 단순화 및 안정성 향상"""
    start_time = time.time()
    
    try:
        if not text.strip():
            logger.warning(f"⚠️ Empty text for TTS generation for client {client_id}")
            return
        
        logger.info(f"🎵 TTS 생성 시작 (client {client_id}): '{text[:50]}...'")
        
        # 대화 상태에서 설정 가져오기
        state = conversation_manager.conversation_states.get(client_id, {})
        tts_settings = state.get("tts_settings", {})
        language = state.get("language", "ko")
        performance_mode = state.get("performance_mode", "auto")
        
        # 모델 선택
        requested_model = tts_settings.get("model") or state.get("preferred_model")
        # 🔥 모든 모드에서 동일한 모델 사용
        model_choice = get_best_model_for_task(requested_model, "general")
        
        logger.info(f"🎯 TTS 모델 선택: {model_choice} (모드: {performance_mode})")
        
        # 연결 상태 확인
        if not conversation_manager.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - TTS 처리 중단")
            return
        
        # TTS 시작 알림
        await conversation_manager.safe_send_json(client_id, {
            "event": "tts_progress",
            "progress": 10,
            "message": f"TTS 모델 로딩... ({model_choice})",
            "model": model_choice
        })
        
        # 모델 로드
        model = model_cache.load_model_if_needed(model_choice)
        logger.info(f"✅ Model loaded successfully: {model_choice}")
        
        # 🎤 목소리 관리자를 통한 스피커 임베딩 처리
        from voice_manager import VoiceManager
        voice_manager = VoiceManager(device)
        
        # 목소리 설정 처리
        speaker_embedding = await voice_manager.process_voice_request(tts_settings, model)
        
        logger.info(f"🎤 목소리 처리 결과: {'커스텀 목소리' if speaker_embedding is not None else '기본 목소리'}")
        
        # 컨디셔닝 설정 - 음질 개선 및 목소리 적용
        improved_emotion = tts_settings.get("emotion", [0.7, 0.05, 0.05, 0.05, 0.1, 0.05, 0.3, 0.15])
        cond_dict = make_cond_dict(
            text=text,
            language=language,
            speaker=speaker_embedding,  # 🔥 목소리 임베딩 적용!
            emotion=improved_emotion,
            fmax=tts_settings.get("fmax", 24000.0),
            pitch_std=tts_settings.get("pitch_std", 30.0),
            speaking_rate=tts_settings.get("speaking_rate", 20.0),
            vqscore_8=tts_settings.get("vqscore_8", [0.9] * 8),
            dnsmos_ovrl=tts_settings.get("dnsmos_ovrl", 4.5),
            device=device,
            unconditional_keys={"vqscore_8", "dnsmos_ovrl"}
        )
        
        conditioning = model.prepare_conditioning(cond_dict)
        logger.info(f"🎛️ Conditioning prepared for language: {language}")
        
        # 오디오 생성 시작 알림
        await conversation_manager.safe_send_json(client_id, {
            "event": "tts_progress",
            "progress": 50,
            "message": "음성 생성 중..."
        })
        
        # 🔥 오디오 생성 - 파라미터 최적화
        generation_start = time.time()
        # 텍스트 길이 기준으로 토큰 수 계산 (한글자당 약 80-120 토큰)
        text_length = len(text.strip())
        min_tokens_per_char = 80
        max_tokens_per_char = 120
        estimated_tokens = text_length * min_tokens_per_char
        max_new_tokens = min(86 * 30, max(estimated_tokens, text_length * max_tokens_per_char))
        
        logger.info(f"🎯 토큰 계산: 텍스트 길이={text_length}, 예상 토큰={estimated_tokens}, max_new_tokens={max_new_tokens}")
        
        cfg_scale = tts_settings.get("cfg_scale", 1.5)  # CFG 스케일 더 낮춤
        
        codes = model.generate(
            prefix_conditioning=conditioning,
            audio_prefix_codes=None,
            max_new_tokens=max_new_tokens,
            cfg_scale=cfg_scale,
            batch_size=1,
            sampling_params=dict(
                min_p=0.05,
                temperature=0.85,
                top_k=40
            ),
            progress_bar=False,
            disable_torch_compile=True,
        )
        
        generation_time = time.time() - generation_start
        logger.info(f"✅ Audio codes generated in {generation_time:.2f}s: {codes.shape}")
        
        # 오디오 디코딩
        decode_start = time.time()
        wav_out = model.autoencoder.decode(codes).cpu().detach()
        if wav_out.dim() == 2 and wav_out.size(0) > 1:
            wav_out = wav_out[0:1, :]
        
        audio_data = wav_out.squeeze().numpy()
        decode_time = time.time() - decode_start
        
        total_time = generation_time + decode_time
        audio_duration = len(audio_data) / model.autoencoder.sampling_rate
        rtf = total_time / audio_duration if audio_duration > 0 else 0
        
        logger.info(f"🎶 오디오 디코딩 완료: {audio_data.shape}, 지속시간: {audio_duration:.2f}s, RTF: {rtf:.2f}")
        
        # 🔥 오디오 품질 개선 처리 및 디버깅 강화
        max_val = np.abs(audio_data).max()
        logger.info(f"🔍 원본 오디오 데이터 분석: max={max_val:.6f}, 길이={len(audio_data)}, 샘플 미리보기={audio_data[:10]}")
        
        if max_val > 0:
            # 더 부드러운 정규화
            audio_data = audio_data / max_val
            audio_data = np.tanh(audio_data * 0.9) * 0.8  # soft limiting
            audio_data = audio_data - np.mean(audio_data)  # DC 제거
            logger.info(f"🎛️ 정규화 후 오디오: max={np.abs(audio_data).max():.6f}, mean={np.mean(audio_data):.6f}")
        else:
            logger.warning(f"⚠️ 오디오 데이터가 무음입니다! max_val={max_val}")
            # 무음 데이터인 경우 작은 테스트 톤을 생성
            logger.info("🎵 테스트 톤 생성 중...")
            sr_out = model.autoencoder.sampling_rate
            duration = 0.5  # 0.5초
            t = np.linspace(0, duration, int(sr_out * duration))
            audio_data = 0.1 * np.sin(2 * np.pi * 440 * t)  # 440Hz 테스트 톤
            logger.info(f"🎵 테스트 톤 생성됨: max={np.abs(audio_data).max():.6f}, 길이={len(audio_data)}")
        
        # PCM 16-bit 변환
        audio_int16 = np.clip(audio_data * 32767, -32768, 32767).astype('int16')
        logger.info(f"📊 PCM 16-bit 변환: max={np.abs(audio_int16).max()}, 샘플 미리보기={audio_int16[:10]}")
        
        # 🔥 JSON 방식으로 간단히 전송 - 디버깅 강화
        import base64
        audio_bytes = audio_int16.tobytes()
        logger.info(f"📊 오디오 바이트 배열 생성: 길이={len(audio_bytes)}, 처음 20바이트={audio_bytes[:20]}")
        
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        logger.info(f"📦 Base64 인코딩 완료: 길이={len(audio_base64)}, 처음 50문자={audio_base64[:50]}...")
        
        # TTS 시작 신호 먼저 전송
        sr_out = model.autoencoder.sampling_rate
        if not await conversation_manager.safe_send_json(client_id, {
            "event": "tts_started",
            "sr": int(sr_out),
            "dtype": "int16",
            "text": text,
            "model": model_choice
        }):
            return
        
        logger.info(f"📡 오디오 데이터 전송 시작: {len(audio_bytes)} bytes")
        
        # 오디오 데이터 전송
        audio_message = {
            "event": "audio_data_complete",
            "audio_data": audio_base64,
            "sample_rate": int(sr_out),
            "duration": audio_duration,
            "rtf": rtf,
            "generation_time": total_time,
            "model": model_choice,
            "format": "pcm_int16_base64"
        }
        
        # 연결 상태 재확인 후 전송
        if not conversation_manager.is_connected(client_id):
            logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - 오디오 전송 중단")
            return
        
        if not await conversation_manager.safe_send_json(client_id, audio_message):
            logger.warning(f"⚠️ 오디오 데이터 전송 실패")
            return
        
        # 성능 통계 업데이트
        tts_time = time.time() - start_time
        if client_id in conversation_manager.performance_stats:
            stats = conversation_manager.performance_stats[client_id]
            stats["avg_tts_time"] = (stats["avg_tts_time"] * stats["total_requests"] + tts_time) / (stats["total_requests"] + 1)
            stats["total_requests"] += 1
        
        # 완료 신호
        await conversation_manager.safe_send_json(client_id, {
            "event": "tts_completed",
            "processing_time": tts_time,
            "model": model_choice,
            "device": str(device),
            "performance": "🚀 실시간" if tts_time < 1.0 else "⚠️ 느림"
        })
        
        logger.info(f"✅ TTS generation completed for client {client_id} in {tts_time:.2f}s")
        
        # Firebase에 TTS 로그
        try:
            await log_assistant_message(
                client_id,
                text,
                metadata={
                    "type": "tts_audio",
                    "model": model_choice,
                    "language": language,
                    "tts_params": tts_settings,
                    "tts_time": tts_time,
                    "device": str(device),
                    "performance_mode": performance_mode,
                    "rtf": rtf,
                    "audio_duration": audio_duration
                }
            )
        except Exception as e:
            logger.warning(f"⚠️ Firebase 로깅 실패 (무시): {e}")
        
    except Exception as e:
        logger.error(f"❌ TTS generation error for client {client_id}: {e}")
        await conversation_manager.safe_send_json(client_id, {"error": f"TTS generation failed: {str(e)}"})


async def stream_conversation_audio(
    client_id: str,
    websocket: WebSocket,
    model: Zonos,
    conditioning: torch.Tensor,
    tts_settings: Dict[str, Any],
    model_name: str = "unknown",
    original_text: str = ""  # 원본 텍스트 추가
):
    """대화용 오디오 스트리밍 - 중복 방지 및 효율성 개선"""
    import numpy as np
    generation_start = time.time()
    
    try:
        logger.info(f"🎵 오디오 생성 시작 (모델: {model_name})")
        
        # 🔥 이전 스트리밍 중단 신호 먼저 전송
        await conversation_manager.safe_send_json(client_id, {
            "event": "audio_stop_previous",
            "message": "이전 오디오 스트리밍 중단 중..."
        })
        
        # 오디오 생성 파라미터 최적화 - 원본 텍스트 길이 사용
        if original_text.strip():
            text_length = len(original_text.strip())
        else:
            # 폴백: conditioning 기반 추정
            text_length = max(4, len(str(conditioning)) // 100)
            
        min_tokens_per_char = 85
        max_tokens_per_char = 130
        estimated_tokens = text_length * min_tokens_per_char
        max_new_tokens = min(86 * 30, max(estimated_tokens, text_length * max_tokens_per_char))
        
        logger.info(f"🎯 스트리밍 토큰 계산: 텍스트 길이={text_length}, max_new_tokens={max_new_tokens}, 원본 텍스트='{original_text[:20]}...'")
        
        cfg_scale = tts_settings.get("cfg_scale", 1.8)  # 🔥 CFG 스케일 낮춤 (품질 vs 속도)
        
        batch_size = 1
        
        codes = model.generate(
            prefix_conditioning=conditioning,
            audio_prefix_codes=None,
            max_new_tokens=max_new_tokens,
            cfg_scale=cfg_scale,
            batch_size=batch_size,
            sampling_params=dict(
                min_p=0.08,  # 🔥 min_p 조정으로 품질 개선
                temperature=0.7  # 🔥 온도 추가로 더 자연스럽게
            ),
            progress_bar=False,
            disable_torch_compile=True,  # 컴파일 비활성화 (안정성)
        )
        
        generation_time = time.time() - generation_start
        logger.info(f"✅ Audio codes generated in {generation_time:.2f}s: {codes.shape}")
        
        # 오디오 디코딩
        decode_start = time.time()
        wav_out = model.autoencoder.decode(codes).cpu().detach()
        if wav_out.dim() == 2 and wav_out.size(0) > 1:
            wav_out = wav_out[0:1, :]
        
        audio_data = wav_out.squeeze().numpy()
        decode_time = time.time() - decode_start
        
        total_time = generation_time + decode_time
        audio_duration = len(audio_data) / model.autoencoder.sampling_rate
        rtf = total_time / audio_duration if audio_duration > 0 else 0
        
        logger.info(f"🎶 오디오 디코딩 완료: {audio_data.shape}, 지속시간: {audio_duration:.2f}s, RTF: {rtf:.2f}")
        
        # 🔥 오디오 품질 개선 - 정규화 및 노이즈 제거
        # 볼륨 정규화
        max_val = np.abs(audio_data).max()
        if max_val > 0:
            audio_data = audio_data / max_val * 0.8  # 80%로 제한하여 클리핑 방지
        
        # 🔥 청크 단위로 전송 - 더 큰 청크로 안정성 향상
        sr = model.autoencoder.sampling_rate
        chunk_duration = 0.3  # 🔥 0.3초로 청크 크기 증가 (안정성 향상)
        chunk_size = int(sr * chunk_duration)
        total_chunks = (len(audio_data) + chunk_size - 1) // chunk_size
        
        logger.info(f"📡 스트리밍 시작: {total_chunks} 청크 (청크 크기: {chunk_size})")
        
        # 🔥 스트리밍 시작 메시지에 고유 ID 추가
        stream_id = f"stream_{client_id}_{int(time.time() * 1000)}"
        await conversation_manager.safe_send_json(client_id, {
            "event": "audio_stream_start",
            "stream_id": stream_id,
            "total_chunks": total_chunks,
            "sample_rate": int(sr),
            "model": model_name,
            "rtf": rtf
        })
        
        for i in range(0, len(audio_data), chunk_size):
            chunk = audio_data[i:i + chunk_size]
            chunk_index = i // chunk_size
            
            # PCM 16-bit 변환
            chunk_int16 = (chunk * 32767).astype('int16')
            
            # 🔥 바이너리 데이터로 전송 (JSON 비효율성 해결)
            # 메타데이터 먼저 전송
            metadata = {
                "event": "audio_chunk_meta",
                "stream_id": stream_id,
                "chunk_index": chunk_index,
                "total_chunks": total_chunks,
                "sample_rate": int(sr),
                "chunk_size": len(chunk_int16),
                "model": model_name,
                "rtf": rtf,
                "is_final_chunk": chunk_index == total_chunks - 1
            }
            
            # 연결 상태 확인 후 전송
            if not conversation_manager.is_connected(client_id):
                logger.warning(f"⚠️ 클라이언트 {client_id} 연결 끊어짐 - 오디오 스트리밍 중단")
                break
            
            # 메타데이터 전송
            if not await conversation_manager.safe_send_json(client_id, metadata):
                logger.warning(f"⚠️ 오디오 메타데이터 전송 실패 - 스트리밍 중단")
                break
                
            # 🔥 바이너리 오디오 데이터 전송 (효율적) - 디버깅 강화
            try:
                chunk_bytes = chunk_int16.tobytes()
                logger.debug(f"📤 바이너리 오디오 청크 전솤: {len(chunk_bytes)} bytes, 청크 {chunk_index + 1}/{total_chunks}")
                await websocket.send_bytes(chunk_bytes)
                logger.debug(f"✅ 바이너리 오디오 청크 전송 성공: {chunk_index + 1}/{total_chunks}")
            except Exception as e:
                logger.warning(f"⚠️ 오디오 바이너리 전송 실패: {e}")
                break
            
            logger.debug(f"📤 청크 전송 {chunk_index + 1}/{total_chunks}")
            
            # 🔥 적응형 지연 개선 - RTF 기반
            if rtf < 0.3:
                delay = 0.02  # 매우 빠름
            elif rtf < 0.7:
                delay = 0.05  # 빠름
            else:
                delay = 0.1   # 일반
            
            await asyncio.sleep(delay)
        
        # 🔥 스트리밍 완료 메시지
        await conversation_manager.safe_send_json(client_id, {
            "event": "audio_stream_complete",
            "stream_id": stream_id,
            "total_chunks_sent": total_chunks,
            "total_duration": audio_duration,
            "generation_time": total_time,
            "rtf": rtf
        })
        
        logger.info(f"✅ 오디오 스트리밍 완료: {total_chunks} 청크, RTF: {rtf:.2f}")
            
    except Exception as e:
        logger.error(f"❌ Conversation audio streaming error: {e}")
        await conversation_manager.safe_send_json(client_id, {
            "error": f"Audio streaming failed: {str(e)}",
            "event": "audio_stream_error"
        })

def add_conversation_routes(app):
    """FastAPI 앱에 대화형 WebSocket 라우터 추가"""
    
    @app.websocket("/ws/conversation/{client_id}")
    async def websocket_conversation_route(websocket: WebSocket, client_id: str):
        await websocket_conversation(websocket, client_id)


# 🔥 초고속 대화 파이프라인 인스턴스
fast_pipeline = FastConversationPipeline()

# 🔥 기존 함수를 대체하는 초고속 버전
async def ultra_fast_stt_completion(websocket: WebSocket, client_id: str):
    """초고속 STT 완료 처리"""
    
    total_start = time.time()
    
    try:
        audio_buffer = conversation_manager.audio_buffers.get(client_id)
        if not audio_buffer or len(audio_buffer) == 0:
            return
        
        audio_data = bytes(audio_buffer)
        conversation_manager.audio_buffers[client_id] = bytearray()
        
        # 🔥 병렬 처리로 STT, GPT, TTS 준비
        transcript, gpt_service, tts_model, parallel_time = await fast_pipeline.parallel_stt_gpt_pipeline(
            websocket, client_id, audio_data
        )
        
        if not transcript.strip():
            return
        
        logger.info(f"⚡ STT 결과: '{transcript}' ({parallel_time:.2f}초)")
        
        # STT 결과 즉시 전송
        await conversation_manager.safe_send_json(client_id, {
            "event": "ultra_fast_stt",
            "transcript": transcript,
            "processing_time": parallel_time
        })
        
        # 🔥 초고속 GPT + TTS (병렬 처리 결과 활용)
        response, gpt_time = await fast_pipeline.ultra_fast_response(websocket, client_id, transcript)
        
        total_time = time.time() - total_start
        logger.info(f"🚀 전체 대화 파이프라인: {total_time:.2f}초 (목표: <0.5초)")
        
        # 성능 메트릭 전송
        await conversation_manager.safe_send_json(client_id, {
            "event": "ultra_fast_complete",
            "total_time": total_time,
            "stt_time": parallel_time,
            "gpt_time": gpt_time,
            "performance": "🚀 초고속" if total_time < 0.5 else "⚡ 고속"
        })
        
    except Exception as e:
        logger.error(f"❌ 초고속 처리 실패: {e}")
        await conversation_manager.safe_send_json(client_id, {"error": str(e)})
