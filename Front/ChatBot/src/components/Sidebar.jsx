import React from 'react';
import AnimatedAvatar from './AnimatedAvatar';
import '../styles/Sidebar.css';

const Sidebar = ({ 
  isOpen, 
  onToggle, 
  avatarState = 'idle',
  currentMessage = '',
  conversationStats = null
}) => {
  return (
    <>
      {/* 사이드바 토글 버튼 */}
      <button 
        className={`sidebar-toggle ${isOpen ? 'open' : 'closed'}`}
        onClick={onToggle}
        aria-label={isOpen ? '사이드바 닫기' : '사이드바 열기'}
      >
        <div className="toggle-icon">
          {isOpen ? '◀' : '▶'}
        </div>
        <div className="toggle-text">
          {isOpen ? '숨기기' : 'AI'}
        </div>
      </button>
      
      {/* 사이드바 메인 */}
      <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* 사이드바 헤더 */}
        <div className="sidebar-header">
          <h3 className="sidebar-title">🤖 AI 어시스턴트</h3>
          <button 
            className="sidebar-close-btn"
            onClick={onToggle}
            aria-label="사이드바 닫기"
          >
            ✕
          </button>
        </div>
        
        {/* 아바타 섹션 */}
        <div className="sidebar-avatar-section">
          <AnimatedAvatar 
            state={avatarState}
            message={currentMessage}
            isVisible={isOpen}
          />
        </div>
        
        {/* 상태 정보 */}
        <div className="sidebar-status">
          <div className="status-item">
            <span className="status-label">현재 상태:</span>
            <span className={`status-value ${avatarState}`}>
              {avatarState === 'idle' && '😊 대기 중'}
              {avatarState === 'listening' && '🎤 듣고 있어요'}
              {avatarState === 'thinking' && '🤔 생각 중...'}
              {avatarState === 'speaking' && '🗣️ 말하고 있어요'}
            </span>
          </div>
          
          {conversationStats && (
            <>
              <div className="status-item">
                <span className="status-label">대화 횟수:</span>
                <span className="status-value">{conversationStats.totalMessages || 0}회</span>
              </div>
              
              <div className="status-item">
                <span className="status-label">세션 시간:</span>
                <span className="status-value">{conversationStats.sessionDuration || '0분'}</span>
              </div>
              
              {conversationStats.averageResponseTime && (
                <div className="status-item">
                  <span className="status-label">평균 응답:</span>
                  <span className="status-value">{conversationStats.averageResponseTime}초</span>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* 퀵 액션 버튼들 */}
        <div className="sidebar-actions">
          <div className="action-section">
            <h4 className="action-title">🎯 퀵 액션</h4>
            
            <button className="action-btn" title="대화 기록 지우기">
              🗑️ 기록 지우기
            </button>
            
            <button className="action-btn" title="설정 열기">
              ⚙️ 설정
            </button>
            
            <button className="action-btn" title="도움말">
              ❓ 도움말
            </button>
          </div>
        </div>
        
        {/* 팁 섹션 */}
        <div className="sidebar-tips">
          <h4 className="tips-title">💡 사용 팁</h4>
          <ul className="tips-list">
            <li>🎤 '말하기 시작' 버튼을 눌러 대화를 시작하세요</li>
            <li>🔊 음성이 너무 크거나 작으면 볼륨을 조절해보세요</li>
            <li>⚡ 빠른 응답을 원하면 짧고 명확하게 말해보세요</li>
            <li>🔄 문제가 생기면 연결을 다시 시도해보세요</li>
          </ul>
        </div>
        
        {/* 사이드바 푸터 */}
        <div className="sidebar-footer">
          <div className="version-info">
            <small>Zonos AI v2.0</small>
          </div>
        </div>
      </div>
      
      {/* 사이드바 오버레이 (모바일) */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}
    </>
  );
};

export default Sidebar;
