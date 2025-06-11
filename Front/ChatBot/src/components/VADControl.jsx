import React, { useState, useEffect } from 'react';
import '../styles/VADControl.css';

const VADControl = ({ 
  onSettingsChange, 
  isVisible = true,
  currentSettings = {},
  isRecording = false,
  voiceLevel = 0,
  isVoiceDetected = false
}) => {
  // 🔥 VAD 설정 상태
  const [vadSettings, setVadSettings] = useState({
    voiceThreshold: 0.06,        // 음성 감지 임계값 0.08 → 0.06으로 더 민감하게
    silenceThreshold: 0.025,     // 정적 감지 임계값 0.03 → 0.025로 더 민감하게
    minVoiceDuration: 250,       // 최소 음성 지속 시간 300 → 250으로 빠르게
    maxSilenceDuration: 1000,    // 최대 정적 지속 시간 1200 → 1000으로 빠르게
    bufferDuration: 250,         // 버퍼 지속 시간 300 → 250으로 빠르게
    sensitivity: 'medium',       // 민감도 프리셋 (low, medium, high, ultra, custom)
    ...currentSettings.vadConfig
  });

  // 🔥 민감도 프리셋 정의
  const sensitivityPresets = {
    low: {
      label: '낮음',
      description: '큰 소리만 감지, 배경소음 무시',
      voiceThreshold: 0.15,
      silenceThreshold: 0.05,
      minVoiceDuration: 500,
      maxSilenceDuration: 2000,
      bufferDuration: 500,
      color: '#28a745',
      icon: '🔇'
    },
    medium: {
      label: '보통',
      description: '일반적인 대화 환경에 적합',
      voiceThreshold: 0.06,   // 🔥 기본값과 일치시키기
      silenceThreshold: 0.025, // 🔥 기본값과 일치시키기
      minVoiceDuration: 250,   // 🔥 기본값과 일치시키기
      maxSilenceDuration: 1000, // 🔥 기본값과 일치시키기
      bufferDuration: 250,     // 🔥 기본값과 일치시키기
      color: '#ffc107',
      icon: '🔊'
    },
    high: {
      label: '높음',
      description: '작은 소리도 민감하게 감지',
      voiceThreshold: 0.02,  // 🔥 4% → 2%로 더 민감하게
      silenceThreshold: 0.01, // 🔥 2% → 1%로 더 민감하게
      minVoiceDuration: 200,
      maxSilenceDuration: 800,
      bufferDuration: 200,
      color: '#dc3545',
      icon: '📢'
    },
    ultra: {
      label: '매우 높음',
      description: '극도로 민감한 감지 (조용한 환경 전용)',
      voiceThreshold: 0.01,  // 🔥 1% 매우 민감한 설정
      silenceThreshold: 0.005, // 🔥 0.5% 매우 민감한 설정
      minVoiceDuration: 150,
      maxSilenceDuration: 600,
      bufferDuration: 150,
      color: '#e83e8c',
      icon: '🎯'
    },
    custom: {
      label: '사용자 정의',
      description: '직접 세부 설정 조정',
      color: '#6f42c1',
      icon: '⚙️'
    }
  };

  // 🔥 설정 변경 핸들러
  const handleSettingChange = (key, value) => {
    const newSettings = {
      ...vadSettings,
      [key]: value,
      sensitivity: 'custom' // 수동 변경 시 커스텀으로 변경
    };
    
    setVadSettings(newSettings);
    
    // 부모 컴포넌트에 설정 전달
    onSettingsChange?.({
      vadConfig: newSettings
    });

    console.log('🎙️ VAD 설정 변경:', key, '=', value);
  };

  // 🔥 프리셋 적용
  const applySensitivityPreset = (presetName) => {
    if (presetName === 'custom') return;
    
    const preset = sensitivityPresets[presetName];
    if (!preset) return;
    
    const newSettings = {
      ...vadSettings,
      voiceThreshold: preset.voiceThreshold,
      silenceThreshold: preset.silenceThreshold,
      minVoiceDuration: preset.minVoiceDuration,
      maxSilenceDuration: preset.maxSilenceDuration,
      bufferDuration: preset.bufferDuration,
      sensitivity: presetName
    };
    
    setVadSettings(newSettings);
    onSettingsChange?.({
      vadConfig: newSettings
    });
    
    console.log('🎯 VAD 프리셋 적용:', presetName, newSettings);
  };

  // 🔥 음성 레벨 바 색상 계산
  const getVoiceLevelColor = () => {
    if (voiceLevel > vadSettings.voiceThreshold) return '#28a745'; // 초록색 - 음성
    if (voiceLevel > vadSettings.silenceThreshold) return '#ffc107'; // 노란색 - 중간
    return '#dc3545'; // 빨간색 - 정적
  };

  // 🔥 현재 설정이 변경되면 상태 업데이트
  useEffect(() => {
    if (currentSettings.vadConfig) {
      setVadSettings(prev => ({
        ...prev,
        ...currentSettings.vadConfig
      }));
    }
  }, [currentSettings.vadConfig]);

  if (!isVisible) return null;

  return (
    <div className="vad-control">
      {/* 헤더 */}
      <div className="control-header">
        <h3 className="control-title">
          <span className="title-icon">🎙️</span>
          VAD 음성 감지 설정
        </h3>
        <div className="control-subtitle">
          음성 자동 감지 민감도를 조절하세요
        </div>
      </div>

      {/* 실시간 음성 레벨 표시 */}
      {isRecording && (
        <div className="control-section">
          <h4 className="section-title">📊 실시간 음성 레벨</h4>
          <div className="voice-level-display">
            <div className="level-info">
              <div className="level-status">
                <span className={`status-indicator ${isVoiceDetected ? 'active' : 'inactive'}`}>
                  {isVoiceDetected ? '🎤 음성 감지됨' : '⚪ 대기 중'}
                </span>
                <span className="level-value">{(voiceLevel * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="level-bar-container">
              <div 
                className="level-bar"
                style={{
                  '--level-width': `${Math.min(100, voiceLevel * 100)}%`,
                  '--level-color': getVoiceLevelColor()
                }}
              >
                <div className="level-fill"></div>
              </div>
              
              {/* 임계값 마커 */}
              <div className="threshold-markers">
                <div 
                  className="threshold-marker silence"
                  style={{ left: `${vadSettings.silenceThreshold * 100}%` }}
                  title={`정적 임계값: ${(vadSettings.silenceThreshold * 100).toFixed(1)}%`}
                ></div>
                <div 
                  className="threshold-marker voice"
                  style={{ left: `${vadSettings.voiceThreshold * 100}%` }}
                  title={`음성 임계값: ${(vadSettings.voiceThreshold * 100).toFixed(1)}%`}
                ></div>
              </div>
            </div>
            
            <div className="level-labels">
              <span>정적</span>
              <span>음성</span>
            </div>
          </div>
        </div>
      )}

      {/* 민감도 프리셋 */}
      <div className="control-section">
        <h4 className="section-title">⚡ 민감도 프리셋</h4>
        <div className="sensitivity-presets">
          {Object.entries(sensitivityPresets).map(([key, preset]) => (
            <div 
              key={key}
              className={`sensitivity-card ${vadSettings.sensitivity === key ? 'active' : ''}`}
              onClick={() => applySensitivityPreset(key)}
              style={{ '--preset-color': preset.color }}
            >
              <div className="sensitivity-icon">{preset.icon}</div>
              <div className="sensitivity-label">{preset.label}</div>
              <div className="sensitivity-description">{preset.description}</div>
              {key !== 'custom' && (
                <div className="sensitivity-values">
                  <span>임계값: {(preset.voiceThreshold * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 세부 조절 (커스텀 모드에서만 표시) */}
      {vadSettings.sensitivity === 'custom' && (
        <div className="control-section">
          <h4 className="section-title">🎛️ 세부 조절</h4>
          
          {/* 음성 감지 임계값 */}
          <div className="slider-control">
            <div className="slider-header">
              <label className="slider-label">음성 감지 임계값</label>
              <span className="slider-value">{(vadSettings.voiceThreshold * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={vadSettings.voiceThreshold}
              onChange={(e) => handleSettingChange('voiceThreshold', parseFloat(e.target.value))}
              className="slider voice-threshold"
              style={{ '--value-percent': `${(vadSettings.voiceThreshold / 0.5) * 100}%` }}
            />
            <div className="slider-labels">
              <span>민감함</span>
              <span>둔감함</span>
            </div>
          </div>

          {/* 정적 감지 임계값 */}
          <div className="slider-control">
            <div className="slider-header">
              <label className="slider-label">정적 감지 임계값</label>
              <span className="slider-value">{(vadSettings.silenceThreshold * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.01"
              value={vadSettings.silenceThreshold}
              onChange={(e) => handleSettingChange('silenceThreshold', parseFloat(e.target.value))}
              className="slider silence-threshold"
              style={{ '--value-percent': `${(vadSettings.silenceThreshold / 0.2) * 100}%` }}
            />
            <div className="slider-labels">
              <span>민감함</span>
              <span>둔감함</span>
            </div>
          </div>

          {/* 최소 음성 지속 시간 */}
          <div className="slider-control">
            <div className="slider-header">
              <label className="slider-label">최소 음성 지속 시간</label>
              <span className="slider-value">{vadSettings.minVoiceDuration}ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={vadSettings.minVoiceDuration}
              onChange={(e) => handleSettingChange('minVoiceDuration', parseInt(e.target.value))}
              className="slider"
              style={{ '--value-percent': `${((vadSettings.minVoiceDuration - 100) / 900) * 100}%` }}
            />
            <div className="slider-labels">
              <span>짧음</span>
              <span>긺</span>
            </div>
          </div>

          {/* 최대 정적 지속 시간 */}
          <div className="slider-control">
            <div className="slider-header">
              <label className="slider-label">최대 정적 지속 시간</label>
              <span className="slider-value">{vadSettings.maxSilenceDuration}ms</span>
            </div>
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={vadSettings.maxSilenceDuration}
              onChange={(e) => handleSettingChange('maxSilenceDuration', parseInt(e.target.value))}
              className="slider"
              style={{ '--value-percent': `${((vadSettings.maxSilenceDuration - 500) / 2500) * 100}%` }}
            />
            <div className="slider-labels">
              <span>빠른 반응</span>
              <span>늦은 반응</span>
            </div>
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div className="control-section">
        <h4 className="section-title">💡 사용 팁</h4>
        <div className="tips-list">
          <div className="tip-item">
            <span className="tip-icon">🎤</span>
            <span className="tip-text">조용한 환경에서는 '높음' 민감도를 사용하세요.</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔇</span>
            <span className="tip-text">소음이 많은 환경에서는 '낮음' 민감도를 권장합니다.</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚙️</span>
            <span className="tip-text">세밀한 조절이 필요하면 '사용자 정의' 모드를 사용하세요.</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📊</span>
            <span className="tip-text">실시간 레벨을 보고 임계값을 조정하면 더 정확합니다.</span>
          </div>
        </div>
      </div>

      {/* 현재 설정 요약 */}
      <div className="current-settings-summary">
        <div className="summary-title">현재 VAD 설정</div>
        <div className="summary-content">
          <div className="summary-item">
            <span className="summary-label">민감도:</span>
            <span className="summary-value" style={{ color: sensitivityPresets[vadSettings.sensitivity]?.color }}>
              {sensitivityPresets[vadSettings.sensitivity]?.label || '사용자 정의'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">음성 임계값:</span>
            <span className="summary-value">{(vadSettings.voiceThreshold * 100).toFixed(1)}%</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">정적 임계값:</span>
            <span className="summary-value">{(vadSettings.silenceThreshold * 100).toFixed(1)}%</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">반응 시간:</span>
            <span className="summary-value">{vadSettings.maxSilenceDuration}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VADControl;