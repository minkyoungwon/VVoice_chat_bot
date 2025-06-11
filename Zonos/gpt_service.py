import asyncio
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

@dataclass
class ChatMessage:
    role: str  # "system", "user", "assistant"
    content: str

class GPTService:
    """DeepSeek API를 사용한 GPT 서비스"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            timeout=30.0
        )
        self.conversation_history: Dict[str, List[ChatMessage]] = {}
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def get_conversation_history(self, session_id: str) -> List[ChatMessage]:
        """세션별 대화 기록 가져오기"""
        return self.conversation_history.get(session_id, [])
    
    def add_to_history(self, session_id: str, message: ChatMessage):
        """대화 기록에 메시지 추가"""
        if session_id not in self.conversation_history:
            self.conversation_history[session_id] = []
        
        self.conversation_history[session_id].append(message)
        
        # 대화 기록이 너무 길어지면 오래된 것부터 제거 (시스템 메시지 제외)
        history = self.conversation_history[session_id]
        if len(history) > 20:
            # 시스템 메시지 보존
            system_messages = [msg for msg in history if msg.role == "system"]
            other_messages = [msg for msg in history if msg.role != "system"]
            
            # 최근 16개 메시지만 유지
            recent_messages = other_messages[-16:]
            self.conversation_history[session_id] = system_messages + recent_messages
    
    def clear_history(self, session_id: str):
        """특정 세션의 대화 기록 삭제"""
        if session_id in self.conversation_history:
            del self.conversation_history[session_id]
    
    async def chat_completion(
        self, 
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        model: str = "deepseek-chat",
        max_tokens: int = 200,  # 🔥 짧은 답변을 위해 토큰 수 대폭 감소
        temperature: float = 0.7
    ) -> str:
        """채팅 완성 요청"""
        
        try:
            # 대화 기록 가져오기
            history = self.get_conversation_history(session_id)
            
            # 시스템 프롬프트 설정 (세션 시작 시에만)
            if not history and system_prompt:
                system_msg = ChatMessage(role="system", content=system_prompt)
                self.add_to_history(session_id, system_msg)
                history = [system_msg]
            
            # 사용자 메시지 추가
            user_msg = ChatMessage(role="user", content=user_message)
            self.add_to_history(session_id, user_msg)
            
            # API 요청용 메시지 목록 생성
            messages = [
                {"role": msg.role, "content": msg.content} 
                for msg in history + [user_msg]
            ]
            
            # DeepSeek API 호출
            request_data = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False
            }
            
            logger.info(f"GPT API 요청: {len(messages)}개 메시지")
            
            response = await self.client.post("/chat/completions", json=request_data)
            response.raise_for_status()
            
            response_data = response.json()
            
            if "choices" not in response_data or not response_data["choices"]:
                raise ValueError("GPT API 응답에 choices가 없습니다")
            
            assistant_content = response_data["choices"][0]["message"]["content"]
            
            # 어시스턴트 응답을 기록에 추가
            assistant_msg = ChatMessage(role="assistant", content=assistant_content)
            self.add_to_history(session_id, assistant_msg)
            
            logger.info(f"GPT 응답 완료: {len(assistant_content)}자")
            
            return assistant_content.strip()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"GPT API HTTP 오류: {e.response.status_code} - {e.response.text}")
            raise ValueError(f"GPT API 오류: {e.response.status_code}")
        except httpx.TimeoutException:
            logger.error("GPT API 타임아웃")
            raise ValueError("GPT API 응답 시간 초과")
        except Exception as e:
            logger.error(f"GPT API 호출 오류: {e}")
            raise ValueError(f"GPT 서비스 오류: {str(e)}")

# 글로벌 GPT 서비스 인스턴스
gpt_service: Optional[GPTService] = None

def initialize_gpt_service(api_key: str) -> GPTService:
    """GPT 서비스 초기화"""
    global gpt_service
    gpt_service = GPTService(api_key)
    return gpt_service

def get_gpt_service() -> GPTService:
    """GPT 서비스 인스턴스 가져오기"""
    if gpt_service is None:
        raise ValueError("GPT 서비스가 초기화되지 않았습니다. initialize_gpt_service()를 먼저 호출하세요.")
    return gpt_service

# FastAPI 라우터에 추가할 엔드포인트들
class ChatRequest(BaseModel):
    message: str
    session_id: str
    system_prompt: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    success: bool

def add_gpt_routes(app):
    """GPT 관련 라우터를 FastAPI 앱에 추가"""
    
    @app.post("/api/chat", response_model=ChatResponse)
    async def chat_with_gpt(request: ChatRequest):
        """GPT와 채팅"""
        try:
            gpt = get_gpt_service()
            
            # 🔥 짧은 답변을 위한 시스템 프롬프트
            default_system_prompt = """당신은 친근하고 도움이 되는 AI 어시스턴트입니다.
한국어로 자연스럽고 따뜻하게 대화해주세요.

🎯 중요한 규칙:
- 답변은 반드시 1-2문장으로 간결하게 해주세요
- 길게 설명하지 말고 핵심만 말해주세요
- 불필요한 부연설명은 피해주세요
- 친근하지만 간단명료하게 답변해주세요"""
            
            system_prompt = request.system_prompt or default_system_prompt
            
            response = await gpt.chat_completion(
                session_id=request.session_id,
                user_message=request.message,
                system_prompt=system_prompt
            )
            
            return ChatResponse(
                response=response,
                session_id=request.session_id,
                success=True
            )
            
        except Exception as e:
            logger.error(f"채팅 오류: {e}")
            return ChatResponse(
                response="죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.",
                session_id=request.session_id,
                success=False
            )
    
    @app.get("/api/chat/history/{session_id}")
    async def get_chat_history(session_id: str):
        """채팅 기록 조회"""
        try:
            gpt = get_gpt_service()
            history = gpt.get_conversation_history(session_id)
            
            return {
                "session_id": session_id,
                "history": [
                    {"role": msg.role, "content": msg.content} 
                    for msg in history
                ],
                "success": True
            }
        except Exception as e:
            logger.error(f"채팅 기록 조회 오류: {e}")
            return {"error": str(e), "success": False}
    
    @app.delete("/api/chat/history/{session_id}")
    async def clear_chat_history(session_id: str):
        """채팅 기록 삭제"""
        try:
            gpt = get_gpt_service()
            gpt.clear_history(session_id)
            
            return {
                "session_id": session_id,
                "message": "채팅 기록이 삭제되었습니다.",
                "success": True
            }
        except Exception as e:
            logger.error(f"채팅 기록 삭제 오류: {e}")
            return {"error": str(e), "success": False}
