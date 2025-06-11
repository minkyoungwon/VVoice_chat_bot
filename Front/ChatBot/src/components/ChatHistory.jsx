import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/ChatHistory.css';

const ChatHistory = ({ messages = [] }) => {
  const messagesEndRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages]);

  const getMessageIcon = (role) => {
    const icons = {
      user: '👤',
      assistant: '🤖',
      system: '🔧'
    };
    return icons[role] || '💬';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderEmptyState = () => (
    <div className="empty-chat-state">
      <div className="empty-icon">💬</div>
      <div className="empty-title">대화를 시작해보세요!</div>
      <div className="empty-description">
        아래 '대화하기' 버튼을 눌러 AI와 대화를 시작할 수 있어요
      </div>
      <div className="empty-tips">
        <div className="tip">💡 자연스럽게 말해주세요</div>
        <div className="tip">🎤 조용한 곳에서 사용하면 더 좋아요</div>
        <div className="tip">⚡ 짧고 명확하게 말하면 더 정확해요</div>
      </div>
    </div>
  );

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    return (
      <motion.div
        key={index}
        className={`message-item ${message.role}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <div className="message-avatar">
          <span className="avatar-icon">{getMessageIcon(message.role)}</span>
        </div>

        <div className="message-content">
          <div className="message-header">
            <span className="message-sender">
              {isUser ? '나' : isSystem ? '시스템' : 'AI 어시스턴트'}
            </span>
            <span className="message-time">{formatTime(message.timestamp)}</span>
          </div>

          <div className="message-text">{message.text}</div>

          {message.metadata && (
            <div className="message-metadata">
              {message.metadata.source === 'voice_input' && (
                <span className="meta-tag voice-tag">🎤 음성</span>
              )}
              {message.metadata.type === 'tts_audio' && (
                <span className="meta-tag tts-tag">🔊 음성 답변</span>
              )}
              {message.metadata.model && (
                <span className="meta-tag model-tag">
                  🤖 {message.metadata.model.includes('tiny') ? '빠른 모델' : '표준 모델'}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <motion.button
        className={`chat-toggle-button ${isExpanded ? 'expanded' : 'collapsed'}`}
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={false}
        animate={{
          x: isExpanded ? -370 : 0,
          rotate: isExpanded ? 180 : 0
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <span className="toggle-icon">▶</span>
        <span className="toggle-text">
          {isExpanded ? '대화기록 숨기기' : '대화기록 보기'}
        </span>
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="chat-history"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="chat-header">
              <h3 className="chat-title">
                <span className="title-icon">💬</span>
                대화 기록
              </h3>
              <div className="header-actions">
                <div className="message-count">
                  {messages.length > 0 ? `${messages.length}개 메시지` : '아직 메시지가 없어요'}
                </div>
                <button 
                  className="close-chat-button"
                  onClick={() => setIsExpanded(false)}
                  title="대화기록 닫기"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                renderEmptyState()
              ) : (
                <div className="messages-list">
                  {messages.map((message, index) => renderMessage(message, index))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {messages.length > 0 && (
              <div className="chat-footer">
                <div className="conversation-summary">
                  <span className="summary-item">
                    👤 내 메시지: {messages.filter((m) => m.role === 'user').length}개
                  </span>
                  <span className="summary-item">
                    🤖 AI 답변: {messages.filter((m) => m.role === 'assistant').length}개
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatHistory;
