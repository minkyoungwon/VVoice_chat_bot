import React, { useState, useEffect, useMemo } from 'react';
import '../styles/EnhancedAnimatedAvatar.css';

const EnhancedAnimatedAvatar = ({ 
  state = 'idle', 
  message = '',
  isVisible = true,
  size = 'medium' // small, medium, large
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const [mouthFrame, setMouthFrame] = useState(0);
  
  // 🔥 상태별 이모지 및 애니메이션 설정
  const avatarConfig = useMemo(() => {
    const configs = {
      idle: {
        face: '😊',
        eyes: ['😊', '😌', '🙂'],
        mouth: ['😊', '🙂', '😄'],
        extras: ['✨', '💫'],
        color: '#4caf50',
        animationSpeed: 2000,
        pulseSpeed: 3000,
        description: '기다리고 있어요'
      },
      listening: {
        face: '🎤',
        eyes: ['👂', '👀', '🎧'],
        mouth: ['😯', '😮', '😲'],
        extras: ['🎵', '〰️', '🔊'],
        color: '#2196f3',
        animationSpeed: 500,
        pulseSpeed: 800,
        description: '듣고 있어요'
      },
      thinking: {
        face: '🤔',
        eyes: ['🤔', '💭', '🧠'],
        mouth: ['🤨', '😐', '🤔'],
        extras: ['💡', '❓', '🔍'],
        color: '#9c27b0',
        animationSpeed: 1200,
        pulseSpeed: 1500,
        description: '생각하고 있어요'
      },
      speaking: {
        face: '🗣️',
        eyes: ['😊', '😄', '✨'],
        mouth: ['😄', '🗣️', '😃', '💬'],
        extras: ['💬', '🎯', '✨'],
        color: '#ff9800',
        animationSpeed: 300,
        pulseSpeed: 400,
        description: '말하고 있어요'
      }
    };
    
    return configs[state] || configs.idle;
  }, [state]);
  
  // 🔥 프레임 애니메이션
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % 3);
    }, avatarConfig.animationSpeed);
    
    return () => clearInterval(interval);
  }, [avatarConfig.animationSpeed]);
  
  // 🔥 입 모양 애니메이션 (말할 때)
  useEffect(() => {
    if (state === 'speaking') {
      const interval = setInterval(() => {
        setMouthFrame(prev => (prev + 1) % avatarConfig.mouth.length);
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [state, avatarConfig.mouth.length]);
  
  // 🔥 펄스 효과
  useEffect(() => {
    const interval = setInterval(() => {
      const intensity = state === 'speaking' ? 0.7 + Math.random() * 0.3 :
                      state === 'listening' ? 0.5 + Math.random() * 0.4 :
                      state === 'thinking' ? 0.3 + Math.sin(Date.now() / 1000) * 0.2 :
                      0.2 + Math.sin(Date.now() / 2000) * 0.1;
      
      setPulseIntensity(intensity);
    }, avatarConfig.pulseSpeed / 4);
    
    return () => clearInterval(interval);
  }, [state, avatarConfig.pulseSpeed]);
  
  // 🔥 눈 움직임 (idle, thinking 상태에서만)
  useEffect(() => {
    if (state === 'idle' || state === 'thinking') {
      const moveEyes = () => {
        const intensity = state === 'thinking' ? 6 : 3;
        setEyePosition({
          x: (Math.random() - 0.5) * intensity,
          y: (Math.random() - 0.5) * intensity * 0.5
        });
      };
      
      const interval = setInterval(moveEyes, 2000 + Math.random() * 2000);
      moveEyes();
      
      return () => clearInterval(interval);
    } else {
      setEyePosition({ x: 0, y: 0 });
    }
  }, [state]);
  
  // 🔥 자연스러운 깜빡임
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    };
    
    const blinkRate = state === 'listening' ? 800 :
                     state === 'speaking' ? 600 :
                     state === 'thinking' ? 1500 : 2000;
    
    const interval = setInterval(blink, blinkRate + Math.random() * 1000);
    
    return () => clearInterval(interval);
  }, [state]);
  
  // 🔥 현재 표시할 이모지 계산
  const getCurrentEmoji = () => {
    if (isBlinking) return '😌';
    
    switch (state) {
      case 'listening':
        return avatarConfig.eyes[currentFrame % avatarConfig.eyes.length];
      case 'thinking':
        return avatarConfig.eyes[currentFrame % avatarConfig.eyes.length];
      case 'speaking':
        return avatarConfig.mouth[mouthFrame] || avatarConfig.face;
      default:
        return avatarConfig.face;
    }
  };
  
  // 🔥 추가 효과 이모지
  const getExtraEmoji = () => {
    if (state === 'idle') return null;
    
    const extras = avatarConfig.extras;
    return extras[currentFrame % extras.length];
  };
  
  // 🔥 CSS 클래스 생성
  const getAvatarClasses = () => {
    return [
      'enhanced-animated-avatar',
      `avatar-${state}`,
      `size-${size}`,
      isVisible ? 'visible' : 'hidden'
    ].join(' ');
  };
  
  // 🔥 동적 스타일
  const getAvatarStyles = () => ({
    '--avatar-color': avatarConfig.color,
    '--pulse-intensity': pulseIntensity,
    '--eye-x': `${eyePosition.x}px`,
    '--eye-y': `${eyePosition.y}px`
  });
  
  return (
    <div 
      className={getAvatarClasses()}
      style={getAvatarStyles()}
    >
      {/* 🔥 아바타 컨테이너 */}
      <div className="avatar-container">
        {/* 배경 링 효과 */}
        <div className="background-effects">
          <div className="pulse-ring"></div>
          <div className="glow-ring"></div>
          {state === 'listening' && (
            <div className="sound-waves">
              <div className="wave wave-1"></div>
              <div className="wave wave-2"></div>
              <div className="wave wave-3"></div>
            </div>
          )}
        </div>
        
        {/* 메인 아바타 얼굴 */}
        <div className="avatar-face">
          <div className="main-emoji">
            {getCurrentEmoji()}
          </div>
          
          {/* 추가 효과 이모지 */}
          {getExtraEmoji() && (
            <div className="extra-emoji">
              {getExtraEmoji()}
            </div>
          )}
          
          {/* 특별 효과들 */}
          {state === 'thinking' && (
            <div className="thinking-dots">
              <span className="dot dot-1">•</span>
              <span className="dot dot-2">•</span>
              <span className="dot dot-3">•</span>
            </div>
          )}
          
          {state === 'speaking' && (
            <div className="speech-indicators">
              <div className="speech-bubble">
                <span className="bubble-text">💬</span>
              </div>
            </div>
          )}
          
          {state === 'listening' && (
            <div className="listening-indicator">
              <div className="mic-icon">🎤</div>
              <div className="volume-bars">
                <div className="bar bar-1"></div>
                <div className="bar bar-2"></div>
                <div className="bar bar-3"></div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 🔥 상태 메시지 */}
      {message && (
        <div className="avatar-message">
          <div className="message-bubble">
            <div className="bubble-content">
              {message}
            </div>
            <div className="bubble-arrow"></div>
          </div>
        </div>
      )}
      
      {/* 🔥 상태 레이블 */}
      <div className="avatar-status-label">
        <span className="status-dot"></span>
        <span className="status-text">{avatarConfig.description}</span>
      </div>
    </div>
  );
};

export default EnhancedAnimatedAvatar;
