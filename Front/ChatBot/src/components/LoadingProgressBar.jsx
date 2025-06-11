import React, { useState, useEffect } from 'react';
import '../styles/LoadingProgressBar.css'; // CSS import 경로 수정

const LoadingProgressBar = ({ 
  isVisible = false, 
  progress = 0, 
  status = '', 
  title = '로딩 중...', 
  modelName = '',
  onClose = null 
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [animationClass, setAnimationClass] = useState('');

  // 부드러운 진행률 애니메이션
  useEffect(() => {
    if (progress > displayProgress) {
      const increment = (progress - displayProgress) / 10;
      const timer = setInterval(() => {
        setDisplayProgress(prev => {
          const newProgress = prev + increment;
          if (newProgress >= progress) {
            clearInterval(timer);
            return progress;
          }
          return newProgress;
        });
      }, 50);
      return () => clearInterval(timer);
    } else {
      setDisplayProgress(progress);
    }
  }, [progress, displayProgress]);

  // 진행률에 따른 애니메이션 클래스 설정
  useEffect(() => {
    if (displayProgress === 0) {
      setAnimationClass('progress-start');
    } else if (displayProgress === 100) {
      setAnimationClass('progress-complete');
    } else if (displayProgress > 50) {
      setAnimationClass('progress-high');
    } else {
      setAnimationClass('progress-normal');
    }
  }, [displayProgress]);

  // 진행률에 따른 색상 계산
  const getProgressColor = () => {
    if (displayProgress === 100) return '#4caf50'; // 완료 - 초록색
    if (displayProgress >= 75) return '#2196f3'; // 높음 - 파란색
    if (displayProgress >= 50) return '#ff9800'; // 중간 - 주황색
    if (displayProgress >= 25) return '#9c27b0'; // 낮음 - 보라색
    return '#9c27b0'; // 시작 - 보라색
  };

  // 진행률에 따른 아이콘
  const getProgressIcon = () => {
    if (displayProgress === 100) return '✅';
    if (displayProgress >= 75) return '🚀';
    if (displayProgress >= 50) return '⚡';
    if (displayProgress >= 25) return '🔄';
    return '📥';
  };

  if (!isVisible) return null;

  return (
    <div className="loading-progress-overlay">
      <div className="loading-progress-modal">
        {/* 헤더 */}
        <div className="progress-header">
          <div className="progress-title">
            <span className="progress-icon">{getProgressIcon()}</span>
            <h3>{title}</h3>
          </div>
          {onClose && displayProgress === 100 && (
            <button 
              className="progress-close-btn"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>

        {/* 모델 정보 */}
        {modelName && (
          <div className="progress-model-info">
            <span className="model-label">모델:</span>
            <span className="model-name">{modelName}</span>
          </div>
        )}

        {/* 메인 프로그래스 바 */}
        <div className="progress-container">
          <div className="progress-track">
            <div 
              className={`progress-fill ${animationClass}`}
              style={{ 
                width: `${displayProgress}%`,
                backgroundColor: getProgressColor()
              }}
            >
              <div className="progress-shine"></div>
            </div>
          </div>
          
          {/* 진행률 텍스트 */}
          <div className="progress-text">
            <span className="progress-percentage">{Math.round(displayProgress)}%</span>
          </div>
        </div>

        {/* 상태 메시지 */}
        <div className="progress-status">
          <div className="status-message">
            {status && (
              <span className="status-text">{status}</span>
            )}
          </div>
          
          {/* 로딩 스피너 (100% 미만일 때만) */}
          {displayProgress < 100 && (
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
            </div>
          )}
        </div>

        {/* 진행률별 추가 정보 */}
        <div className="progress-info">
          {displayProgress < 25 && (
            <div className="info-stage">
              <span className="stage-icon">📡</span>
              <span className="stage-text">서버 연결 및 초기화 중...</span>
            </div>
          )}
          {displayProgress >= 25 && displayProgress < 50 && (
            <div className="info-stage">
              <span className="stage-icon">📥</span>
              <span className="stage-text">모델 다운로드 중...</span>
            </div>
          )}
          {displayProgress >= 50 && displayProgress < 75 && (
            <div className="info-stage">
              <span className="stage-icon">🔧</span>
              <span className="stage-text">모델 초기화 중...</span>
            </div>
          )}
          {displayProgress >= 75 && displayProgress < 100 && (
            <div className="info-stage">
              <span className="stage-icon">⚡</span>
              <span className="stage-text">최적화 적용 중...</span>
            </div>
          )}
          {displayProgress === 100 && (
            <div className="info-stage complete">
              <span className="stage-icon">🎉</span>
              <span className="stage-text">로딩 완료!</span>
            </div>
          )}
        </div>

        {/* 하단 도움말 */}
        <div className="progress-footer">
          <div className="footer-tip">
            💡 <strong>팁:</strong> 모델이 처음 로드될 때는 시간이 걸릴 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingProgressBar;