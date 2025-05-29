import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useConversationFlow } from '../hooks/useConversation';
import { useAudioPlayer } from '../hooks/useAudio';
import { useVADRecorder } from '../hooks/useVAD';
import useChatStore from '../store/chatStore';
import FullScreenAvatar from './FullScreenAvatar';
import TTSEmotionControl from './TTSEmotionControl';
import VADControl from './VADControl';
import '../styles/SimpleVoiceChat.css';

const SimpleVoiceChat = () => {
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
    addSystemMessage,
    setError,
    clearError
  } = useChatStore();
  
  // 🔥 간단한 상태 관리
  const [conversationActive, setConversationActive] = useState(false); // 연속 대화 모드
  const [currentStatus, setCurrentStatus] = useState('disconnected'); // disconnected, ready, talking, listening, thinking
  const [processingStep, setProcessingStep] = useState(''); // STT, GPT, TTS
  const [showFullScreen, setShowFullScreen] = useState(false); // 전체 화면 모드
  const [isVADEnabled, setIsVADEnabled] = useState(true); // VAD 기본 활성화
  const [showTTSControls, setShowTTSControls] = useState(false); // TTS 감정 조절 UI 표시
  const [showVADControls, setShowVADControls] = useState(false); // VAD 설정 UI 표시
  const [currentSettings, setCurrentSettings] = useState({ // 현재 설정 상태
    tts_settings: {
      model: "Zyphra/Zonos-v0.1-tiny",
      emotion: "neutral",
      intensity: 0.7,
      speed: 1.0,
      cfg_scale: 1.5
    },
    vadConfig: {
      voiceThreshold: 0.08,
      silenceThreshold: 0.03,
      minVoiceDuration: 300,
      maxSilenceDuration: 1200,
      bufferDuration: 300,
      sensitivity: 'medium'
    }
  });
  
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
    console.log('🎭 TTS 설정 변경:', newSettings);
    
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
    console.log('🎤 VAD 설정 변경:', newSettings);
    
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
  
  // 🔥 STT 결과 처리
  const handleSTTResult = useCallback((transcript) => {
    console.log('🎤 STT 결과:', transcript);
    setCurrentTranscript(transcript);
    
    if (transcript.trim()) {
      addUserMessage(transcript);
      setCurrentStatus('thinking');
      setProcessingStep('GPT 응답 생성 중...');
    } else {
      if (conversationActiveRef.current) {
        // 빈 음성이면 다시 듣기 시작
        setTimeout(() => {
          setCurrentStatus('listening');
          setProcessingStep('');
          if (startListeningRef.current) {
            startListeningRef.current();
          }
        }, 1000);
      } else {
        setCurrentStatus('ready');
        setProcessingStep('');
      }
    }
  }, [addUserMessage, setCurrentTranscript]);
  
  // 🔥 GPT 응답 처리
  const handleGPTResponse = useCallback((response) => {
    console.log('🤖 GPT 응답:', response);
    addAssistantMessage(response);
    setCurrentStatus('talking');
    setProcessingStep('음성 생성 중...');
  }, [addAssistantMessage]);
  
  // 🔥 TTS 시작 처리
  const handleTTSStart = useCallback((sampleRate, dtype) => {
    console.log('🗣️ TTS 시작');
    setSpeaking(true);
    audioPlayer.startNewAudio();
    setCurrentStatus('talking');
    setProcessingStep('음성 재생 중...');
  }, [audioPlayer, setSpeaking]);
  
  // 🔥 TTS 오디오 처리
  const handleTTSAudio = useCallback(async (audioBuffer, sampleRate = 24000) => {
    try {
      await audioPlayer.playPCMChunk(audioBuffer, sampleRate);
    } catch (error) {
      console.error('❌ 오디오 재생 오류:', error);
      setError('음성 재생 중 오류가 발생했습니다.');
    }
  }, [audioPlayer, setError]);
  
  // 🔥 TTS 완료 처리
  const handleTTSComplete = useCallback(() => {
    console.log('✅ TTS 완료');
    setSpeaking(false);
    setProcessingStep('');
    
    if (conversationActiveRef.current) {
      // 🔥 연속 모드: 자동으로 다음 듣기 시작
      setTimeout(() => {
        setCurrentStatus('listening');
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      }, 1500); // 1.5초 후 자동 시작
    } else {
      setCurrentStatus('ready');
    }
  }, [setSpeaking]);
  
  // 🔥 에러 처리
  const handleError = useCallback((error) => {
    console.error('❌ 대화 오류:', error);
    setError(typeof error === 'string' ? error : '알 수 없는 오류가 발생했습니다.');
    setCurrentStatus('ready');
    setProcessingStep('');
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
        break;
      case 'disconnected':
        setConnected(false);
        setCurrentStatus('disconnected');
        setConversationActive(false);
        break;
      case 'audio_stop_previous':
        audioPlayer.startNewAudio();
        break;
    }
  }, [setConnected, audioPlayer]);
  
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
      setProcessingStep('음성을 인식하고 있습니다...');
    } else {
      setProcessingStep('음성을 인식하고 있습니다...');
    }
  }, [isSpeaking, audioPlayer, conversationFlow, setSpeaking]);

  const handleVoiceEnd = useCallback(() => {
    console.log('🔇 VAD: 음성 종료 감지');
    vadRecorder.stopRecording();
    conversationFlow.stopRecording();
    
    setRecording(false);
    setCurrentStatus('thinking');
    setProcessingStep('음성 분석 중...');
  }, [vadRecorder, conversationFlow, setRecording]);

  const handleSilenceDetected = useCallback(() => {
    console.log('🤫 VAD: 긴 정적 감지 - 자동 녹음 중지');
    if (conversationActiveRef.current && isVADEnabledRef.current) {
      // VAD가 활성화된 연속 모드에서는 자동으로 다음 음성 대기
      setTimeout(() => {
        setCurrentStatus('listening');
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      }, 1500);
    } else {
      setCurrentStatus('ready');
      setProcessingStep('');
    }
  }, []);

  // 🔥 PCM 데이터 핸들러
  const handlePCMData = useCallback((arrayBuffer) => {
    if (conversationFlow.isConnected()) {
      conversationFlow.sendVoiceData(arrayBuffer);
    }
  }, [conversationFlow]);
  
  // 🔥 연결 시작
  const startConnection = useCallback(async () => {
    try {
      clearError();
      
      // 오디오 컨텍스트 활성화
      await audioPlayer.resumeContext();
      
      // WebSocket 연결
      await conversationFlow.connectConversation(
        handleSTTResult,
        handleGPTResponse,
        handleTTSStart,
        handleTTSAudio,
        handleTTSComplete,
        handleError,
        handleStateChange
      );
      
      // 🔥 현재 설정으로 서버 설정
      conversationFlow.updateSettings({
        language: "ko",
        ...currentSettings,
        performance_mode: "fast",
        system_prompt: "친근하고 도움이 되는 AI 어시스턴트로서 간단하고 명확하게 대답해주세요. 한두 문장으로 답변해주세요."
      });
      
      addSystemMessage('💬 대화 준비 완료! 아래 버튼을 눌러 대화를 시작하세요.');
      
    } catch (error) {
      console.error('❌ 연결 실패:', error);
      setError('연결에 실패했습니다. 다시 시도해주세요.');
    }
  }, [audioPlayer, conversationFlow, handleSTTResult, handleGPTResponse, handleTTSStart, handleTTSAudio, handleTTSComplete, handleError, handleStateChange, clearError, addSystemMessage, currentSettings]);
  
  // 🔥 듣기 시작 (VAD 지원) - ref로 저장
  const startListening = useCallback(async () => {
    if (!isConnected) {
      setError('먼저 연결을 시작해주세요.');
      return;
    }
    
    try {
      setCurrentTranscript('');
      clearError();
      setProcessingStep(isVADEnabledRef.current ? '음성을 기다리고 있습니다... (자동 감지)' : '음성 인식 중...');
      
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
      
    } catch (error) {
      console.error('❌ 녹음 시작 오류:', error);
      setError('마이크 접근이 필요합니다.');
      setProcessingStep('');
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
    setProcessingStep('음성 분석 중...');
  }, [vadRecorder, conversationFlow, setRecording]);
  
  // 🔥 대화 시작 (한 번 클릭으로 연속 모드 시작)
  const startConversation = useCallback(async () => {
    if (!isConnected) {
      await startConnection();
      return;
    }
    
    setConversationActive(true);
    addSystemMessage(isVADEnabled ? '🤖 VAD 모드로 연속 대화 시작! 자동으로 음성을 감지합니다.' : '💬 연속 대화 모드 시작! AI와 자유롭게 대화하세요.');
    
    // 즉시 첫 번째 듣기 시작
    await startListening();
  }, [isConnected, startConnection, addSystemMessage, startListening, isVADEnabled]);
  
  // 🔥 대화 중지
  const stopConversation = useCallback(() => {
    setConversationActive(false);
    
    // 현재 진행 중인 작업들 모두 중지
    vadRecorder.stopRecording();
    audioPlayer.stop();
    conversationFlow.stopSpeaking();
    
    setRecording(false);
    setSpeaking(false);
    setCurrentStatus('ready');
    setProcessingStep('');
    
    addSystemMessage('🛑 대화가 중지되었습니다.');
  }, [vadRecorder, audioPlayer, conversationFlow, setRecording, setSpeaking, addSystemMessage]);
  
  // 🔥 연결 종료
  const disconnect = useCallback(() => {
    stopConversation();
    conversationFlow.close();
    
    setConnected(false);
    setCurrentStatus('disconnected');
    addSystemMessage('👋 연결이 종료되었습니다.');
  }, [stopConversation, conversationFlow, setConnected, addSystemMessage]);
  
  // 🔥 전체 화면 모드 열기
  const openFullScreen = useCallback(async () => {
    setShowFullScreen(true);
  }, []);

  // 🔥 전체 화면 모드 닫기
  const closeFullScreen = useCallback(() => {
    setShowFullScreen(false);
  }, []);

  // 🔥 상태별 버튼 및 메시지
  const getMainButton = () => {
    if (!isConnected) {
      return (
        <>
          <button 
            className="main-button connect-button"
            onClick={startConnection}
            disabled={false}
          >
            <span className="button-icon">🔌</span>
            <span className="button-text">대화 시작</span>
          </button>
          
          <button 
            className="main-button fullscreen-button"
            onClick={openFullScreen}
            disabled={false}
          >
            <span className="button-icon">🔌</span>
            <span className="button-text">대화 시작</span>
            <span className="button-subtitle">전체 화면 모드로 대화</span>
          </button>
        </>
      );
    }
    
    if (!conversationActive) {
      return (
        <button 
          className="main-button start-conversation-button"
          onClick={startConversation}
          disabled={false}
        >
          <span className="button-icon">💬</span>
          <span className="button-text">{isVADEnabled ? 'VAD 대화하기' : '대화하기'}</span>
          <span className="button-subtitle">{isVADEnabled ? '자동 음성 감지 모드' : '한 번 클릭으로 연속 대화'}</span>
        </button>
      );
    }
    
    // 연속 대화 중일 때는 중지 버튼만 표시
    return (
      <button 
        className="main-button stop-conversation-button"
        onClick={stopConversation}
      >
        <span className="button-icon">🛑</span>
        <span className="button-text">대화 중지</span>
      </button>
    );
  };
  
  const getStatusMessage = () => {
    const messages = {
      disconnected: '🔴 연결이 필요합니다',
      ready: '🟢 대화 준비 완료',
      listening: isVADEnabled ? '🎤 말씀해 주세요... (자동 감지)' : '🎤 말씀해 주세요...',
      thinking: '🤔 AI가 생각하고 있어요...',
      talking: '🗣️ AI가 답변하고 있어요...'
    };
    
    return messages[currentStatus] || messages.ready;
  };
  
  const getStatusColor = () => {
    const colors = {
      disconnected: '#f44336',
      ready: '#4caf50',
      listening: '#2196f3',
      thinking: '#9c27b0',
      talking: '#ff9800'
    };
    
    return colors[currentStatus] || colors.ready;
  };
  
  return (
    <>
      {/* 전체 화면 아바타 모드 */}
      {showFullScreen && (
        <FullScreenAvatar onClose={closeFullScreen} />
      )}
      
      <div className="simple-voice-chat">
        {/* 🔥 상태 표시 */}
        <div className="status-section">
          <div 
            className="status-indicator"
            style={{ '--status-color': getStatusColor() }}
          >
            <div className="status-pulse"></div>
            <div className="status-message">{getStatusMessage()}</div>
          </div>
          
          {processingStep && (
            <div className="processing-step">
              <div className="processing-spinner"></div>
              <span>{processingStep}</span>
            </div>
          )}
          
          {/* 현재 인식된 음성 표시 */}
          {currentTranscript && (
            <div className="current-transcript">
              <span className="transcript-label">인식된 음성:</span>
              <span className="transcript-text">"{currentTranscript}"</span>
            </div>
          )}
          
          {/* VAD 음성 레벨 표시 */}
          {isVADEnabled && vadRecorder.isRecording && (
            <div className="vad-level-display">
              <div className="vad-header">
                <span className="vad-label">음성 강도:</span>
                <span className={`vad-status ${vadRecorder.isVoiceDetected ? 'active' : 'inactive'}`}>
                  {vadRecorder.isVoiceDetected ? '🎤 음성 감지' : '⚪ 대기 중'}
                </span>
              </div>
              <div className="vad-level-bar">
                <div 
                  className="vad-level-fill"
                  style={{ width: `${Math.min(100, vadRecorder.voiceLevel * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        
        {/* 🔥 메인 컨트롤 버튼 */}
        <div className="control-section">
          {getMainButton()}
          
          {/* 연결된 상태에서만 추가 버튼들 표시 */}
          {isConnected && (
            <>
              {/* 설정 버튼들 */}
              <div className="settings-buttons">
                <button 
                  className={`secondary-button tts-settings-button ${showTTSControls ? 'active' : ''}`}
                  onClick={() => setShowTTSControls(!showTTSControls)}
                >
                  <span className="button-icon">🎭</span>
                  <span className="button-text">TTS 설정</span>
                </button>
                
                <button 
                  className={`secondary-button vad-settings-button ${showVADControls ? 'active' : ''}`}
                  onClick={() => setShowVADControls(!showVADControls)}
                >
                  <span className="button-icon">🎙️</span>
                  <span className="button-text">VAD 설정</span>
                </button>
                
                {/* VAD 토글 버튼 */}
                <button 
                  className={`secondary-button vad-toggle-button ${isVADEnabled ? 'active' : ''}`}
                  onClick={() => setIsVADEnabled(!isVADEnabled)}
                >
                  <span className="button-icon">{isVADEnabled ? '🤖' : '🎚️'}</span>
                  <span className="button-text">{isVADEnabled ? 'VAD 활성' : 'VAD 비활성'}</span>
                </button>
              </div>

              <button 
                className="secondary-button disconnect-button"
                onClick={disconnect}
              >
                <span className="button-icon">🔌</span>
                <span className="button-text">연결 해제</span>
              </button>
            </>
          )}
        </div>

        {/* 🔥 TTS 감정 조절 UI */}
        {showTTSControls && (
          <div className="settings-panel">
            <TTSEmotionControl 
              onSettingsChange={handleTTSSettingsChange}
              currentSettings={currentSettings}
              isVisible={showTTSControls}
            />
          </div>
        )}

        {/* 🔥 VAD 설정 UI */}
        {showVADControls && (
          <div className="settings-panel">
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
        
        {/* 🔥 대화 모드에 따른 안내 메시지 */}
        {conversationActive && (
          <div className="conversation-mode-status">
            <div className="mode-indicator">
              <span className="mode-icon">🔄</span>
              <span className="mode-text">{isVADEnabled ? 'VAD 연속 대화 모드 활성' : '연속 대화 모드 활성'}</span>
            </div>
            <div className="mode-description">
              {isVADEnabled 
                ? 'AI가 말하는 중에 음성을 감지하면 AI 응답을 중단하고 즉시 듣기 시작합니다. 말을 멈추면 자동으로 다음 대화가 시작됩니다.'
                : 'AI 답변 후 자동으로 다음 대화가 시작됩니다'
              }
            </div>
          </div>
        )}
        
        {/* 🔥 수동 컨트롤 (연속 모드가 아닐 때만) */}
        {isConnected && !conversationActive && currentStatus === 'ready' && (
          <div className="manual-controls">
            <button 
              className="manual-button"
              onClick={startListening}
            >
              🎤 한 번만 말하기
            </button>
          </div>
        )}
        
        {/* 🔥 듣기 중일 때 중지 버튼 (VAD 비활성 시만) */}
        {isRecording && !isVADEnabled && (
          <div className="listening-controls">
            <button 
              className="stop-listening-button"
              onClick={stopListening}
            >
              ⏹️ 말하기 완료
            </button>
          </div>
        )}
        
        {/* 🔥 에러 표시 */}
        {error && (
          <div className="error-section">
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
              <button 
                className="error-close"
                onClick={clearError}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SimpleVoiceChat;