import React, { useState, useEffect } from 'react';
import '../styles/UnifiedProgressBar.css';

const UnifiedProgressBar = ({
  stage = 'idle',          // idle, stt, gpt, tts
  progress = 0,            // 0-100
  message = '',
  subMessage = '',
  status = '',             // 새로 추가: 상태 메시지
  variant = 'default',     // 새로 추가: default, venom
  isVisible = false,
  processingTime = 0,
  estimatedDuration = 0
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [stageIcon, setStageIcon] = useState('⚡');
  const [stageColor, setStageColor] = useState('#667eea');

  // 프로그래스 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  // 단계별 스타일 설정
  useEffect(() => {
    if (variant === 'venom') {
      // 베놈 테마 스타일
      switch (stage) {
        case 'stt':
          setStageIcon('👁️');
          setStageColor('#ff6b6b');
          break;
        case 'gpt':
          setStageIcon('🧠');
          setStageColor('#ff4757');
          break;
        case 'tts':
          setStageIcon('🗣️');
          setStageColor('#ff3742');
          break;
        default:
          setStageIcon('💀');
          setStageColor('#ff6b6b');
      }
    } else {
      // 기본 테마 스타일
      switch (stage) {
        case 'stt':
          setStageIcon('🎤');
          setStageColor('#ed8936');
          break;
        case 'gpt':
          setStageIcon('🤖');
          setStageColor('#4299e1');
          break;
        case 'tts':
          setStageIcon('🔊');
          setStageColor('#48bb78');
          break;
        default:
          setStageIcon('⚡');
          setStageColor('#667eea');
      }
    }
  }, [stage, variant]);

  // 단계별 제목
  const getStageTitle = () => {
    if (variant === 'venom') {
      switch (stage) {
        case 'stt': return '베놈이 듣고 있다';
        case 'gpt': return '베놈이 생각한다';
        case 'tts': return '베놈이 말한다';
        default:    return '베놈이 준비 중';
      }
    } else {
      switch (stage) {
        case 'stt': return '음성 인식 중';
        case 'gpt': return 'AI 응답 생성 중';
        case 'tts': return '음성 합성 중';
        default:    return '처리 중';
      }
    }
  };

  // 예상 시간 포맷
  const formatTime = (seconds) => {
    if (seconds < 1) return '곧 완료';
    if (seconds < 60) return `${seconds.toFixed(1)}초`;
    return `${Math.floor(seconds / 60)}분 ${(seconds % 60).toFixed(0)}초`;
  };

  if (!isVisible) return null;

  return (
    <div className={`unified-progress-bar ${stage} ${variant} ${isVisible ? 'visible' : 'hidden'}`}>
      {/* 헤더 */}
      <div className="progress-header">
        <div className="stage-info">
          <span className="stage-icon" style={{ color: stageColor }}>
            {stageIcon}
          </span>
          <span className="stage-title">{getStageTitle()}</span>
        </div>

        <div className="progress-stats">
          {processingTime > 0 && (
            <span className="processing-time">{formatTime(processingTime)}</span>
          )}
          {estimatedDuration > 0 && (
            <span className="estimated-time">/ ~{formatTime(estimatedDuration)}</span>
          )}
        </div>
      </div>

      {/* 메인 바 */}
      <div className="progress-container">
        <div className="progress-track" style={{ backgroundColor: `${stageColor}20` }}>
          <div
            className="progress-fill"
            style={{
              width: `${animatedProgress}%`,
              backgroundColor: stageColor,
              boxShadow: `0 0 10px ${stageColor}40`
            }}>
            <div className="progress-shine"></div>
          </div>
        </div>

        <div className="progress-percentage">
          <span>{Math.round(animatedProgress)}%</span>
        </div>
      </div>

      {/* 메시지 */}
      {(message || status) && (
        <div className="progress-message">
          <div className="main-message">{message || status}</div>
          {subMessage && <div className="sub-message">{subMessage}</div>}
        </div>
      )}

      {/* 단계별 세부 정보 */}
      <div className="stage-details">
        {variant === 'venom' ? (
          // 베놈 테마 메시지
          <>
            {stage === 'stt' && (
              <div className="detail-info venom-detail">
                <span className="detail-icon">👂</span>
                <span className="detail-text">베놈이 당신의 음성을 분석하고 있다...</span>
              </div>
            )}
            {stage === 'gpt' && (
              <div className="detail-info venom-detail">
                <span className="detail-icon">🧠</span>
                <span className="detail-text">베놈의 어둠의 지식으로 답변을 준비한다...</span>
              </div>
            )}
            {stage === 'tts' && (
              <div className="detail-info venom-detail">
                <span className="detail-icon">💀</span>
                <span className="detail-text">베놈의 목소리로 변환하고 있다...</span>
              </div>
            )}
          </>
        ) : (
          // 기본 테마 메시지
          <>
            {stage === 'stt' && (
              <div className="detail-info">
                <span className="detail-icon">📡</span>
                <span className="detail-text">음성을 텍스트로 변환하고 있습니다...</span>
              </div>
            )}
            {stage === 'gpt' && (
              <div className="detail-info">
                <span className="detail-icon">💭</span>
                <span className="detail-text">AI가 답변을 생각하고 있습니다...</span>
              </div>
            )}
            {stage === 'tts' && (
              <div className="detail-info">
                <span className="detail-icon">🎵</span>
                <span className="detail-text">텍스트를 자연스러운 음성으로 변환 중...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 단계 진행 인디케이터 */}
      <div className="stage-progress-indicator">
        <div className={`stage-step ${stage !== 'idle' ? 'completed' : ''}`}>
          <span className="step-icon">🎤</span>
          <span className="step-label">음성인식</span>
        </div>
        <div className="step-connector"></div>
        <div
          className={`stage-step ${
            stage === 'gpt' ? 'active' : stage === 'tts' ? 'completed' : ''
          }`}>
          <span className="step-icon">🤖</span>
          <span className="step-label">AI응답</span>
        </div>
        <div className="step-connector"></div>
        <div className={`stage-step ${stage === 'tts' ? 'active' : ''}`}>
          <span className="step-icon">🔊</span>
          <span className="step-label">음성합성</span>
        </div>
      </div>
    </div>
  );
};

export default UnifiedProgressBar;
