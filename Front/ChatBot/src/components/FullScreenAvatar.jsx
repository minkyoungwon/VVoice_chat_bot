import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConversationFlow } from '../hooks/useConversation';
import { useAudioPlayer } from '../hooks/useAudio';
import { useVADRecorder } from '../hooks/useVAD';
import useChatStore from '../store/chatStore';
import UnifiedProgressBar from './UnifiedProgressBar';
import TTSEmotionControl from './TTSEmotionControl';
import VADControl from './VADControl';
import '../styles/FullScreenAvatar.css';

const FullScreenAvatar = ({ onClose }) => {
  const {
    isConnected,
    isRecording,
    isSpeaking,
    currentTranscript,
    error,
    setConnected,
    setRecording,
    setSpeaking,
    setCurrentTranscript,
    addUserMessage,
    addAssistantMessage,
    setError,
    clearError
  } = useChatStore();

  // 전체 화면 모드 상태
  const [isFullScreenMode, setIsFullScreenMode] = useState(true);
  const [conversationActive, setConversationActive] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('disconnected');
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [isVADEnabled, setIsVADEnabled] = useState(true);
  const [showTTSControls, setShowTTSControls] = useState(false); // TTS 설정 UI
  const [showVADControls, setShowVADControls] = useState(false); // VAD 설정 UI
  const [currentSettings, setCurrentSettings] = useState({ // 현재 설정 상태
    tts_settings: {
      model: "Zyphra/Zonos-v0.1-tiny",
      emotion: "neutral",
      intensity: 0.7,
      speed: 1.0,
      cfg_scale: 1.5
    },
    vadConfig: {
      voiceThreshold: 0.06,      // 전체 화면 모드에서 더 민감하게
      silenceThreshold: 0.02,
      minVoiceDuration: 200,
      maxSilenceDuration: 1000,
      bufferDuration: 200,
      sensitivity: 'high' // 기본적으로 높은 민감도
    }
  });
  
  // 아바타 애니메이션 상태
  const [avatarState, setAvatarState] = useState('idle'); // idle, listening, thinking, speaking
  const [animationFrame, setAnimationFrame] = useState(0);
  const [glowEffect, setGlowEffect] = useState(0);
  
  // 📝 ref를 통한 상태 참조 (의존성 순환 방지)
  const conversationActiveRef = useRef(false);
  const isVADEnabledRef = useRef(true);
  
  // ref 동기화
  useEffect(() => {
    conversationActiveRef.current = conversationActive;
  }, [conversationActive]);
  
  useEffect(() => {
    isVADEnabledRef.current = isVADEnabled;
  }, [isVADEnabled]);
  
  // 훅들
  const conversationFlow = useConversationFlow();
  const audioPlayer = useAudioPlayer();
  const vadRecorder = useVADRecorder();

  // 🔥 startListening을 ref로 저장 (의존성 순환 방지)
  const startListeningRef = useRef();

  // 🔥 설정 변경 핸들러
  const handleTTSSettingsChange = useCallback((newSettings) => {
    console.log('🎭 전체화면 TTS 설정 변경:', newSettings);
    
    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };
    
    setCurrentSettings(updatedSettings);
    
    // 연결된 상태에서만 서버에 설정 전송
    if (isConnected) {
      conversationFlow.updateSettings({
        language: "ko",
        ...newSettings,
        performance_mode: "fast",
        system_prompt: "친근하고 도움이 되는 AI 어시스턴트로서 간단하고 명확하게 대답해주세요. 한두 문장으로 답변해주세요."
      });
    }
  }, [currentSettings, isConnected, conversationFlow]);
  
  const handleVADSettingsChange = useCallback((newSettings) => {
    console.log('🎤 전체화면 VAD 설정 변경:', newSettings);
    
    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };
    
    setCurrentSettings(updatedSettings);
    
    // VAD 녹음 중이면 새 설정 적용
    if (vadRecorder.isRecording && newSettings.vadConfig) {
      vadRecorder.updateVADConfig(newSettings.vadConfig);
    }
  }, [currentSettings, vadRecorder]);

  // 🔥 VAD 이벤트 핸들러들
  const handleVoiceStart = useCallback(() => {
    console.log('🎤 VAD: 음성 시작 감지');
    
    // 🔥 TTS 중에 음성이 감지되면 TTS 중단
    if (isSpeaking) {
      console.log('🔇 TTS 중에 음성 감지 - TTS 중단');
      audioPlayer.stop(); // 오디오 재생 중단
      conversationFlow.stopSpeaking(); // 서버에 TTS 중단 요청
      setSpeaking(false);
      setCurrentStatus('listening');
      setAvatarState('listening');
      setProcessingStep('AI가 당신의 음성을 듣고 있습니다...');
      setProgress(10);
    } else {
      setAvatarState('listening');
      setProcessingStep('AI가 당신의 음성을 듣고 있습니다...');
      setProgress(10);
    }
  }, [isSpeaking, audioPlayer, conversationFlow, setSpeaking]);

  const handleVoiceEnd = useCallback(() => {
    console.log('🔇 VAD: 음성 종료 감지');
    vadRecorder.stopRecording();
    conversationFlow.stopRecording();
    
    setRecording(false);
    setCurrentStatus('thinking');
    setAvatarState('thinking');
    setProcessingStep('AI가 당신의 말을 분석하고 있습니다...');
    setProgress(25);
  }, [vadRecorder, conversationFlow, setRecording]);

  const handleSilenceDetected = useCallback(() => {
    console.log('🤫 VAD: 긴 정적 감지 - 자동 녹음 중지');
    if (conversationActiveRef.current && isVADEnabledRef.current) {
      // VAD가 활성화된 연속 모드에서는 자동으로 다음 음성 대기
      setTimeout(() => {
        setCurrentStatus('listening');
        setAvatarState('listening');
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      }, 2000);
    } else {
      setCurrentStatus('ready');
      setAvatarState('idle');
      setProcessingStep('');
      setProgress(0);
    }
  }, []);

  // 🔥 PCM 데이터 핸들러
  const handlePCMData = useCallback((arrayBuffer) => {
    if (conversationFlow.isConnected()) {
      conversationFlow.sendVoiceData(arrayBuffer);
    }
  }, [conversationFlow]);

  // 🔥 STT 결과 처리
  const handleSTTResult = useCallback((transcript) => {
    console.log('🎤 STT 결과:', transcript);
    setCurrentTranscript(transcript);
    
    if (transcript.trim()) {
      addUserMessage(transcript);
      setCurrentStatus('thinking');
      setAvatarState('thinking');
      setProcessingStep('AI가 답변을 생각하고 있습니다...');
      setProgress(30);
    } else {
      if (conversationActiveRef.current) {
        setTimeout(() => {
          setCurrentStatus('listening');
          setAvatarState('listening');
          setProcessingStep('');
          setProgress(0);
          if (startListeningRef.current) {
            startListeningRef.current();
          }
        }, 1000);
      } else {
        setCurrentStatus('ready');
        setAvatarState('idle');
        setProcessingStep('');
        setProgress(0);
      }
    }
  }, [addUserMessage, setCurrentTranscript]);

  // 🔥 GPT 응답 처리
  const handleGPTResponse = useCallback((response) => {
    console.log('🤖 GPT 응답:', response);
    addAssistantMessage(response);
    setCurrentStatus('talking');
    setAvatarState('speaking');
    setProcessingStep('AI 목소리로 변환하고 있습니다...');
    setProgress(60);
  }, [addAssistantMessage]);

  // 🔥 TTS 시작 처리
  const handleTTSStart = useCallback((sampleRate, dtype) => {
    console.log('🗣️ TTS 시작');
    setSpeaking(true);
    audioPlayer.startNewAudio();
    setCurrentStatus('talking');
    setAvatarState('speaking');
    setProcessingStep('AI가 말하고 있습니다...');
    setProgress(80);
  }, [audioPlayer, setSpeaking]);

  // 🔥 TTS 오디오 처리
  const handleTTSAudio = useCallback(async (audioBuffer, sampleRate = 24000) => {
    try {
      await audioPlayer.playPCMChunk(audioBuffer, sampleRate);
      setProgress(90);
    } catch (error) {
      console.error('❌ 오디오 재생 오류:', error);
      setError('음성 재생 중 오류가 발생했습니다.');
    }
  }, [audioPlayer, setError]);

  // 🔥 TTS 완료 처리
  const handleTTSComplete = useCallback(() => {
    console.log('✅ TTS 완료');
    setSpeaking(false);
    setAvatarState('idle');
    setProcessingStep('');
    setProgress(100);
    
    setTimeout(() => {
      setProgress(0);
      if (conversationActiveRef.current) {
        setCurrentStatus('listening');
        setAvatarState('listening');
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      } else {
        setCurrentStatus('ready');
        setAvatarState('idle');
      }
    }, 1000);
  }, [setSpeaking]);

  // 🔥 에러 처리
  const handleError = useCallback((error) => {
    console.error('❌ 대화 오류:', error);
    setError(typeof error === 'string' ? error : '알 수 없는 오류가 발생했습니다.');
    setCurrentStatus('ready');
    setAvatarState('idle');
    setProcessingStep('');
    setProgress(0);
    setSpeaking(false);
    setRecording(false);
  }, [setError, setSpeaking, setRecording]);

  // 🔥 상태 변경 처리
  const handleStateChange = useCallback((state, data) => {
    console.log('📊 상태 변경:', state, data);
    
    switch (state) {
      case 'connected':
        setConnected(true);
        setCurrentStatus('ready');
        setAvatarState('idle');
        setProgress(0);
        break;
      case 'disconnected':
        setConnected(false);
        setCurrentStatus('disconnected');
        setAvatarState('idle');
        setConversationActive(false);
        setProgress(0);
        break;
      case 'audio_stop_previous':
        audioPlayer.startNewAudio();
        break;
    }
  }, [setConnected, audioPlayer]);

  // 🔥 연결 시작
  const startConnection = useCallback(async () => {
    try {
      clearError();
      setProcessingStep('AI와의 연결을 시작하는 중...');
      setProgress(10);
      
      await audioPlayer.resumeContext();
      setProgress(20);
      
      await conversationFlow.connectConversation(
        handleSTTResult,
        handleGPTResponse,
        handleTTSStart,
        handleTTSAudio,
        handleTTSComplete,
        handleError,
        handleStateChange
      );
      
      conversationFlow.updateSettings({
        language: "ko",
        ...currentSettings,
        performance_mode: "fast",
        system_prompt: "친근하고 도움이 되는 AI 어시스턴트로서 간단하고 명확하게 대답해주세요. 한두 문장으로 답변해주세요."
      });
      
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setProcessingStep('');
      }, 500);
      
    } catch (error) {
      console.error('❌ 연결 실패:', error);
      setError('AI와의 연결에 실패했습니다. 다시 시도해주세요.');
      setProgress(0);
      setProcessingStep('');
    }
  }, [audioPlayer, conversationFlow, handleSTTResult, handleGPTResponse, handleTTSStart, handleTTSAudio, handleTTSComplete, handleError, handleStateChange, clearError, currentSettings]);

  // 🔥 듣기 시작 (VAD 지원) - ref로 저장
  const startListening = useCallback(async () => {
    if (!isConnected) {
      setError('먼저 연결을 시작해주세요.');
      return;
    }
    
    try {
      setCurrentTranscript('');
      clearError();
      setProcessingStep('AI가 당신의 음성을 기다리고 있습니다...');
      setProgress(5);
      
      if (isVADEnabledRef.current) {
        // VAD 모드로 녹음 시작 - 현재 설정 사용
        await vadRecorder.startRecording(handlePCMData, {
          onVoiceStart: handleVoiceStart,
          onVoiceEnd: handleVoiceEnd,
          onSilenceDetected: handleSilenceDetected,
          vadConfig: currentSettings.vadConfig
        });
      } else {
        // 일반 모드로 녹음 시작 (기존 방식)
        await vadRecorder.startRecording(handlePCMData);
      }
      
      setRecording(true);
      setCurrentStatus('listening');
      setAvatarState('listening');
      
    } catch (error) {
      console.error('❌ 녹음 시작 오류:', error);
      setError('마이크 접근이 필요합니다.');
      setProcessingStep('');
      setProgress(0);
    }
  }, [isConnected, vadRecorder, handlePCMData, handleVoiceStart, handleVoiceEnd, handleSilenceDetected, setCurrentTranscript, clearError, setRecording, setError, currentSettings.vadConfig]);
  
  // startListening을 ref에 저장
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // 🔥 듣기 중지
  const stopListening = useCallback(() => {
    vadRecorder.stopRecording();
    conversationFlow.stopRecording();
    
    setRecording(false);
    setCurrentStatus('thinking');
    setAvatarState('thinking');
    setProcessingStep('AI가 당신의 말을 분석하고 있습니다...');
    setProgress(25);
  }, [vadRecorder, conversationFlow, setRecording]);

  // 🔥 대화 시작
  const startConversation = useCallback(async () => {
    if (!isConnected) {
      await startConnection();
      return;
    }
    
    setConversationActive(true);
    await startListening();
  }, [isConnected, startConnection, startListening]);

  // 🔥 대화 중지
  const stopConversation = useCallback(() => {
    setConversationActive(false);
    
    vadRecorder.stopRecording();
    audioPlayer.stop();
    conversationFlow.stopSpeaking();
    
    setRecording(false);
    setSpeaking(false);
    setCurrentStatus('ready');
    setAvatarState('idle');
    setProcessingStep('');
    setProgress(0);
  }, [vadRecorder, audioPlayer, conversationFlow, setRecording, setSpeaking]);

  // 🔥 아바타 애니메이션 효과
  useEffect(() => {
    let interval;
    
    if (avatarState === 'speaking') {
      // 말할 때 애니메이션 효과
      interval = setInterval(() => {
        setAnimationFrame(prev => (prev + 1) % 4);
      }, 150);
    } else if (avatarState === 'listening') {
      // 듣고 있을 때 깜빡임 효과
      interval = setInterval(() => {
        setGlowEffect(prev => (prev + 1) % 3);
      }, 800);
    } else if (avatarState === 'thinking') {
      // 생각할 때 펄스 효과
      interval = setInterval(() => {
        setGlowEffect(prev => (prev + 1) % 2);
      }, 1200);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [avatarState]);

  // 🔥 전체 화면 모드 진입/해제
  useEffect(() => {
    if (isFullScreenMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFullScreenMode]);

  // 🔥 ESC 키로 전체 화면 종료
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // 🔥 아바타 렌더링 (수정된 부분)
  const renderAvatar = () => {
    return (
      <div className={`fullscreen-avatar avatar-${avatarState}`}>
        {/* 배경 효과 */}
        <div className="avatar-background-effects">
          <div className="ambient-glow"></div>
          <div className="pulse-ring"></div>
          {avatarState === 'listening' && (
            <div className="sound-waves">
              <div className="wave wave-1"></div>
              <div className="wave wave-2"></div>
              <div className="wave wave-3"></div>
            </div>
          )}
        </div>
        
        {/* 메인 아바타 이미지 영역 */}
        <div className="avatar-image-container">
          {/* 사용자가 수정할 이미지 공간 - 아래 코멘트 참고 */}
          {/* 
          이 부분을 수정하여 원하는 이미지나 애니메이션을 추가하세요.
          예시:
          <img src="/path/to/your/avatar.png" alt="Avatar" className="avatar-image" />
          또는
          <div className="custom-avatar-animation">
            {/* 커스텀 애니메이션 내용 */}
            <img src="/path/to/your/avatar.png" alt="Avatar" className="avatar-image" />
          또는
          <div className="custom-avatar-animation">
          </div>
          */
          
          {/* 기본 플레이스홀더 (이미지 추가 전까지 임시 표시) */}
          <div className="avatar-placeholder">
            <div className={`placeholder-icon glow-${glowEffect}`}>
              {avatarState === 'idle' && '😊'}
              {avatarState === 'listening' && '👂'}
              {avatarState === 'thinking' && '🤔'}
              {avatarState === 'speaking' && '🗣️'}
            </div>
            
            {/* 애니메이션 효과 */}
            {avatarState === 'speaking' && (
              <div className="speaking-animation">
                <div className={`speech-indicator frame-${animationFrame}`}></div>
              </div>
            )}
            
            {avatarState === 'thinking' && (
              <div className="thinking-animation">
                <div className="thinking-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* AI 상태 메시지 */}
        <div className="avatar-status-message">
          {avatarState === 'idle' && "안녕하세요! 무엇을 도와드릴까요?"}
          {avatarState === 'listening' && (isVADEnabled ? "말씀해 주세요... 자동으로 감지하고 있어요." : "말씀해 주세요... 듣고 있어요.")}
          {avatarState === 'thinking' && "생각하고 있어요..."}
          {avatarState === 'speaking' && "답변드릴게요!"}
        </div>
        
        {/* VAD 음성 레벨 표시 */}
        {isVADEnabled && vadRecorder.isRecording && (
          <div className="vad-level-display">
            <div className="vad-label">음성 강도:</div>
            <div className="vad-level-bar">
              <div 
                className="vad-level-fill"
                style={{ width: `${Math.min(100, vadRecorder.voiceLevel * 100)}%` }}
              ></div>
            </div>
            <div className={`vad-status ${vadRecorder.isVoiceDetected ? 'active' : 'inactive'}`}>
              {vadRecorder.isVoiceDetected ? '🎤 음성 감지' : '⚪ 대기 중'}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fullscreen-avatar-container">
      {/* 전체 화면 오버레이 */}
      <div className="fullscreen-overlay">
        {/* 헤더 */}
        <div className="fullscreen-header">
          <h1 className="fullscreen-title">대화 모드</h1>
          <div className="fullscreen-header-controls">
            {/* 설정 버튼들 */}
            {isConnected && (
              <div className="header-settings">
                <button 
                  className={`header-btn tts-btn ${showTTSControls ? 'active' : ''}`}
                  onClick={() => setShowTTSControls(!showTTSControls)}
                  title="TTS 설정"
                >
                  🎭
                </button>
                <button 
                  className={`header-btn vad-btn ${showVADControls ? 'active' : ''}`}
                  onClick={() => setShowVADControls(!showVADControls)}
                  title="VAD 설정"
                >
                  🎙️
                </button>
              </div>
            )}
            <button className="close-fullscreen-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        
        {/* 설정 패널들 */}
        {showTTSControls && (
          <div className="fullscreen-settings-panel">
            <TTSEmotionControl 
              onSettingsChange={handleTTSSettingsChange}
              currentSettings={currentSettings}
              isVisible={showTTSControls}
            />
          </div>
        )}

        {showVADControls && (
          <div className="fullscreen-settings-panel">
            <VADControl 
              onSettingsChange={handleVADSettingsChange}
              currentSettings={currentSettings}
              isVisible={showVADControls}
              isRecording={vadRecorder.isRecording}
              voiceLevel={vadRecorder.voiceLevel}
              isVoiceDetected={vadRecorder.isVoiceDetected}
            />
          </div>
        )}
        
        {/* 메인 아바타 영역 */}
        <div className="fullscreen-main">
          {/* 아바타 */}
          <div className="avatar-section">
            {renderAvatar()}
          </div>
          
          {/* 프로그래스 바 */}
          {(processingStep || progress > 0) && (
            <div className="progress-section">
              <UnifiedProgressBar 
                isVisible={true}
                progress={progress}
                status={processingStep}
                variant="venom"
              />
            </div>
          )}
          
          {/* 현재 인식된 음성 */}
          {currentTranscript && (
            <div className="transcript-section">
              <div className="transcript-bubble">
                <span className="transcript-label">당신이 말한 것:</span>
                <span className="transcript-text">"{currentTranscript}"</span>
              </div>
            </div>
          )}
          
          {/* 컨트롤 버튼들 */}
          <div className="fullscreen-controls">
            {!isConnected ? (
              <button className="main-control-btn connect-btn" onClick={startConnection}>
                <span className="btn-icon">🔌</span>
                <span className="btn-text">AI와 연결</span>
              </button>
            ) : !conversationActive ? (
              <>
                <button className="main-control-btn start-btn" onClick={startConversation}>
                  <span className="btn-icon">🎤</span>
                  <span className="btn-text">{isVADEnabled ? 'VAD 대화 시작' : '일반 대화 시작'}</span>
                  <span className="btn-subtitle">{isVADEnabled ? '자동 음성 감지' : '수동 음성 제어'}</span>
                </button>
                
                {/* VAD 토글 버튼 */}
                <button 
                  className={`control-btn vad-toggle-btn ${isVADEnabled ? 'active' : ''}`}
                  onClick={() => setIsVADEnabled(!isVADEnabled)}
                >
                  <span className="btn-icon">{isVADEnabled ? '🤖' : '🎚️'}</span>
                  <span className="btn-text">{isVADEnabled ? 'VAD 활성' : 'VAD 비활성'}</span>
                </button>
              </>
            ) : (
              <div className="active-controls">
                {isRecording && !isVADEnabled ? (
                  <button className="control-btn stop-recording-btn" onClick={stopListening}>
                    <span className="btn-icon">⏹️</span>
                    <span className="btn-text">말하기 완료</span>
                  </button>
                ) : !isRecording && !isSpeaking ? (
                  <button className="control-btn start-listening-btn" onClick={startListening}>
                    <span className="btn-icon">🎤</span>
                    <span className="btn-text">다시 말하기</span>
                  </button>
                ) : null}
                
                <button className="control-btn stop-conversation-btn" onClick={stopConversation}>
                  <span className="btn-icon">🛑</span>
                  <span className="btn-text">대화 중지</span>
                </button>
              </div>
            )}
          </div>
          
          {/* 에러 메시지 */}
          {error && (
            <div className="error-section">
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{error}</span>
                <button className="error-close" onClick={clearError}>✕</button>
              </div>
            </div>
          )}
        </div>
        
        {/* 푸터 */}
        <div className="fullscreen-footer">
          <p className="footer-text">ESC 키를 누르거나 X 버튼을 클릭하면 전체 화면 모드를 종료합니다</p>
        </div>
      </div>
    </div>
  );
};

export default FullScreenAvatar;