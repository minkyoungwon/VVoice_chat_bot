import React, { useState } from 'react';
import VoiceSelector from './VoiceSelector';
import EnhancedEmotionControl from './EnhancedEmotionControl';

const VoiceTTSControl = ({ onSettingsChange, className = "" }) => {
    const [voiceSettings, setVoiceSettings] = useState({
        voice_id: null,
        emotion: [0.3077, 0.0256, 0.0256, 0.0256, 0.0256, 0.0256, 0.2564, 0.3077],
        emotion_preset: 'default',
        enable_emotion: true,
        language: 'ko',
        speaking_rate: 15.0,
        pitch_std: 20.0,
        cfg_scale: 2.0
    });

    const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'emotion' | 'advanced'

    const handleVoiceChange = (voiceData) => {
        const newSettings = { ...voiceSettings, ...voiceData };
        setVoiceSettings(newSettings);
        onSettingsChange(newSettings);
    };

    const handleEmotionChange = (emotionData) => {
        const newSettings = { ...voiceSettings, ...emotionData };
        setVoiceSettings(newSettings);
        onSettingsChange(newSettings);
    };

    const handleAdvancedChange = (field, value) => {
        const newSettings = { ...voiceSettings, [field]: value };
        setVoiceSettings(newSettings);
        onSettingsChange(newSettings);
    };

    const tabStyle = (tabName) => ({
        padding: '12px 20px',
        border: 'none',
        borderBottom: activeTab === tabName ? '3px solid #007bff' : '3px solid transparent',
        backgroundColor: activeTab === tabName ? '#f8f9fa' : 'transparent',
        color: activeTab === tabName ? '#007bff' : '#666',
        cursor: 'pointer',
        fontSize: '1em',
        fontWeight: activeTab === tabName ? 'bold' : 'normal',
        transition: 'all 0.3s ease',
        flex: 1,
        textAlign: 'center'
    });

    return (
        <div className={`voice-tts-control ${className}`}>
            <div className="control-header">
                <h2>🎛️ 음성 설정</h2>
                
                {/* 탭 네비게이션 */}
                <div className="tab-navigation" style={{
                    display: 'flex',
                    borderBottom: '1px solid #ddd',
                    marginBottom: '20px'
                }}>
                    <button
                        onClick={() => setActiveTab('voice')}
                        style={tabStyle('voice')}
                    >
                        🎤 목소리
                    </button>
                    <button
                        onClick={() => setActiveTab('emotion')}
                        style={tabStyle('emotion')}
                    >
                        😊 감정
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced')}
                        style={tabStyle('advanced')}
                    >
                        ⚙️ 고급
                    </button>
                </div>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="tab-content">
                {activeTab === 'voice' && (
                    <VoiceSelector
                        onVoiceChange={handleVoiceChange}
                        selectedVoice={voiceSettings.voice_id}
                    />
                )}

                {activeTab === 'emotion' && (
                    <EnhancedEmotionControl
                        onEmotionChange={handleEmotionChange}
                        emotion={voiceSettings.emotion}
                        emotionPreset={voiceSettings.emotion_preset}
                        enableEmotion={voiceSettings.enable_emotion}
                    />
                )}

                {activeTab === 'advanced' && (
                    <div className="advanced-settings">
                        <h3>⚙️ 고급 설정</h3>
                        
                        <div className="settings-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '20px'
                        }}>
                            {/* 언어 설정 */}
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    🌐 언어
                                </label>
                                <select
                                    value={voiceSettings.language}
                                    onChange={(e) => handleAdvancedChange('language', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '2px solid #ddd',
                                        borderRadius: '8px',
                                        fontSize: '1em'
                                    }}
                                >
                                    <option value="ko">한국어 (Korean)</option>
                                    <option value="en-us">영어 (English US)</option>
                                </select>
                            </div>

                            {/* 말하기 속도 */}
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    🏃 말하기 속도: {voiceSettings.speaking_rate}
                                </label>
                                <input
                                    type="range"
                                    min="5"
                                    max="30"
                                    step="0.5"
                                    value={voiceSettings.speaking_rate}
                                    onChange={(e) => handleAdvancedChange('speaking_rate', parseFloat(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#666' }}>
                                    <span>느림 (5)</span>
                                    <span>보통 (15)</span>
                                    <span>빠름 (30)</span>
                                </div>
                            </div>

                            {/* 음높이 변화 */}
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    🎵 음높이 변화: {voiceSettings.pitch_std}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={voiceSettings.pitch_std}
                                    onChange={(e) => handleAdvancedChange('pitch_std', parseFloat(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#666' }}>
                                    <span>단조로움 (0)</span>
                                    <span>자연스러움 (20)</span>
                                    <span>표현적 (100)</span>
                                </div>
                            </div>

                            {/* CFG 스케일 */}
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    🎯 생성 강도 (CFG): {voiceSettings.cfg_scale}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    step="0.1"
                                    value={voiceSettings.cfg_scale}
                                    onChange={(e) => handleAdvancedChange('cfg_scale', parseFloat(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#666' }}>
                                    <span>약함 (1.0)</span>
                                    <span>보통 (2.0)</span>
                                    <span>강함 (5.0)</span>
                                </div>
                            </div>
                        </div>

                        {/* 설정 요약 */}
                        <div className="settings-summary" style={{
                            marginTop: '24px',
                            padding: '16px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h4>📋 현재 설정 요약</h4>
                            <div style={{ fontSize: '0.9em', color: '#666' }}>
                                <p><strong>목소리:</strong> {voiceSettings.voice_id || '랜덤'}</p>
                                <p><strong>감정:</strong> {voiceSettings.enable_emotion ? (voiceSettings.emotion_preset || '커스텀') : '비활성화'}</p>
                                <p><strong>언어:</strong> {voiceSettings.language === 'ko' ? '한국어' : '영어'}</p>
                                <p><strong>속도:</strong> {voiceSettings.speaking_rate} | <strong>음높이:</strong> {voiceSettings.pitch_std} | <strong>강도:</strong> {voiceSettings.cfg_scale}</p>
                            </div>
                        </div>

                        {/* 프리셋 저장/로드 (향후 기능) */}
                        <div className="preset-actions" style={{
                            marginTop: '20px',
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: '0.9em', color: '#666' }}>
                                💡 설정이 자동으로 저장되며 다음 요청에 적용됩니다
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceTTSControl;