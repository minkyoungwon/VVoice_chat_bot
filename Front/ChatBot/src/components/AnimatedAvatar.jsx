// AnimatedAvatar.jsx - 실시간 반응성 강화

import React, { useState, useEffect, useMemo } from 'react';
import './styles/AnimatedAvatar.css';

const AnimatedAvatar = ({ 
  state = 'idle', 
  message = '',
  isVisible = true,
  conversationMode = 'manual', // manual, auto
  cycleCount = 0,
  audioLevel = 0, // 0-1 범위의 오디오 레벨
  responseTime = null // 응답 시간 (초)
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [moodLevel, setMoodLevel] = useState(0.5); // 0-1 범위의 기분 상태
  const [isBlinking, setIsBlinking] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // 🔥 상태별 애니메이션 설정
  const animationConfig = useMemo(() => {
    const configs = {
      idle: {
        frameSpeed: 1500,
        frameCount: 6,
        eyeMovement: true,
        blinkRate: 3000,
        pulseColor: '#4caf50',
        pulseSpeed: 2000
      },
      listening: {
        frameSpeed: 200,
        frameCount: 4,
        eyeMovement: false,
        blinkRate: 1000,
        pulseColor: '#2196f3',
        pulseSpeed: 800
      },
      thinking: {
        frameSpeed: 600,
        frameCount: 3,
        eyeMovement: true,
        blinkRate: 2000,
        pulseColor: '#9c27b0',
        pulseSpeed: 1200
      },
      speaking: {
        frameSpeed: 150,
        frameCount: 6,
        eyeMovement: false,
        blinkRate: 800,
        pulseColor: '#ff9800',
        pulseSpeed: 300
      }
    };
    
    return configs[state] || configs.idle;
  }, [state]);

  // 🔥 프레임 애니메이션 (상태별 최적화)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % animationConfig.frameCount);
    }, animationConfig.frameSpeed);
    
    return () => clearInterval(interval);
  }, [animationConfig]);

  // 🔥 오디오 레벨 기반 펄스 효과
  useEffect(() => {
    if (state === 'listening' && audioLevel > 0) {
      setPulseIntensity(audioLevel);
    } else if (state === 'speaking') {
      // 말할 때 가상의 오디오 레벨 시뮬레이션
      const interval = setInterval(() => {
        setPulseIntensity(0.3 + Math.random() * 0.7);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setPulseIntensity(0.1 + Math.sin(Date.now() / 2000) * 0.1);
    }
  }, [state, audioLevel]);

  // 🔥 자연스러운 눈 움직임
  useEffect(() => {
    if (!animationConfig.eyeMovement) {
      setEyePosition({ x: 0, y: 0 });
      return;
    }

    const moveEyes = () => {
      const intensity = state === 'thinking' ? 8 : 4;
      setEyePosition({
        x: (Math.random() - 0.5) * intensity,
        y: (Math.random() - 0.5) * intensity * 0.6
      });
    };

    const interval = setInterval(moveEyes, 2000 + Math.random() * 3000);
    moveEyes(); // 즉시 실행
    
    return () => clearInterval(interval);
  }, [state, animationConfig.eyeMovement]);

  // 🔥 자연스러운 깜빡임
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    };

    const interval = setInterval(blink, 
      animationConfig.blinkRate + Math.random() * 2000
    );
    
    return () => clearInterval(interval);
  }, [animationConfig.blinkRate]);

  // 🔥 대화 횟수에 따른 기분 변화
  useEffect(() => {
    if (conversationMode === 'auto') {
      // 대화가 많을수록 더 활발해짐
      const newMood = Math.min(0.5 + (cycleCount * 0.05), 0.95);
      setMoodLevel(newMood);
    } else {
      setMoodLevel(0.5);
    }
  }, [conversationMode, cycleCount]);

  // 🔥 상태별 표정 생성 (개선됨)
  const getExpression = () => {
    const expressions = {
      idle: {
        eyes: isBlinking ? '😌' : (moodLevel > 0.7 ? '😊' : '🙂'),
        mouth: moodLevel > 0.8 ? '😄' : '🙂',
        extras: moodLevel > 0.9 ? ['✨'] : []
      },
      listening: {
        eyes: isBlinking ? '😌' : '👂',
        mouth: audioLevel > 0.5 ? '😮' : '😯',
        extras: audioLevel > 0.7 ? ['🎵'] : audioLevel > 0.3 ? ['🎤'] : []
      },
      thinking: {
        eyes: isBlinking ? '😌' : (currentFrame === 0 ? '🤔' : '💭'),
        mouth: '🤨',
        extras: ['💡', '🧩'][currentFrame % 2] ? ['💡'] : ['🧩']
      },
      speaking: {
        eyes: isBlinking ? '😌' : '😊',
        mouth: ['😊', '😄', '🗣️', '😃', '🎯', '✨'][currentFrame],
        extras: pulseIntensity > 0.6 ? ['🎵', '💫'] : ['🎵']
      }
    };

    return expressions[state] || expressions.idle;
  };

  const expression = getExpression();

  // 🔥 상태별 메시지 자동 생성
  const getAutoMessage = () => {
    if (message) return message;

    const autoMessages = {
      idle: conversationMode === 'auto' 
        ? `😊 자동 모드 활성 (${cycleCount}회 대화)`
        : '😊 안녕하세요!',
      listening: audioLevel > 0.5 
        ? '🎤 잘 들리고 있어요!' 
        : '🎤 말씀해 주세요',
      thinking: responseTime 
        ? `🤔 생각 중... (${responseTime.toFixed(1)}초)`
        : '🤔 답변을 생각하고 있어요',
      speaking: '🗣️ 답변을 말씀드리고 있어요'
    };

    return autoMessages[state] || autoMessages.idle;
  };

  // 🔥 CSS 클래스 생성
  const getAvatarClasses = () => {
    const classes = [
      'animated-avatar',
      `avatar-${state}`,
      `frame-${currentFrame}`,
      isVisible ? 'visible' : 'hidden',
      conversationMode === 'auto' ? 'auto-mode' : 'manual-mode'
    ];

    if (moodLevel > 0.8) classes.push('mood-excited');
    else if (moodLevel > 0.6) classes.push('mood-happy');
    else if (moodLevel < 0.3) classes.push('mood-calm');

    return classes.join(' ');
  };

  // 🔥 동적 스타일 계산
  const getDynamicStyles = () => ({
    '--pulse-intensity': pulseIntensity,
    '--pulse-color': animationConfig.pulseColor,
    '--mood-level': moodLevel,
    '--audio-level': audioLevel,
    '--eye-x': `${eyePosition.x}px`,
    '--eye-y': `${eyePosition.y}px`
  });

  return (
    <div 
      className={getAvatarClasses()}
      style={getDynamicStyles()}
    >
      {/* 🔥 향상된 아바타 컨테이너 */}
      <div className="avatar-container">
        {/* 동적 배경 (상태별 색상) */}
        <div className="avatar-background">
          <div className="background-ring pulse-ring"></div>
          <div className="background-ring mood-ring"></div>
        </div>
        
        {/* 메인 아바타 얼굴 */}
        <div className="avatar-face">
          {/* 🔥 오디오 반응 귀 (listening 상태) */}
          {state === 'listening' && (
            <div className="avatar-ears">
              <span className="ear left-ear">👂</span>
              <span className="ear right-ear">👂</span>
              {audioLevel > 0.5 && (
                <div className="audio-waves">
                  <span className="wave wave-1">〰️</span>
                  <span className="wave wave-2">〰️</span>
                </div>
              )}
            </div>
          )}
          
          {/* 🔥 동적 눈 움직임 */}
          <div className="avatar-eyes">
            <span 
              className="eye left-eye"
              style={{
                transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`
              }}
            >
              {expression.eyes}
            </span>
            <span 
              className="eye right-eye"
              style={{
                transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`
              }}
            >
              {expression.eyes}
            </span>
          </div>
          
          {/* 🔥 동적 입 표현 */}
          <div className="avatar-mouth">
            <span className="mouth">{expression.mouth}</span>
          </div>
          
          {/* 🔥 상태별 추가 효과 */}
          {expression.extras && expression.extras.length > 0 && (
            <div className="avatar-extras">
              {expression.extras.map((extra, index) => (
                <span 
                  key={index} 
                  className={`extra extra-${index}`}
                  style={{
                    animationDelay: `${index * 200}ms`
                  }}
                >
                  {extra}
                </span>
              ))}
            </div>
          )}
          
          {/* 🔥 생각 말풍선 (thinking 상태) */}
          {state === 'thinking' && (
            <div className="thought-bubble">
              <div className="thought-content">
                <span className="thought-icon">💭</span>
                {responseTime && (
                  <span className="thought-time">
                    {responseTime.toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* 🔥 향상된 상태 링 */}
        <div className="status-ring-container">
          <div className={`status-ring ${state}`}>
            <div className="ring-pulse"></div>
            <div className="ring-glow"></div>
          </div>
          
          {/* 자동 모드 표시 */}
          {conversationMode === 'auto' && (
            <div className="auto-mode-indicator">
              <span className="auto-icon">🔄</span>
              <span className="auto-count">{cycleCount}</span>
            </div>
          )}
        </div>
        
        {/* 🔥 동적 메시지 말풍선 */}
        <div className="message-bubble">
          <div className="bubble-content">
            {getAutoMessage()}
          </div>
          <div className="bubble-tail"></div>
          
          {/* 오디오 레벨 표시 (listening 상태) */}
          {state === 'listening' && audioLevel > 0 && (
            <div className="audio-level-indicator">
              <div 
                className="level-bar"
                style={{ width: `${audioLevel * 100}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
      
      {/* 🔥 향상된 상태 레이블 */}
      <div className="avatar-status-section">
        <div className="status-label">
          <span className="status-icon">{getExpression().eyes}</span>
          <span className="status-text">
            {state === 'idle' && (conversationMode === 'auto' ? '🔄 자동 대기' : '😊 대기중')}
            {state === 'listening' && '🎤 듣고 있어요'}
            {state === 'thinking' && '🤔 생각중...'}
            {state === 'speaking' && '🗣️ 말하고 있어요'}
          </span>
        </div>
        
        {/* 통계 정보 */}
        {conversationMode === 'auto' && cycleCount > 0 && (
          <div className="conversation-stats">
            <span className="stat-item">
              💬 {cycleCount}회 대화
            </span>
            {responseTime && (
              <span className="stat-item">
                ⚡ {responseTime.toFixed(1)}초 응답
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimatedAvatar;