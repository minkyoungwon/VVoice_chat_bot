import React, { useState, useEffect } from 'react';
import EnhancedAnimatedAvatar from './EnhancedAnimatedAvatar';
import '../styles/EnhancedSidebar.css';

const EnhancedSidebar = ({ 
  isOpen, 
  onToggle, 
  avatarState = 'idle',
  currentMessage = '',
  conversationStats = null,
  onClearHistory = null
}) => {
  const [sessionTime, setSessionTime] = useState('0분');
  
  // 🔥 세션 시간 실시간 업데이트
  useEffect(() => {
    if (!conversationStats?.sessionDuration || conversationStats.sessionDuration === '0분') {
      return;
    }
    
    const interval = setInterval(() => {
      // 실시간 세션 시간 업데이트 로직
      const startTime = Date.now() - (parseInt(conversationStats.sessionDuration) * 60000 || 0);
      const minutes = Math.floor((Date.now() - startTime) / 60000);
      setSessionTime(minutes > 0 ? `${minutes}분` : '방금 시작');
    }, 10000); // 10초마다 업데이트
    
    return () => clearInterval(interval);
  }, [conversationStats?.sessionDuration]);
  
  // 🔥 상태별 메시지 생성
  const getStatusMessage = () => {
    if (currentMessage) return currentMessage;
    
    const messages = {
      idle: '😊 안녕하세요! 대화해볼까요?',
      listening: '🎤 잘 듣고 있어요!',
      thinking: '🤔 답변을 생각하고 있어요...',
      speaking: '🗣️ 답변을 말씀드리고 있어요!'
    };
    
    return messages[avatarState] || messages.idle;
  };
  
  // 🔥 상태별 배경색 계산
  const getBackgroundColor = () => {
    const colors = {
      idle: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      listening: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
      thinking: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)',
      speaking: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
    };
    
    return colors[avatarState] || colors.idle;
  };
  
  return (
    <>
      {/* 🔥 사이드바 토글 버튼 (항상 보임) */}
      <button 
        className={`sidebar-toggle-btn ${isOpen ? 'open' : 'closed'}`}
        onClick={onToggle}
        title={isOpen ? '사이드바 숨기기' : 'AI 어시스턴트 보기'}
      >
        <div className="toggle-icon">
          {isOpen ? '◀' : '🤖'}
        </div>
        {!isOpen && (
          <div className="toggle-pulse"></div>
        )}
      </button>
      
      {/* 🔥 사이드바 메인 */}
      <div 
        className={`enhanced-sidebar ${isOpen ? 'open' : 'closed'}`}
        style={{ '--sidebar-bg': getBackgroundColor() }}
      >
        {/* 사이드바 헤더 */}
        <div className="sidebar-header">
          <div className="header-content">
            <h2 className="sidebar-title">
              <span className="title-icon">🤖</span>
              <span className="title-text">AI 어시스턴트</span>
            </h2>
            <button 
              className="sidebar-close-btn"
              onClick={onToggle}
              title="사이드바 닫기"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* 🔥 아바타 섹션 (메인) */}
        <div className="sidebar-avatar-section">
          <EnhancedAnimatedAvatar 
            state={avatarState}
            message={getStatusMessage()}
            isVisible={isOpen}
            size="large"
          />
        </div>
        
        {/* 🔥 현재 상태 표시 */}
        <div className="current-status-section">
          <div className="status-card">
            <div className="status-header">
              <span className="status-icon">
                {avatarState === 'idle' && '😊'}
                {avatarState === 'listening' && '🎤'}
                {avatarState === 'thinking' && '🤔'}
                {avatarState === 'speaking' && '🗣️'}
              </span>
              <span className="status-label">현재 상태</span>
            </div>
            <div className="status-description">
              {getStatusMessage()}
            </div>
          </div>
        </div>
        
        {/* 🔥 대화 통계 */}
        {conversationStats && (
          <div className="stats-section">
            <h3 className="section-title">📊 대화 통계</h3>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{conversationStats.totalMessages || 0}</div>
                <div className="stat-label">총 대화</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">{conversationStats.userMessages || 0}</div>
                <div className="stat-label">내 말</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">{conversationStats.assistantMessages || 0}</div>
                <div className="stat-label">AI 답변</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">{conversationStats.averageResponseTime || '0'}s</div>
                <div className="stat-label">평균 응답</div>
              </div>
            </div>
            
            <div className="session-info">
              <span className="session-label">세션 시간:</span>
              <span className="session-time">{conversationStats.sessionDuration || '0분'}</span>
            </div>
          </div>
        )}
        
        {/* 🔥 퀵 액션 버튼들 */}
        <div className="actions-section">
          <h3 className="section-title">⚡ 빠른 작업</h3>
          
          <div className="action-buttons">
            {onClearHistory && (
              <button 
                className="action-btn clear-btn"
                onClick={onClearHistory}
                title="대화 기록 지우기"
              >
                <span className="btn-icon">🗑️</span>
                <span className="btn-text">기록 지우기</span>
              </button>
            )}
            
            <button 
              className="action-btn settings-btn"
              title="설정 (준비 중)"
              disabled
            >
              <span className="btn-icon">⚙️</span>
              <span className="btn-text">설정</span>
            </button>
            
            <button 
              className="action-btn help-btn"
              title="도움말 (준비 중)"
              disabled
            >
              <span className="btn-icon">❓</span>
              <span className="btn-text">도움말</span>
            </button>
          </div>
        </div>
        
        {/* 🔥 사용 팁 */}
        <div className="tips-section">
          <h3 className="section-title">💡 사용 팁</h3>
          
          <div className="tips-list">
            <div className="tip-item">
              <span className="tip-icon">🎤</span>
              <span className="tip-text">'대화하기' 버튼으로 연속 대화 시작</span>
            </div>
            
            <div className="tip-item">
              <span className="tip-icon">🛑</span>
              <span className="tip-text">'대화 중지' 버튼으로 언제든 중단 가능</span>
            </div>
            
            <div className="tip-item">
              <span className="tip-icon">💬</span>
              <span className="tip-text">짧고 명확하게 말하면 더 정확해요</span>
            </div>
            
            <div className="tip-item">
              <span className="tip-icon">🔊</span>
              <span className="tip-text">조용한 곳에서 사용하면 더 좋아요</span>
            </div>
          </div>
        </div>
        
        {/* 🔥 사이드바 푸터 */}
        <div className="sidebar-footer">
          <div className="footer-content">
            <div className="version-info">
              <span className="app-name">Zonos AI</span>
              <span className="version">v2.0</span>
            </div>
            <div className="status-indicator">
              <div className={`connection-dot ${avatarState !== 'idle' ? 'active' : 'inactive'}`}></div>
              <span className="connection-text">
                {avatarState !== 'idle' ? '활성' : '대기'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 🔥 모바일 오버레이 */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default EnhancedSidebar;
