import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("Warning: Firebase Admin SDK not installed. Firebase features will be disabled.")

logger = logging.getLogger(__name__)

@dataclass
class ConversationLog:
    session_id: str
    user_id: Optional[str]
    role: str  # "user", "assistant", "system"
    content: str
    content_type: str  # "text", "audio", "system"
    timestamp: datetime
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Firestore 저장용 딕셔너리 변환"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data

class FirebaseService:
    """Firebase Firestore 서비스"""
    
    def __init__(self, credentials_path: Optional[str] = None):
        self.db = None
        self.initialized = False
        
        if not FIREBASE_AVAILABLE:
            logger.warning("Firebase Admin SDK가 설치되지 않았습니다. Firebase 기능이 비활성화됩니다.")
            return
        
        try:
            # Firebase 초기화
            if not firebase_admin._apps:
                if credentials_path and Path(credentials_path).exists():
                    cred = credentials.Certificate(credentials_path)
                    firebase_admin.initialize_app(cred)
                else:
                    # 환경 변수에서 자격 증명 사용
                    firebase_admin.initialize_app()
            
            self.db = firestore.client()
            self.initialized = True
            logger.info("Firebase Firestore 초기화 완료")
            
        except Exception as e:
            logger.error(f"Firebase 초기화 실패: {e}")
            self.initialized = False
    
    def is_available(self) -> bool:
        """Firebase 서비스 사용 가능 여부"""
        return FIREBASE_AVAILABLE and self.initialized
    
    async def save_conversation_log(self, log: ConversationLog) -> Optional[str]:
        """대화 로그 저장"""
        if not self.is_available():
            logger.warning("Firebase가 사용 불가능합니다. 로그를 저장하지 않습니다.")
            return None
        
        try:
            # 비동기 처리를 위해 executor 사용
            loop = asyncio.get_event_loop()
            doc_ref = await loop.run_in_executor(
                None, self._save_log_sync, log
            )
            
            logger.info(f"대화 로그 저장 완료: {doc_ref.id}")
            return doc_ref.id
            
        except Exception as e:
            logger.error(f"대화 로그 저장 실패: {e}")
            return None
    
    def _save_log_sync(self, log: ConversationLog):
        """동기 방식으로 로그 저장 (executor에서 실행)"""
        collection_ref = self.db.collection('conversation_logs')
        doc_ref = collection_ref.add(log.to_dict())
        return doc_ref[1]  # DocumentReference 반환
    
    async def get_conversation_logs(
        self, 
        session_id: str, 
        limit: int = 100
    ) -> List[ConversationLog]:
        """세션별 대화 로그 조회"""
        if not self.is_available():
            return []
        
        try:
            loop = asyncio.get_event_loop()
            logs = await loop.run_in_executor(
                None, self._get_logs_sync, session_id, limit
            )
            
            return logs
            
        except Exception as e:
            logger.error(f"대화 로그 조회 실패: {e}")
            return []
    
    def _get_logs_sync(self, session_id: str, limit: int) -> List[ConversationLog]:
        """동기 방식으로 로그 조회"""
        collection_ref = self.db.collection('conversation_logs')
        query = (collection_ref
                .where('session_id', '==', session_id)
                .order_by('timestamp')
                .limit(limit))
        
        docs = query.stream()
        logs = []
        
        for doc in docs:
            data = doc.to_dict()
            data['timestamp'] = datetime.fromisoformat(data['timestamp'])
            logs.append(ConversationLog(**data))
        
        return logs
    
    async def save_audio_metadata(
        self, 
        session_id: str, 
        audio_url: str, 
        metadata: Dict[str, Any]
    ) -> Optional[str]:
        """오디오 메타데이터 저장"""
        if not self.is_available():
            return None
        
        try:
            audio_data = {
                'session_id': session_id,
                'audio_url': audio_url,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                **metadata
            }
            
            loop = asyncio.get_event_loop()
            doc_ref = await loop.run_in_executor(
                None, self._save_audio_sync, audio_data
            )
            
            logger.info(f"오디오 메타데이터 저장 완료: {doc_ref.id}")
            return doc_ref.id
            
        except Exception as e:
            logger.error(f"오디오 메타데이터 저장 실패: {e}")
            return None
    
    def _save_audio_sync(self, audio_data: Dict[str, Any]):
        """동기 방식으로 오디오 메타데이터 저장"""
        collection_ref = self.db.collection('audio_metadata')
        doc_ref = collection_ref.add(audio_data)
        return doc_ref[1]
    
    async def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """세션 통계 조회"""
        if not self.is_available():
            return {}
        
        try:
            loop = asyncio.get_event_loop()
            stats = await loop.run_in_executor(
                None, self._get_stats_sync, session_id
            )
            
            return stats
            
        except Exception as e:
            logger.error(f"세션 통계 조회 실패: {e}")
            return {}
    
    def _get_stats_sync(self, session_id: str) -> Dict[str, Any]:
        """동기 방식으로 세션 통계 조회"""
        collection_ref = self.db.collection('conversation_logs')
        query = collection_ref.where('session_id', '==', session_id)
        
        docs = list(query.stream())
        
        stats = {
            'total_messages': len(docs),
            'user_messages': 0,
            'assistant_messages': 0,
            'system_messages': 0,
            'start_time': None,
            'end_time': None,
            'duration_minutes': 0
        }
        
        timestamps = []
        
        for doc in docs:
            data = doc.to_dict()
            role = data.get('role', '')
            
            if role == 'user':
                stats['user_messages'] += 1
            elif role == 'assistant':
                stats['assistant_messages'] += 1
            elif role == 'system':
                stats['system_messages'] += 1
            
            if 'timestamp' in data:
                timestamps.append(datetime.fromisoformat(data['timestamp']))
        
        if timestamps:
            timestamps.sort()
            stats['start_time'] = timestamps[0].isoformat()
            stats['end_time'] = timestamps[-1].isoformat()
            stats['duration_minutes'] = (timestamps[-1] - timestamps[0]).total_seconds() / 60
        
        return stats

