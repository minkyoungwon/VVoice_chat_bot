import React, { useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';

const MessageList = () => {
  const { messages, clearMessages } = useChatStore();
  const messagesEndRef = useRef(null);
  
  // 새 메시지가 오면 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const getMessageIcon = (role) => {
    switch (role) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'system': return '⚙️';
      default: return '💬';
    }
  };
  
  const getMessageClass = (role) => {
    switch (role) {
      case 'user': return 'message user-message';
      case 'assistant': return 'message assistant-message';
      case 'system': return 'message system-message';
      default: return 'message';
    }
  };
  
  return (
    <div className="message-list">
      <div className="message-list-header">
        <h3>💬 대화 기록</h3>
        {messages.length > 0 && (
          <button onClick={clearMessages} className="clear-button">
            🗑️ 모두 지우기
          </button>
        )}
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>아직 대화가 없습니다.</p>
            <p>연결 후 음성으로 대화를 시작해보세요!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={getMessageClass(message.role)}>
              <div className="message-header">
                <span className="message-icon">
                  {getMessageIcon(message.role)}
                </span>
                <span className="message-role">
                  {message.role === 'user' ? '사용자' : 
                   message.role === 'assistant' ? '어시스턴트' : '시스템'}
                </span>
                <span className="message-time">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
