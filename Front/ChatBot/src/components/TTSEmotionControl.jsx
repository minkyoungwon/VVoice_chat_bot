import React, { useState, useEffect } from 'react';
import '../styles/TTSEmotionControl.css';

const TTSEmotionControl = ({ 
  onSettingsChange, 
  isVisible = true,
  currentSettings = {}
}) => {
  // 🔥 TTS 감정 설정 상태
  const [ttsSettings, setTTSSettings] = useState({
    model: "Zyphra/Zonos-v0.1-tiny", // 기본값
    emotion: "neutral",               // 감정
    intensity: 0.7,                   // 감정 강도 (0.0 ~ 1.0)
    speed: 1.0,                       // 말하기 속도 (0.5 ~ 2.0)
    cfg_scale: 1.5,                   // CFG 스케일 (품질 vs 속도)
    ...currentSettings.tts_settings
  });

  // 🔥 감정 옵션 정의
  const emotionOptions = [
    { 
      value: 'neutral', 
      label: '중립적', 
      description: '평범하고 자연스러운 톤',
      color: '#6c757d',
      icon: '😐'
    },
    { 
      value: 'happy', 
      label: '기쁨', 
      description: '밝고 활기찬 톤',
      color: '#ffc107',
      icon: '😊'
    },
    { 
      value: 'sad', 
      label: '슬픔', 
      description: '차분하고 우울한 톤',
      color: '#6f42c1',
      icon: '😢'
    },
    { 
      value: 'angry', 
      label: '화남', 
      description: '강하고 거친 톤',
      color: '#dc3545',
      icon: '😠'
    },
    { 
      value: 'excited', 
      label: '흥분', 
      description: '에너지 넘치는 톤',
      color: '#fd7e14',
      icon: '🤩'
    },
    { 
      value: 'calm', 
      label: '차분함', 
      description: '부드럽고 평온한 톤',
      color: '#20c997',
      icon: '😌'
    },
    { 
      value: 'aggressive', 
      label: '공격적', 
      description: '날카롭고 강인한 톤',
      color: '#e83e8c',
      icon: '😤'
    }
  ];

  // 🔥 모델 옵션 정의
  const modelOptions = [
    { 
      value: 'Zyphra/Zonos-v0.1-tiny', 
      label: 'Tiny (빠름)', 
      description: '빠른 속도, 기본 품질',
      speed: '⚡⚡⚡',
      quality: '⭐⭐'
    },
    { 
      value: 'Zyphra/Zonos-v0.1-full', 
      label: 'Full (고품질)', 
      description: '높은 품질, 느린 속도',
      speed: '⚡',
      quality: '⭐⭐⭐⭐⭐'
    }
  ];

  // 🔥 설정 변경 핸들러
  const handleSettingChange = (key, value) => {
    const newSettings = {
      ...ttsSettings,
      [key]: value
    };
    
    setTTSSettings(newSettings);
    
    // 부모 컴포넌트에 전체 설정 전달
    onSettingsChange?.({
      tts_settings: newSettings
    });

    console.log('🎭 TTS 설정 변경:', key, '=', value);
  };

  // 🔥 프리셋 적용
  const applyPreset = (presetName) => {
    let preset = {};
    
    switch (presetName) {
      case 'fast':
        preset = {
          model: "Zyphra/Zonos-v0.1-tiny",
          emotion: "neutral",
          intensity: 0.5,
          speed: 1.3,
          cfg_scale: 1.2
        };
        break;
      case 'quality':
        preset = {
          model: "Zyphra/Zonos-v0.1-full",
          emotion: "neutral",
          intensity: 0.8,
          speed: 1.0,
          cfg_scale: 2.0
        };
        break;
      case 'energetic':
        preset = {
          model: "Zyphra/Zonos-v0.1-tiny",
          emotion: "excited",
          intensity: 0.9,
          speed: 1.2,
          cfg_scale: 1.5
        };
        break;
      case 'calm':
        preset = {
          model: "Zyphra/Zonos-v0.1-full",
          emotion: "calm",
          intensity: 0.6,
          speed: 0.9,
          cfg_scale: 1.8
        };
        break;
    }
    
    setTTSSettings(preset);
    onSettingsChange?.({
      tts_settings: preset
    });
    
    console.log('🎯 프리셋 적용:', presetName, preset);
  };

  // 🔥 현재 설정이 변경되면 상태 업데이트
  useEffect(() => {
    if (currentSettings.tts_settings) {
      setTTSSettings(prev => ({
        ...prev,
        ...currentSettings.tts_settings
      }));
    }
  }, [currentSettings.tts_settings]);

  if (!isVisible) return null;

  return (
    <div className="tts-emotion-control">
      {/* 헤더 */}
      <div className="control-header">
        <h3 className="control-title">
          <span className="title-icon">🎭</span>
          TTS 음성 설정
        </h3>
        <div className="control-subtitle">
          AI 음성의 감정과 스타일을 조절하세요
        </div>
      </div>

      {/* 빠른 프리셋 */}
      <div className="control-section">
        <h4 className="section-title">⚡ 빠른 설정</h4>
        <div className="preset-buttons">
          <button 
            className="preset-btn"
            onClick={() => applyPreset('fast')}
            title="빠른 응답 위주"
          >
            <span className="preset-icon">🚀</span>
            <span className="preset-name">빠른 응답</span>
          </button>
          
          <button 
            className="preset-btn"
            onClick={() => applyPreset('quality')}
            title="고품질 음성"
          >
            <span className="preset-icon">💎</span>
            <span className="preset-name">고품질</span>
          </button>
          
          <button 
            className="preset-btn"
            onClick={() => applyPreset('energetic')}
            title="활기찬 톤"
          >
            <span className="preset-icon">🔥</span>
            <span className="preset-name">활기찬</span>
          </button>
          
          <button 
            className="preset-btn"
            onClick={() => applyPreset('calm')}
            title="차분한 톤"
          >
            <span className="preset-icon">🌙</span>
            <span className="preset-name">차분한</span>
          </button>
        </div>
      </div>

      {/* 모델 선택 */}
      <div className="control-section">
        <h4 className="section-title">🤖 음성 모델</h4>
        <div className="model-selector">
          {modelOptions.map(model => (
            <div 
              key={model.value}
              className={`model-option ${ttsSettings.model === model.value ? 'active' : ''}`}
              onClick={() => handleSettingChange('model', model.value)}
            >
              <div className="model-header">
                <span className="model-name">{model.label}</span>
                <div className="model-badges">
                  <span className="speed-badge" title="속도">{model.speed}</span>
                  <span className="quality-badge" title="품질">{model.quality}</span>
                </div>
              </div>
              <div className="model-description">{model.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 감정 선택 */}
      <div className="control-section">
        <h4 className="section-title">😊 감정 선택</h4>
        <div className="emotion-grid">
          {emotionOptions.map(emotion => (
            <div 
              key={emotion.value}
              className={`emotion-card ${ttsSettings.emotion === emotion.value ? 'active' : ''}`}
              onClick={() => handleSettingChange('emotion', emotion.value)}
              style={{ '--emotion-color': emotion.color }}
            >
              <div className="emotion-icon">{emotion.icon}</div>
              <div className="emotion-label">{emotion.label}</div>
              <div className="emotion-description">{emotion.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 세부 조절 */}
      <div className="control-section">
        <h4 className="section-title">🎛️ 세부 조절</h4>
        
        {/* 감정 강도 */}
        <div className="slider-control">
          <div className="slider-header">
            <label className="slider-label">감정 강도</label>
            <span className="slider-value">{Math.round(ttsSettings.intensity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ttsSettings.intensity}
            onChange={(e) => handleSettingChange('intensity', parseFloat(e.target.value))}
            className="slider"
            style={{ '--value-percent': `${ttsSettings.intensity * 100}%` }}
          />
          <div className="slider-labels">
            <span>미묘함</span>
            <span>강함</span>
          </div>
        </div>

        {/* 말하기 속도 */}
        <div className="slider-control">
          <div className="slider-header">
            <label className="slider-label">말하기 속도</label>
            <span className="slider-value">{ttsSettings.speed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={ttsSettings.speed}
            onChange={(e) => handleSettingChange('speed', parseFloat(e.target.value))}
            className="slider"
            style={{ '--value-percent': `${((ttsSettings.speed - 0.5) / 1.5) * 100}%` }}
          />
          <div className="slider-labels">
            <span>느림</span>
            <span>빠름</span>
          </div>
        </div>

        {/* CFG 스케일 (고급) */}
        <div className="slider-control">
          <div className="slider-header">
            <label className="slider-label">품질 vs 속도</label>
            <span className="slider-value">{ttsSettings.cfg_scale.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={ttsSettings.cfg_scale}
            onChange={(e) => handleSettingChange('cfg_scale', parseFloat(e.target.value))}
            className="slider"
            style={{ '--value-percent': `${((ttsSettings.cfg_scale - 1.0) / 2.0) * 100}%` }}
          />
          <div className="slider-labels">
            <span>속도 우선</span>
            <span>품질 우선</span>
          </div>
        </div>
      </div>

      {/* 미리보기 버튼 */}
      <div className="control-section">
        <button 
          className="preview-button"
          onClick={() => {
            // 미리보기 기능 (추후 구현)
            console.log('🎵 음성 미리보기 요청:', ttsSettings);
            alert('미리보기 기능은 준비 중입니다.');
          }}
        >
          <span className="preview-icon">🎵</span>
          <span className="preview-text">음성 미리보기</span>
        </button>
      </div>

      {/* 현재 설정 요약 */}
      <div className="current-settings-summary">
        <div className="summary-title">현재 설정 요약</div>
        <div className="summary-content">
          <div className="summary-item">
            <span className="summary-label">모델:</span>
            <span className="summary-value">
              {modelOptions.find(m => m.value === ttsSettings.model)?.label || ttsSettings.model}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">감정:</span>
            <span className="summary-value">
              {emotionOptions.find(e => e.value === ttsSettings.emotion)?.label || ttsSettings.emotion}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">강도:</span>
            <span className="summary-value">{Math.round(ttsSettings.intensity * 100)}%</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">속도:</span>
            <span className="summary-value">{ttsSettings.speed.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TTSEmotionControl;