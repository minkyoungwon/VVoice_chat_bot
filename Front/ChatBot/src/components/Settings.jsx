import React, { useState } from 'react';
import useChatStore from '../store/chatStore';

const Settings = () => {
  const { settings, updateSettings } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSettingChange = (key, value) => {
    updateSettings({ [key]: value });
  };
  
  const handleEmotionChange = (index, value) => {
    const newEmotion = [...settings.emotion];
    newEmotion[index] = parseFloat(value);
    
    // 감정 값들의 합이 1.0이 되도록 정규화
    const sum = newEmotion.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      const normalized = newEmotion.map(val => val / sum);
      updateSettings({ emotion: normalized });
    }
  };
  
  const resetToDefaults = () => {
    updateSettings({
      model: "Zyphra/Zonos-v0.1-transformer",
      language: "ko",
      volume: 1.0,
      autoSpeak: true,
      // 🔥 개선된 기본값 - 더 나은 음성 품질
      emotion: [0.6, 0.1, 0.05, 0.05, 0.1, 0.05, 0.3, 0.2], // 더 표현력 있는 감정
      fmax: 24000.0, // 더 높은 주파수로 음질 향상
      pitch_std: 35.0, // 피치 변화 증가로 자연스러움
      speaking_rate: 18.0 // 말하기 속도 개선
    });
  };
  
  const emotionLabels = [
    '행복', '슬픔', '혐오', '두려움', '놀람', '분노', '기타', '중립'
  ];
  
  return (
    <div className="settings">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="settings-toggle"
      >
        ⚙️ 설정 {isOpen ? '접기' : '펼치기'}
      </button>
      
      {isOpen && (
        <div className="settings-panel">
          <div className="setting-group">
            <h4>🤖 모델 설정</h4>
            
            <div className="setting-item">
              <label>모델:</label>
              <select 
                value={settings.model}
                onChange={(e) => handleSettingChange('model', e.target.value)}
              >
                <option value="Zyphra/Zonos-v0.1-transformer">Transformer</option>
                <option value="Zyphra/Zonos-v0.1-hybrid">Hybrid</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>언어:</label>
              <select 
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
              >
                <option value="ko">한국어</option>
                <option value="en-us">영어 (미국)</option>
              </select>
            </div>
          </div>
          
          <div className="setting-group">
            <h4>🔊 오디오 설정</h4>
            
            <div className="setting-item">
              <label>볼륨: {Math.round(settings.volume * 100)}%</label>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.volume}
                onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="setting-item">
              <label>자동 음성 재생:</label>
              <input 
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) => handleSettingChange('autoSpeak', e.target.checked)}
              />
            </div>
            
            <div className="setting-item">
              <label>최대 주파수: {settings.fmax}Hz</label>
              <input 
                type="range"
                min="8000"
                max="24000"
                step="1000"
                value={settings.fmax}
                onChange={(e) => handleSettingChange('fmax', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="setting-item">
              <label>피치 변화: {settings.pitch_std}</label>
              <input 
                type="range"
                min="5"
                max="100"
                step="5"
                value={settings.pitch_std}
                onChange={(e) => handleSettingChange('pitch_std', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="setting-item">
              <label>말하기 속도: {settings.speaking_rate}</label>
              <input 
                type="range"
                min="5"
                max="30"
                step="1"
                value={settings.speaking_rate}
                onChange={(e) => handleSettingChange('speaking_rate', parseFloat(e.target.value))}
              />
            </div>
          </div>
          
          <div className="setting-group">
            <h4>😊 감정 설정</h4>
            <p className="emotion-help">감정 값들은 자동으로 정규화됩니다.</p>
            
            {settings.emotion.map((value, index) => (
              <div key={index} className="setting-item emotion-item">
                <label>{emotionLabels[index]}: {(value * 100).toFixed(1)}%</label>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={value}
                  onChange={(e) => handleEmotionChange(index, e.target.value)}
                />
              </div>
            ))}
          </div>
          
          <div className="setting-actions">
            <button onClick={resetToDefaults} className="reset-button">
              🔄 기본값으로 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
