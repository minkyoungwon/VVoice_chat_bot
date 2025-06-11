import React, { useState, useEffect } from 'react';

const EnhancedEmotionControl = ({ onEmotionChange, emotion, emotionPreset, enableEmotion, className = "" }) => {
    const [emotions, setEmotions] = useState([
        { name: 'Happiness', label: '😊 행복', value: 0.3077, color: '#ffd700' },
        { name: 'Sadness', label: '😢 슬픔', value: 0.0256, color: '#4169e1' },
        { name: 'Disgust', label: '🤢 혐오', value: 0.0256, color: '#228b22' },
        { name: 'Fear', label: '😨 두려움', value: 0.0256, color: '#800080' },
        { name: 'Surprise', label: '😲 놀라움', value: 0.0256, color: '#ff6347' },
        { name: 'Anger', label: '😠 분노', value: 0.0256, color: '#dc143c' },
        { name: 'Other', label: '🤔 기타', value: 0.2564, color: '#696969' },
        { name: 'Neutral', label: '😐 중성', value: 0.3077, color: '#808080' }
    ]);
    
    const [currentEnableEmotion, setCurrentEnableEmotion] = useState(enableEmotion ?? true);
    const [currentPreset, setCurrentPreset] = useState(emotionPreset || 'default');
    const [availablePresets, setAvailablePresets] = useState({});

    useEffect(() => {
        loadEmotionPresets();
    }, []);

    useEffect(() => {
        if (emotion && Array.isArray(emotion) && emotion.length === 8) {
            const newEmotions = emotions.map((em, index) => ({
                ...em,
                value: emotion[index]
            }));
            setEmotions(newEmotions);
        }
    }, [emotion]);

    const loadEmotionPresets = async () => {
        try {
            const response = await fetch('/api/tts/emotions');
            const result = await response.json();
            
            if (result.status === 'success') {
                setAvailablePresets(result.emotion_presets);
            }
        } catch (err) {
            console.error('감정 프리셋 로드 오류:', err);
        }
    };

    const handleEmotionChange = (index, value) => {
        const newEmotions = [...emotions];
        newEmotions[index].value = parseFloat(value);
        setEmotions(newEmotions);
        
        // 커스텀 모드로 변경
        setCurrentPreset('custom');
        
        notifyChange(newEmotions.map(e => e.value), 'custom', currentEnableEmotion);
    };

    const handlePresetChange = (presetName) => {
        if (presetName === 'custom') return;
        
        setCurrentPreset(presetName);
        
        if (availablePresets[presetName]) {
            const presetValues = availablePresets[presetName];
            const newEmotions = emotions.map((em, index) => ({
                ...em,
                value: presetValues[index] || 0
            }));
            setEmotions(newEmotions);
            
            notifyChange(presetValues, presetName, currentEnableEmotion);
        }
    };

    const handleEnableToggle = (enabled) => {
        setCurrentEnableEmotion(enabled);
        notifyChange(emotions.map(e => e.value), currentPreset, enabled);
    };

    const notifyChange = (emotionValues, preset, enabled) => {
        onEmotionChange({
            emotion: emotionValues,
            emotion_preset: preset !== 'custom' ? preset : undefined,
            enable_emotion: enabled
        });
    };

    const resetToDefault = () => {
        handlePresetChange('default');
    };

    const normalizeEmotions = () => {
        const total = emotions.reduce((sum, em) => sum + em.value, 0);
        if (total === 0) return;
        
        const normalizedEmotions = emotions.map(em => ({
            ...em,
            value: em.value / total
        }));
        
        setEmotions(normalizedEmotions);
        setCurrentPreset('custom');
        notifyChange(normalizedEmotions.map(e => e.value), 'custom', currentEnableEmotion);
    };

    return (
        <div className={`emotion-control ${className}`}>
            <div className="emotion-header">
                <h3>😊 감정 설정</h3>
                
                {/* 감정 활성화/비활성화 토글 */}
                <div className="emotion-enable-toggle" style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '1em',
                        fontWeight: 'bold'
                    }}>
                        <input
                            type="checkbox"
                            checked={currentEnableEmotion}
                            onChange={(e) => handleEnableToggle(e.target.checked)}
                            style={{
                                marginRight: '8px',
                                transform: 'scale(1.2)'
                            }}
                        />
                        <span style={{ color: currentEnableEmotion ? '#28a745' : '#6c757d' }}>
                            {currentEnableEmotion ? '✅ 감정 효과 활성화' : '❌ 감정 효과 비활성화'}
                        </span>
                    </label>
                </div>
            </div>

            {currentEnableEmotion && (
                <>
                    {/* 감정 프리셋 선택 */}
                    <div className="emotion-presets" style={{ marginBottom: '20px' }}>
                        <h4>🎭 감정 프리셋</h4>
                        <div className="preset-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: '8px',
                            marginBottom: '16px'
                        }}>
                            {Object.keys(availablePresets).map(presetName => (
                                <button
                                    key={presetName}
                                    onClick={() => handlePresetChange(presetName)}
                                    className={`preset-button ${currentPreset === presetName ? 'active' : ''}`}
                                    style={{
                                        padding: '8px 12px',
                                        border: '2px solid #ddd',
                                        borderRadius: '8px',
                                        backgroundColor: currentPreset === presetName ? '#007bff' : 'white',
                                        color: currentPreset === presetName ? 'white' : '#333',
                                        cursor: 'pointer',
                                        fontSize: '0.9em',
                                        transition: 'all 0.3s ease',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {presetName === 'happy' ? '😊' : 
                                     presetName === 'sad' ? '😢' :
                                     presetName === 'angry' ? '😠' :
                                     presetName === 'surprised' ? '😲' :
                                     presetName === 'neutral' ? '😐' : '🎭'} {presetName}
                                </button>
                            ))}
                            {currentPreset === 'custom' && (
                                <div style={{
                                    padding: '8px 12px',
                                    border: '2px solid #28a745',
                                    borderRadius: '8px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    fontSize: '0.9em',
                                    textAlign: 'center'
                                }}>
                                    🎨 커스텀
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 세부 감정 조절 슬라이더들 */}
                    <div className="emotion-sliders">
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <h4>🎚️ 세부 조절</h4>
                            <div>
                                <button
                                    onClick={normalizeEmotions}
                                    style={{
                                        padding: '4px 8px',
                                        marginRight: '8px',
                                        border: '1px solid #6c757d',
                                        borderRadius: '4px',
                                        backgroundColor: 'white',
                                        color: '#6c757d',
                                        cursor: 'pointer',
                                        fontSize: '0.8em'
                                    }}
                                    title="감정값들의 합을 1.0으로 정규화"
                                >
                                    📊 정규화
                                </button>
                                <button
                                    onClick={resetToDefault}
                                    style={{
                                        padding: '4px 8px',
                                        border: '1px solid #dc3545',
                                        borderRadius: '4px',
                                        backgroundColor: 'white',
                                        color: '#dc3545',
                                        cursor: 'pointer',
                                        fontSize: '0.8em'
                                    }}
                                >
                                    🔄 초기화
                                </button>
                            </div>
                        </div>
                        
                        <div className="sliders-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: '12px'
                        }}>
                            {emotions.map((emotion, index) => (
                                <div key={emotion.name} className="emotion-slider-item">
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '4px'
                                    }}>
                                        <label style={{
                                            fontSize: '0.9em',
                                            fontWeight: '500',
                                            color: emotion.color
                                        }}>
                                            {emotion.label}
                                        </label>
                                        <span style={{
                                            fontSize: '0.8em',
                                            color: '#666',
                                            backgroundColor: '#f8f9fa',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            minWidth: '45px',
                                            textAlign: 'center'
                                        }}>
                                            {emotion.value.toFixed(3)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={emotion.value}
                                        onChange={(e) => handleEmotionChange(index, e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: '6px',
                                            borderRadius: '3px',
                                            background: `linear-gradient(to right, ${emotion.color} 0%, ${emotion.color} ${emotion.value * 100}%, #ddd ${emotion.value * 100}%, #ddd 100%)`,
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* 감정 합계 표시 */}
                        <div className="emotion-summary" style={{
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.9em', color: '#666' }}>
                                    감정값 합계: 
                                </span>
                                <span style={{
                                    fontSize: '1em',
                                    fontWeight: 'bold',
                                    color: Math.abs(emotions.reduce((sum, em) => sum + em.value, 0) - 1.0) < 0.01 ? '#28a745' : '#ffc107'
                                }}>
                                    {emotions.reduce((sum, em) => sum + em.value, 0).toFixed(3)}
                                </span>
                            </div>
                            {Math.abs(emotions.reduce((sum, em) => sum + em.value, 0) - 1.0) > 0.01 && (
                                <div style={{ fontSize: '0.8em', color: '#ffc107', marginTop: '4px' }}>
                                    💡 정규화를 통해 합계를 1.0으로 조정할 수 있습니다
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {!currentEnableEmotion && (
                <div className="emotion-disabled" style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#6c757d',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #dee2e6'
                }}>
                    <p style={{ fontSize: '1.2em', marginBottom: '8px' }}>😐 감정 효과가 비활성화되었습니다</p>
                    <p style={{ fontSize: '0.9em' }}>중성적인 톤으로 음성이 생성됩니다</p>
                </div>
            )}
        </div>
    );
};

export default EnhancedEmotionControl;