# 글로벌 Firebase 서비스 인스턴스
firebase_service: Optional[FirebaseService] = None

def initialize_firebase_service(credentials_path: Optional[str] = None) -> FirebaseService:
    """Firebase 서비스 초기화"""
    global firebase_service
    firebase_service = FirebaseService(credentials_path)
    return firebase_service

def get_firebase_service() -> Optional[FirebaseService]:
    """Firebase 서비스 인스턴스 가져오기"""
    return firebase_service

# FastAPI 라우터에 추가할 엔드포인트들
def add_firebase_routes(app):
    """Firebase 관련 라우터를 FastAPI 앱에 추가"""
    
    @app.get("/api/logs/{session_id}")
    async def get_session_logs(session_id: str, limit: int = 100):
        """세션 로그 조회"""
        firebase = get_firebase_service()
        if not firebase or not firebase.is_available():
            return {"error": "Firebase 서비스를 사용할 수 없습니다.", "success": False}
        
        try:
            logs = await firebase.get_conversation_logs(session_id, limit)
            
            return {
                "session_id": session_id,
                "logs": [
                    {
                        "role": log.role,
                        "content": log.content,
                        "content_type": log.content_type,
                        "timestamp": log.timestamp.isoformat(),
                        "metadata": log.metadata
                    }
                    for log in logs
                ],
                "count": len(logs),
                "success": True
            }
            
        except Exception as e:
            logger.error(f"세션 로그 조회 오류: {e}")
            return {"error": str(e), "success": False}
    
    @app.get("/api/stats/{session_id}")
    async def get_session_statistics(session_id: str):
        """세션 통계 조회"""
        firebase = get_firebase_service()
        if not firebase or not firebase.is_available():
            return {"error": "Firebase 서비스를 사용할 수 없습니다.", "success": False}
        
        try:
            stats = await firebase.get_session_stats(session_id)
            
            return {
                "session_id": session_id,
                "statistics": stats,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"세션 통계 조회 오류: {e}")
            return {"error": str(e), "success": False}

# 헬퍼 함수들
async def log_conversation(
    session_id: str,
    role: str,
    content: str,
    content_type: str = "text",
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """대화 로그 기록 헬퍼 함수"""
    firebase = get_firebase_service()
    if not firebase or not firebase.is_available():
        return None
    
    log = ConversationLog(
        session_id=session_id,
        user_id=user_id,
        role=role,
        content=content,
        content_type=content_type,
        timestamp=datetime.now(timezone.utc),
        metadata=metadata or {}
    )
    
    return await firebase.save_conversation_log(log)

async def log_user_message(session_id: str, message: str, metadata: Optional[Dict[str, Any]] = None):
    """사용자 메시지 로그"""
    return await log_conversation(session_id, "user", message, "text", metadata=metadata)

async def log_assistant_message(session_id: str, message: str, metadata: Optional[Dict[str, Any]] = None):
    """어시스턴트 메시지 로그"""
    return await log_conversation(session_id, "assistant", message, "text", metadata=metadata)

async def log_system_message(session_id: str, message: str, metadata: Optional[Dict[str, Any]] = None):
    """시스템 메시지 로그"""
    return await log_conversation(session_id, "system", message, "system", metadata=metadata)

async def log_audio_generation(
    session_id: str, 
    text: str, 
    audio_url: str, 
    tts_metadata: Dict[str, Any]
):
    """오디오 생성 로그"""
    firebase = get_firebase_service()
    if not firebase or not firebase.is_available():
        return None
    
    # 대화 로그에 오디오 메시지 기록
    await log_conversation(
        session_id=session_id,
        role="assistant",
        content=text,
        content_type="audio",
        metadata={
            "audio_url": audio_url,
            **tts_metadata
        }
    )
    
    # 오디오 메타데이터 별도 저장
    return await firebase.save_audio_metadata(session_id, audio_url, tts_metadata)
