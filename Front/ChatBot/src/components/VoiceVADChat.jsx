import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useConversationFlow } from '../hooks/useConversation';
import { useAudioPlayer } from '../hooks/useAudio';
import { useVADRecorder } from '../hooks/useVAD'; // 🔥 VAD 훅 사용
import UnifiedProgressBar from './UnifiedProgressBar';
import VADControl from './VADControl'; // 🔥 VAD 컨트롤 추가
import TTSEmotionControl from './TTSEmotionControl'; // 🔥 TTS 감정 컨트롤 추가
import useChatStore from '../store/chatStore';

import '../styles/VoiceChat.css';

const VoiceVADChat = () => {
  const {
    isConnected,
    isRecording,
    isPlaying,
    isSpeaking,
    currentTranscript,
    settings,
    error,
    setConnected,
    setRecording,
    setPlaying,
    setSpeaking,
    setCurrentTranscript,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    setError,
    clearError
  } = useChatStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentState, setCurrentState] = useState('disconnected');
  const [continuousMode, setContinuousMode] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(false); // 🔥 VAD 활성화 상태
  const [showVADSettings, setShowVADSettings] = useState(false); // 🔥 VAD 설정 표시
  const [showTTSSettings, setShowTTSSettings] = useState(false); // 🔥 TTS 설정 표시
  
  // 🔥 VAD 설정 상태
  const [vadSettings, setVadSettings] = useState({
    vadConfig: {
      voiceThreshold: 0.08,
      silenceThreshold: 0.03,
      minVoiceDuration: 300,
      maxSilenceDuration: 1200,
      bufferDuration: 300,
      sensitivity: 'medium'
    }
  });
  
  // 🔥 프로그레스바 상태 관리
  const [progressState, setProgressState] = useState({
    stage: 'idle',
    progress: 0,
    message: '',
    subMessage: '',
    isVisible: false,
    processingTime: 0,
    estimatedDuration: 0,
    startTime: null
  });
  
  // 🔥 프로그레스바 업데이트 함수
  const updateProgress = useCallback((updates) => {
    setProgressState(prev => {
      const newState = { ...prev, ...updates };
      
      if (updates.stage && updates.stage !== 'idle' && !prev.startTime) {
        newState.startTime = Date.now();
        newState.processingTime = 0;
      }
      
      if (updates.stage === 'idle' && prev.startTime) {
        newState.processingTime = (Date.now() - prev.startTime) / 1000;
        newState.startTime = null;
      }
      
      return newState;
    });
  }, []);
  
  // 훅들
  const conversationFlow = useConversationFlow();
  const audioPlayer = useAudioPlayer();
  const vadRecorder = useVADRecorder(); // 🔥 VAD 레코더 사용
  
  // 🔥 VAD 이벤트 핸들러들
  const handleVoiceStart = useCallback(() => {
    console.log('🎤 VAD: 음성 감지 시작');
    const store = useChatStore.getState();
    store.addSystemMessage('🎤 음성이 감지되었습니다...');
    
    updateProgress({
      stage: 'stt',
      progress: 10,
      message: '음성을 인식하고 있습니다...',
      subMessage: '말씀하고 계신 것을 듣고 있어요',
      isVisible: true,
      estimatedDuration: 5.0
    });
  }, [updateProgress]);
  
  const handleVoiceEnd = useCallback(() => {
    console.log('🔇 VAD: 음성 종료 감지');
    
    updateProgress({
      progress: 50,
      message: '음성을 분석하고 있습니다...',
      subMessage: 'Whisper AI가 음성을 텍스트로 변환 중'
    });
    
    // 🔥 VAD가 음성 종료를 감지하면 자동으로 녹음 중단
    if (vadRecorder.isRecording) {
      vadRecorder.stopRecording();
      conversationFlow.stopRecording();
      
      const store = useChatStore.getState();
      store.setRecording(false);
      setCurrentState('processing');
      store.addSystemMessage('🔇 음성 종료가 감지되어 처리 중입니다...');
    }
  }, [vadRecorder, conversationFlow, updateProgress]);
  
  const handleSilenceDetected = useCallback(() => {
    console.log('🔇 VAD: 정적 감지됨 - 자동 처리 시작');
    
    const store = useChatStore.getState();
    store.addSystemMessage('🤫 충분한 정적이 감지되어 음성을 처리합니다...');
  }, []);
  
  // 🔥 VAD 설정 변경 핸들러
  const handleVADSettingsChange = useCallback((newSettings) => {
    setVadSettings(prev => ({ ...prev, ...newSettings }));
    vadRecorder.updateVADConfig(newSettings.vadConfig);
    console.log('⚙️ VAD 설정 업데이트:', newSettings);
  }, [vadRecorder]);
  
  // 🔥 TTS 감정 설정 변경 핸들러
  const handleTTSEmotionChange = useCallback((emotionSettings) => {
    const store = useChatStore.getState();
    
    // 스토어의 설정 업데이트
    const newSettings = {
      ...store.settings,
      ...emotionSettings
    };
    
    // 설정 적용 (chatStore의 updateSettings 함수가 있다고 가정)
    if (store.updateSettings) {
      store.updateSettings(newSettings);
    }
    
    console.log('🎭 TTS 감정 설정 변경:', emotionSettings);
    
    // 연결된 상태라면 서버에도 설정 전송
    if (isConnected && conversationFlow.isConnected()) {
      conversationFlow.updateSettings({
        tts_settings: {
          ...store.settings,
          ...emotionSettings
        }
      });
    }
  }, [isConnected, conversationFlow]);
  
  // 기존 핸들러들은 그대로 유지...
  const handleSTTResult = useCallback((transcript) => {
    console.log('STT 결과:', transcript);
    
    updateProgress({
      stage: 'idle',
      progress: 100,
      message: 'STT 완료',
      isVisible: false
    });
    
    const store = useChatStore.getState();
    store.setCurrentTranscript(transcript);
    
    if (transcript.trim()) {
      store.addUserMessage(transcript);
      setCurrentState('processing');
      setIsProcessing(true);
      
      updateProgress({
        stage: 'gpt',
        progress: 10,
        message: 'AI가 응답을 생성하고 있습니다...',
        subMessage: '질문을 분석하고 있어요',
        isVisible: true,
        estimatedDuration: 4.0
      });
    } else {
      setCurrentState('connected');
    }
  }, [updateProgress]);
  
  const handleGPTResponse = useCallback((response) => {
    console.log('GPT 응답:', response);
    
    updateProgress({
      stage: 'idle',
      progress: 100,
      message: 'GPT 응답 완료',
      isVisible: false
    });
    
    const store = useChatStore.getState();
    store.addAssistantMessage(response);
    setIsProcessing(false);
  }, [updateProgress]);
  
  const handleTTSStart = useCallback((sampleRate, dtype) => {
    console.log('TTS 시작:', sampleRate, dtype);
    
    updateProgress({
      stage: 'tts',
      progress: 0,
      message: '음성을 생성하고 있습니다...',
      subMessage: '자연스러운 음성으로 변환 중',
      isVisible: true,
      estimatedDuration: 2.5
    });
    
    audioPlayer.startNewAudio();
    
    setCurrentState('speaking');
    const store = useChatStore.getState();
    store.setSpeaking(true);
    store.setPlaying(true);
    
    console.log('🎵 새 TTS 시작 - 이전 오디오 중단됨');
  }, [audioPlayer, updateProgress]);
  
  const handleTTSAudio = useCallback(async (audioBuffer, sampleRate = 24000) => {
    console.log('🎵 handleTTSAudio 호출됨:', {
      bufferSize: audioBuffer?.byteLength,
      sampleRate: sampleRate
    });
    
    try {
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        console.warn('⚠️ 빈 오디오 버퍼 수신');
        return;
      }
      
      const currentProgress = Math.min(progressState.progress + 10, 95);
      updateProgress({
        progress: currentProgress,
        message: '음성을 재생하고 있습니다...',
        subMessage: `오디오 청크 ${Math.floor(currentProgress / 10)} 처리 중`
      });
      
      await audioPlayer.playPCMChunk(audioBuffer, sampleRate);
      
      console.log('✅ 오디오 청크 재생 요청 완료');
      
    } catch (error) {
      console.error('❌ 오디오 재생 오류:', error);
      const store = useChatStore.getState();
      
      store.setSpeaking(false);
      store.setPlaying(false);
      setCurrentState('connected');
      
      updateProgress({
        stage: 'idle',
        isVisible: false
      });
      
      store.setError('음성 재생 중 오류가 발생했습니다.');
    }
  }, [audioPlayer, updateProgress, progressState.progress]);
  
  const handleTTSComplete = useCallback(() => {
    console.log('TTS 완료');
    
    updateProgress({
      stage: 'idle',
      progress: 100,
      message: 'TTS 완료',
      isVisible: false
    });
    
    // 🔥 TTS 완료 후 VAD 모드에서는 자동으로 다음 녹음 시작
    if (vadEnabled && continuousMode && isConnected) {
      console.log('🔄 VAD 연속 모드: 자동 녹음 시작');
      setTimeout(() => {
        startVADRecording();
      }, 1000);
    } else {
      setCurrentState('connected');
    }
    
    const store = useChatStore.getState();
    store.setSpeaking(false);
    store.setPlaying(false);
    
    if (!continuousMode) {
      store.addSystemMessage('음성 재생이 완료되었습니다.');
    }
  }, [vadEnabled, continuousMode, isConnected, updateProgress]);
  
  const handleError = useCallback((error) => {
    console.error('대화 오류:', error);
    const store = useChatStore.getState();
    store.setError(typeof error === 'string' ? error : '알 수 없는 오류가 발생했습니다.');
    setCurrentState('connected');
    setIsProcessing(false);
    store.setSpeaking(false);
    store.setPlaying(false);
    store.setRecording(false);
  }, []);
  
  const handleStateChange = useCallback((state, data) => {
    console.log('상태 변경:', state, data);
    const store = useChatStore.getState();
    
    switch (state) {
      case 'connected':
        store.setConnected(true);
        setCurrentState('connected');
        break;
      case 'disconnected':
        store.setConnected(false);
        setCurrentState('disconnected');
        break;
      case 'tts_stopped':
        store.setSpeaking(false);
        store.setPlaying(false);
        setCurrentState('connected');
        break;
      case 'audio_stop_previous':
        console.log('🔇 이전 오디오 중단 처리');
        audioPlayer.startNewAudio();
        break;
      case 'config_updated':
        store.addSystemMessage('설정이 업데이트되었습니다.');
        break;
    }
  }, [audioPlayer]);
  
  // 🔥 VAD PCM 데이터 핸들러
  const handleVADPCMData = useCallback((arrayBuffer) => {
    if (conversationFlow.isConnected()) {
      conversationFlow.sendVoiceData(arrayBuffer);
    }
  }, [conversationFlow]);
  
  // 연결 시작
  const startConnection = useCallback(async () => {
    try {
      const store = useChatStore.getState();
      store.clearError();
      
      await audioPlayer.resumeContext();
      
      await conversationFlow.connectConversation(
        handleSTTResult,
        handleGPTResponse,
        handleTTSStart,
        handleTTSAudio,
        handleTTSComplete,
        handleError,
        handleStateChange
      );
      
      const currentSettings = store.settings;
      conversationFlow.updateSettings({
        language: currentSettings.language,
        tts_settings: {
          model: currentSettings.model,
          emotion: currentSettings.emotion,
          fmax: currentSettings.fmax,
          pitch_std: currentSettings.pitch_std,
          speaking_rate: currentSettings.speaking_rate,
          cfg_scale: 1.8
        },
        performance_mode: "quality",
        system_prompt: `당신은 친근하고 도움이 되는 AI 어시스턴트입니다. 
한국어로 자연스럽고 따뜻하게 대화해주세요. 
답변은 간결하면서도 유익하게 해주시고, 필요시 질문을 통해 더 나은 도움을 제공하세요.
음성으로 대화하고 있으니 간결하고 자연스럽게 답변해주세요. 대화체로 이야기하듯이 친근하게 말해주세요.`
      });
      
      store.addSystemMessage('음성 대화가 시작되었습니다.');
      
    } catch (error) {
      console.error('연결 시작 오류:', error);
      const store = useChatStore.getState();
      store.setError('연결을 시작할 수 없습니다.');
    }
  }, [
    audioPlayer,
    conversationFlow,
    handleSTTResult,
    handleGPTResponse,
    handleTTSStart,
    handleTTSAudio,
    handleTTSComplete,
    handleError,
    handleStateChange
  ]);
  
  // 연결 종료
  const stopConnection = useCallback(() => {
    vadRecorder.stopRecording(); // 🔥 VAD 레코더 중단
    conversationFlow.close();
    audioPlayer.stop();
    
    const store = useChatStore.getState();
    store.setConnected(false);
    store.setRecording(false);
    store.setSpeaking(false);
    store.setPlaying(false);
    setIsProcessing(false);
    setCurrentState('disconnected');
    store.setCurrentTranscript('');
    
    store.addSystemMessage('음성 대화가 종료되었습니다.');
  }, [vadRecorder, conversationFlow, audioPlayer]);
  
  // 🔥 VAD 녹음 시작
  const startVADRecording = useCallback(async () => {
    const store = useChatStore.getState();
    
    if (!isConnected) {
      store.setError('먼저 연결을 시작해주세요.');
      return;
    }
    
    if (isProcessing || isSpeaking) {
      store.setError('현재 처리 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    try {
      store.setCurrentTranscript('');
      store.clearError();
      
      updateProgress({
        stage: 'stt',
        progress: 0,
        message: 'VAD 음성 감지 모드 시작...',
        subMessage: '말씀하시면 자동으로 감지됩니다',
        isVisible: true,
        estimatedDuration: 10.0
      });
      
      // 🔥 VAD 옵션으로 녹음 시작
      await vadRecorder.startRecording(handleVADPCMData, {
        vadConfig: vadSettings.vadConfig,
        onVoiceStart: handleVoiceStart,
        onVoiceEnd: handleVoiceEnd,
        onSilenceDetected: handleSilenceDetected
      });
      
      store.setRecording(true);
      setCurrentState('recording');
      
      if (continuousMode) {
        store.addSystemMessage('🔄 VAD 연속 모드: 음성을 자동으로 감지합니다...');
      } else {
        store.addSystemMessage('🎤 VAD 모드: 음성을 감지하면 자동으로 처리됩니다...');
      }
      
    } catch (error) {
      console.error('VAD 녹음 시작 오류:', error);
      store.setError('마이크 접근 권한이 필요합니다.');
      
      updateProgress({
        stage: 'idle',
        isVisible: false
      });
    }
  }, [
    isConnected,
    isProcessing,
    isSpeaking,
    vadRecorder,
    handleVADPCMData,
    vadSettings.vadConfig,
    handleVoiceStart,
    handleVoiceEnd,
    handleSilenceDetected,
    continuousMode,
    updateProgress
  ]);
  
  // VAD 녹음 종료
  const stopVADRecording = useCallback(() => {
    vadRecorder.stopRecording();
    conversationFlow.stopRecording();
    
    updateProgress({
      stage: 'idle',
      isVisible: false
    });
    
    const store = useChatStore.getState();
    store.setRecording(false);
    setCurrentState('connected');
    store.addSystemMessage('VAD 음성 감지가 중단되었습니다.');
  }, [vadRecorder, conversationFlow, updateProgress]);
  
  // 음성 재생 중단
  const stopSpeaking = useCallback(() => {
    console.log('🔇 음성 재생 중단 시작');
    
    updateProgress({
      stage: 'idle',
      isVisible: false
    });
    
    audioPlayer.stop();
    conversationFlow.stopSpeaking();
    
    const store = useChatStore.getState();
    store.setSpeaking(false);
    store.setPlaying(false);
    setCurrentState('connected');
    
    store.addSystemMessage('음성 재생이 중단되었습니다.');
  }, [conversationFlow, audioPlayer, updateProgress]);
  
  // 🔥 VAD 모드 토글
  const toggleVADMode = useCallback(() => {
    const newVADEnabled = !vadEnabled;
    setVadEnabled(newVADEnabled);
    
    const store = useChatStore.getState();
    if (newVADEnabled) {
      store.addSystemMessage('🎤 VAD 모드가 활성화되었습니다. 음성이 자동으로 감지됩니다.');
    } else {
      store.addSystemMessage('🎤 VAD 모드가 비활성화되었습니다. 수동으로 녹음을 제어합니다.');
      
      // VAD 녹음 중이면 중단
      if (vadRecorder.isRecording) {
        stopVADRecording();
      }
    }
  }, [vadEnabled, vadRecorder.isRecording, stopVADRecording]);
  
  // 연속 모드 토글
  const toggleContinuousMode = useCallback(() => {
    const newMode = !continuousMode;
    setContinuousMode(newMode);
    
    const store = useChatStore.getState();
    if (newMode) {
      store.addSystemMessage('🔄 연속 대화 모드가 활성화되었습니다. 대화가 자동으로 계속됩니다.');
    } else {
      store.addSystemMessage('🔄 연속 대화 모드가 비활성화되었습니다.');
    }
  }, [continuousMode]);
  
  // 상태별 UI 텍스트
  const getStatusText = () => {
    switch (currentState) {
      case 'disconnected': return '연결 안됨';
      case 'connected': return vadEnabled ? 'VAD 모드 준비됨' : '대화 준비됨';
      case 'recording': return vadEnabled ? 'VAD 음성 감지 중...' : '음성 인식 중...';
      case 'processing': return 'AI 응답 생성 중...';
      case 'speaking': return '음성 재생 중...';
      default: return '알 수 없는 상태';
    }
  };
  
  const getStatusIcon = () => {
    switch (currentState) {
      case 'disconnected': return '🔴';
      case 'connected': return vadEnabled ? '🎤' : '🟢';
      case 'recording': return vadEnabled ? '👂' : '🎤';
      case 'processing': return '🤔';
      case 'speaking': return '🔊';
      default: return '❓';
    }
  };
  
  return (
    <div className="voice-chat">
      {/* 🔥 통합 프로그레스바 */}
      <UnifiedProgressBar 
        stage={progressState.stage}
        progress={progressState.progress}
        message={progressState.message}
        subMessage={progressState.subMessage}
        isVisible={progressState.isVisible}
        processingTime={progressState.processingTime}
        estimatedDuration={progressState.estimatedDuration}
      />
      
      {/* 연결 컨트롤 */}
      <div className="connection-controls">
        {!isConnected ? (
          <button 
            onClick={startConnection}
            className="connect-button"
            disabled={currentState !== 'disconnected'}
          >
            🔌 대화 시작
          </button>
        ) : (
          <button 
            onClick={stopConnection}
            className="disconnect-button"
          >
            🔌 대화 종료
          </button>
        )}
      </div>
      
      {/* 🔥 설정 토글 버튼들 */}
      {isConnected && (
        <div className="settings-toggles">
          <button 
            onClick={() => setShowVADSettings(!showVADSettings)}
            className={`settings-toggle ${showVADSettings ? 'active' : ''}`}
          >
            🎙️ VAD 설정 {showVADSettings ? '▼' : '▶'}
          </button>
          
          <button 
            onClick={() => setShowTTSSettings(!showTTSSettings)}
            className={`settings-toggle ${showTTSSettings ? 'active' : ''}`}
          >
            🎭 TTS 감정 설정 {showTTSSettings ? '▼' : '▶'}
          </button>
        </div>
      )}
      
      {/* 🔥 VAD 설정 패널 */}
      {showVADSettings && (
        <VADControl
          onSettingsChange={handleVADSettingsChange}
          isVisible={true}
          currentSettings={vadSettings}
          isRecording={vadRecorder.isRecording}
          voiceLevel={vadRecorder.voiceLevel}
          isVoiceDetected={vadRecorder.isVoiceDetected}
        />
      )}
      
      {/* 🔥 TTS 감정 설정 패널 */}
      {showTTSSettings && (
        <TTSEmotionControl
          onEmotionChange={handleTTSEmotionChange}
          currentSettings={settings}
          isVisible={true}
        />
      )}
      
      {/* 음성 컨트롤 */}
      <div className="voice-controls">
        {isConnected && (
          <>
            {/* 🔥 VAD 모드 토글 */}
            <div className="mode-toggles">
              <div className="mode-toggle">
                <label className="toggle-label">
                  <input 
                    type="checkbox" 
                    checked={vadEnabled} 
                    onChange={toggleVADMode}
                    disabled={isProcessing || isSpeaking}
                  />
                  <span className="toggle-slider vad"></span>
                  <span className="toggle-text">
                    {vadEnabled ? '🎤 VAD 자동 모드' : '👆 수동 입력 모드'}
                  </span>
                </label>
              </div>
              
              <div className="mode-toggle">
                <label className="toggle-label">
                  <input 
                    type="checkbox" 
                    checked={continuousMode} 
                    onChange={toggleContinuousMode}
                    disabled={isProcessing || isSpeaking}
                  />
                  <span className="toggle-slider continuous"></span>
                  <span className="toggle-text">
                    {continuousMode ? '🔄 연속 대화 모드' : '1️⃣ 단일 대화 모드'}
                  </span>
                </label>
              </div>
            </div>
            
            {/* 🔥 VAD 실시간 레벨 표시 */}
            {vadEnabled && vadRecorder.isRecording && (
              <div className="vad-live-display">
                <div className="vad-status">
                  <span className={`vad-indicator ${vadRecorder.isVoiceDetected ? 'voice' : 'silence'}`}>
                    {vadRecorder.isVoiceDetected ? '🎤 음성 감지됨' : '⚪ 대기 중'}
                  </span>
                  <span className="vad-level">레벨: {(vadRecorder.voiceLevel * 100).toFixed(1)}%</span>
                </div>
                
                <div className="vad-level-bar">
                  <div 
                    className="vad-level-fill"
                    style={{
                      width: `${Math.min(100, vadRecorder.voiceLevel * 100)}%`,
                      backgroundColor: vadRecorder.isVoiceDetected ? '#4CAF50' : '#FF9800'
                    }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* 녹음 컨트롤 버튼들 */}
            {currentState === 'connected' && (
              <>
                {vadEnabled ? (
                  <button 
                    onClick={startVADRecording}
                    className="record-button vad"
                    disabled={isProcessing || isSpeaking}
                  >
                    🎤 VAD 감지 시작
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      // 기존 수동 녹음 로직 - 구현 필요 시 추가
                      console.log('수동 녹음 시작');
                    }}
                    className="record-button manual"
                    disabled={isProcessing || isSpeaking}
                  >
                    🎤 수동 녹음 시작
                  </button>
                )}
              </>
            )}
            
            {currentState === 'recording' && (
              <button 
                onClick={vadEnabled ? stopVADRecording : () => {}}
                className={`stop-button ${vadEnabled ? 'vad' : 'manual'}`}
              >
                ⏹️ {vadEnabled ? 'VAD 감지 중단' : '녹음 중단'}
              </button>
            )}
            
            {currentState === 'speaking' && (
              <button 
                onClick={stopSpeaking}
                className="stop-speaking-button"
              >
                🔇 음성 중단
              </button>
            )}
            
            {currentState === 'processing' && (
              <div className="processing-indicator">
                <div className="loading"></div>
                <span>AI가 응답을 생성하고 있습니다...</span>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* 상태 표시 */}
      <div className="status-display">
        <div className="current-status">
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        
        {currentTranscript && (
          <div className="current-transcript">
            💬 인식된 음성: "{currentTranscript}"
          </div>
        )}
        
        {/* 🔥 VAD 및 연속 모드 상태 표시 */}
        {vadEnabled && (
          <div className="vad-mode-status">
            <div className="status-indicator-large">
              <span className="status-icon">🎤</span>
              <span className="status-text">VAD 자동 감지 모드</span>
              <span className="sensitivity-info">
                민감도: {vadSettings.vadConfig.sensitivity}
              </span>
            </div>
          </div>
        )}
        
        {continuousMode && (
          <div className="continuous-mode-status">
            <div className="status-indicator-large">
              <span className="status-icon">🔄</span>
              <span className="status-text">연속 대화 모드 활성</span>
            </div>
            <div className="cycle-info">
              <span className="cycle-step current-step">
                {currentState === 'recording' && '🎤 듣는 중'}
                {currentState === 'processing' && '🤔 생각 중'}
                {currentState === 'speaking' && '🗣️ 말하는 중'}
                {currentState === 'connected' && '⏳ 대기 중'}
              </span>
              <span className="cycle-arrow">→</span>
              <span className="cycle-step next-step">
                {currentState === 'recording' && '🤔 생각 중'}
                {currentState === 'processing' && '🗣️ 말하는 중'}
                {currentState === 'speaking' && '🎤 듣는 중'}
                {currentState === 'connected' && '🎤 듣는 중'}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* 오류 표시 */}
      {error && (
        <div className="error-message">
          ❌ 오류: {error}
          <button onClick={clearError}>✕</button>
        </div>
      )}
      
      {vadRecorder.error && (
        <div className="error-message">
          ❌ VAD 마이크 오류: {vadRecorder.error}
        </div>
      )}
    </div>
  );
};

export default VoiceVADChat;