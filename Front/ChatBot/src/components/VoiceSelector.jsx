import React, { useState, useEffect } from 'react';

const VoiceSelector = ({ onVoiceChange, selectedVoice, className = "" }) => {
    const [voices, setVoices] = useState({
        predefined_voices: [],
        voice_info: {}
    });
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadVoices();
    }, []);

    const loadVoices = async () => {
        try {
            console.log('🎤 목소리 목록 로드 시도 중...');
            
            const response = await fetch('/api/tts/voices');
            
            console.log('📡 응답 상태:', response.status, response.statusText);
            console.log('📡 응답 헤더:', response.headers.get('content-type'));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ JSON이 아닌 응답:', textResponse);
                throw new Error(`서버가 JSON이 아닌 응답을 반환했습니다: ${contentType}`);
            }
            
            const responseText = await response.text();
            console.log('📥 원본 응답:', responseText.substring(0, 200) + '...');
            
            if (!responseText.trim()) {
                throw new Error('서버에서 빈 응답을 반환했습니다');
            }
            
            const result = JSON.parse(responseText);
            console.log('✅ 파싱된 응답:', result);
            
            if (result.status === 'success') {
                setVoices(result.data);
                setError(null);
                console.log('🎉 목소리 목록 로드 성공:', result.data);
            } else {
                console.error('❌ 서버 에러:', result);
                setError(`목소리 목록 로드 실패: ${result.message || '알 수 없는 오류'}`);
            }
        } catch (err) {
            console.error('❌ 목소리 목록 로드 오류:', err);
            
            if (err.name === 'SyntaxError') {
                setError('서버 응답 파싱 오류 - 서버가 실행 중인지 확인하세요');
            } else if (err.message.includes('fetch')) {
                setError('서버 연결 오류 - 백엔드 서버가 실행 중인지 확인하세요');
            } else {
                setError(`오류: ${err.message}`);
            }
        }
    };

    const handleVoiceSelect = (voiceId) => {
        onVoiceChange({ voice_id: voiceId });
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 파일 유효성 검사
        if (!file.type.startsWith('audio/')) {
            setError('오디오 파일만 업로드 가능합니다.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            setError('파일 크기는 10MB 이하여야 합니다.');
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            console.log('📤 파일 업로드 시작:', file.name, file.size, 'bytes');
            
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/tts/upload-voice', {
                method: 'POST',
                body: formData
            });
            
            console.log('📡 업로드 응답 상태:', response.status, response.statusText);
            console.log('📡 업로드 응답 헤더:', response.headers.get('content-type'));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ 업로드 - JSON이 아닌 응답:', textResponse);
                throw new Error(`서버가 JSON이 아닌 응답을 반환했습니다: ${contentType}`);
            }
            
            const responseText = await response.text();
            console.log('📥 업로드 원본 응답:', responseText.substring(0, 200) + '...');
            
            if (!responseText.trim()) {
                throw new Error('서버에서 빈 응답을 반환했습니다');
            }
            
            const result = JSON.parse(responseText);
            console.log('✅ 업로드 파싱된 응답:', result);

            if (result.status === 'success') {
                console.log('🎉 업로드 성공! 새 목소리 ID:', result.voice_id);
                
                // 업로드 성공 - 목소리 목록 새로고침
                await loadVoices();
                
                // 업로드된 목소리 자동 선택
                onVoiceChange({ voice_id: result.voice_id });
                
                setUploadProgress(100);
                setTimeout(() => {
                    setUploading(false);
                    setUploadProgress(0);
                }, 1000);
            } else {
                console.error('❌ 업로드 서버 에러:', result);
                throw new Error(result.message || '업로드 실패');
            }
        } catch (err) {
            console.error('❌ 목소리 업로드 오류:', err);
            
            if (err.name === 'SyntaxError') {
                setError('서버 응답 파싱 오류 - 업로드 API에 문제가 있습니다');
            } else if (err.message.includes('fetch')) {
                setError('서버 연결 오류 - 백엔드 서버가 실행 중인지 확인하세요');
            } else {
                setError(err.message || '업로드 실패');
            }
            
            setUploading(false);
            setUploadProgress(0);
        }

        // 파일 입력 초기화
        event.target.value = '';
    };

    const handleRandomVoice = () => {
        onVoiceChange({ voice_id: null }); // null이면 랜덤 목소리
    };

    return (
        <div className={`voice-selector ${className}`}>
            <div className="voice-selector-header">
                <h3>🎤 목소리 선택</h3>
                {error && (
                    <div className="error-message" style={{ color: 'red', fontSize: '0.9em' }}>
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* 랜덤 목소리 옵션 */}
            <div className="voice-option">
                <button
                    onClick={handleRandomVoice}
                    className={`voice-button ${!selectedVoice ? 'active' : ''}`}
                    style={{
                        padding: '8px 16px',
                        margin: '4px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: !selectedVoice ? '#007bff' : 'white',
                        color: !selectedVoice ? 'white' : '#333',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    🎲 랜덤 목소리
                </button>
            </div>

            {/* 미리 정의된 목소리들 */}
            {voices.predefined_voices.length > 0 && (
                <div className="predefined-voices">
                    <h4>📋 기본 목소리</h4>
                    <div className="voice-grid" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                        gap: '8px',
                        marginBottom: '16px'
                    }}>
                        {voices.predefined_voices.map(voiceId => (
                            <button
                                key={voiceId}
                                onClick={() => handleVoiceSelect(voiceId)}
                                className={`voice-button ${selectedVoice === voiceId ? 'active' : ''}`}
                                style={{
                                    padding: '12px 8px',
                                    border: '2px solid #ddd',
                                    borderRadius: '8px',
                                    backgroundColor: selectedVoice === voiceId ? '#28a745' : 'white',
                                    color: selectedVoice === voiceId ? 'white' : '#333',
                                    cursor: 'pointer',
                                    fontSize: '0.9em',
                                    transition: 'all 0.3s ease',
                                    position: 'relative'
                                }}
                                title={voices.voice_info[voiceId]?.file_path || voiceId}
                            >
                                {voiceId.includes('user_') ? '👤' : '🎵'} {voiceId}
                                {voices.voice_info[voiceId]?.cached && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-5px',
                                        right: '-5px',
                                        backgroundColor: '#17a2b8',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '16px',
                                        height: '16px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        ⚡
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 목소리 업로드 */}
            <div className="voice-upload">
                <h4>📁 목소리 업로드</h4>
                <div style={{ marginBottom: '12px' }}>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        style={{
                            padding: '8px',
                            border: '2px dashed #ddd',
                            borderRadius: '8px',
                            width: '100%',
                            cursor: uploading ? 'not-allowed' : 'pointer'
                        }}
                    />
                </div>
                
                {uploading && (
                    <div className="upload-progress">
                        <div style={{
                            backgroundColor: '#f0f0f0',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            height: '20px',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                backgroundColor: '#007bff',
                                height: '100%',
                                width: `${uploadProgress}%`,
                                transition: 'width 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px'
                            }}>
                                {uploadProgress}%
                            </div>
                        </div>
                        <p style={{ fontSize: '0.9em', color: '#666' }}>업로드 중...</p>
                    </div>
                )}

                <div className="upload-info" style={{ fontSize: '0.8em', color: '#666' }}>
                    <p>💡 지원 형식: .wav, .mp3, .flac (10MB 이하)</p>
                    <p>🎯 권장: 3-30초, 깨끗한 음질, 문장 단위</p>
                </div>
            </div>

            {/* 목소리 정보 */}
            {voices.predefined_voices.length === 0 && (
                <div className="no-voices" style={{ 
                    textAlign: 'center', 
                    color: '#666', 
                    padding: '20px',
                    border: '2px dashed #ddd',
                    borderRadius: '8px',
                    marginTop: '16px'
                }}>
                    <p>📢 사용 가능한 목소리가 없습니다</p>
                    <p style={{ fontSize: '0.9em' }}>
                        assets/voices/ 폴더에 오디오 파일을 추가하거나<br/>
                        위의 업로드 기능을 사용하세요
                    </p>
                </div>
            )}
        </div>
    );
};

export default VoiceSelector;