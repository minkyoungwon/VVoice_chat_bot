import React, { useState, useEffect } from 'react';
import EnhancedSidebar from './components/EnhancedSidebar';
import SimpleVoiceChat from './components/SimpleVoiceChat';
import ChatHistory from './components/ChatHistory';
import useChatStore from './store/chatStore';
import './App.css';

function App() {
  const { isConnected, isRecording, isSpeaking, error, messages } = useChatStore();
  const [sidebarOpen, setSidebarOpen] = useState(false); // 기본적으로 사이드바 숨김
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // 모바일 감지
  
  // 🔥 화면 크기 감지
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // 모바일에서 데스크톱으로 전환 시 사이드바 자동 열기
      if (!mobile && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);
  
  // 🔥 아바타 상태 계산 (더 정확하게)
  const getAvatarState = () => {
    if (!isConnected) return 'idle';
    if (isRecording) return 'listening';
    if (isSpeaking) return 'speaking';
    
    // 마지막 사용자 메시지 이후 AI 응답이 없으면 thinking
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    if (userMessages.length > assistantMessages.length) {
      return 'thinking';
    }
    
    return 'idle';
  };
  
  // 🔥 현재 메시지 계산
  const getCurrentMessage = () => {
    const state = getAvatarState();
    const messageMap = {
      idle: isConnected ? '😊 안녕하세요! 대화해요!' : '😴 연결을 기다리고 있어요',
      listening: '🎤 잘 듣고 있어요!',
      thinking: '🤔 답변을 생각하고 있어요...',
      speaking: '🗣️ 답변을 말씀드리고 있어요!'
    };
    return messageMap[state] || messageMap.idle;
  };
  
  // 🔥 대화 통계 계산
  const getConversationStats = () => {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    
    // 세션 시간 계산
    let sessionDuration = '0분';
    if (sessionStartTime) {
      const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
      sessionDuration = minutes > 0 ? `${minutes}분` : '방금 시작';
    }
    
    // 평균 응답 시간 (임시)
    const avgResponse = assistantMessages > 0 ? '2.1' : '0';
    
    return {
      totalMessages: userMessages + assistantMessages,
      userMessages,
      assistantMessages,
      sessionDuration,
      averageResponseTime: avgResponse
    };
  };
  
  // 🔥 연결 상태 변화 감지
  useEffect(() => {
    if (isConnected && !sessionStartTime) {
      setSessionStartTime(Date.now());
    } else if (!isConnected) {
      setSessionStartTime(null);
    }
  }, [isConnected, sessionStartTime]);
  
  // 🔥 사이드바 토글 핸들러
  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  // 🔥 오버레이 클릭 핸들러 (모바일에서만 동작)
  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };
  
  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* 🔥 개선된 사이드바 */}
      <EnhancedSidebar 
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        avatarState={getAvatarState()}
        currentMessage={getCurrentMessage()}
        conversationStats={getConversationStats()}
        onClearHistory={() => {
          const store = useChatStore.getState();
          store.clearMessages();
        }}
      />
      
      {/* 🔥 모바일 오버레이 - 모바일에서만 표시되고 호버 차단 방지 */}
      {sidebarOpen && isMobile && (
        <div 
          className="sidebar-overlay mobile-only"
          onClick={handleOverlayClick}
          role="button"
          tabIndex={-1}
          aria-label="사이드바 닫기"
        />
      )}
      
      {/* 메인 컨테이너 */}
      <div className={`main-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* 🔥 간단한 헤더 */}
        <header className="app-header">
          <div className="header-left">
            <h1>💬 Zonos AI 대화</h1>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">
                {isConnected ? '연결됨' : '연결 안됨'}
              </span>
            </div>
          </div>
          
          <div className="header-right">
            {/* 사이드바 토글 버튼 (모바일/작은 화면용) */}
            <button 
              className="sidebar-toggle-btn"
              onClick={handleSidebarToggle}
              title={sidebarOpen ? '사이드바 숨기기' : '사이드바 보기'}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
        </header>
        
        {/* 🔥 메인 대화 영역 */}
        <main className="main-content">
          <div className="chat-container">
            {/* 대화 히스토리 */}
            <div className="chat-history-section">
              <ChatHistory messages={messages} />
            </div>
            
            {/* 음성 컨트롤 */}
            <div className="voice-control-section">
              <SimpleVoiceChat />
            </div>
          </div>
        </main>
        
        {/* 🔥 전역 에러 표시 */}
        {error && (
          <div className="global-error">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
              <button 
                className="error-close"
                onClick={() => useChatStore.getState().clearError()}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;