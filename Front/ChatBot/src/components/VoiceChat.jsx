import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useConversationFlow } from '../hooks/useConversation';
import { useAudioPlayer, usePCMRecorder } from '../hooks/useAudio';
import UnifiedProgressBar from './UnifiedProgressBar'; // 🔥 통합 프로그레스바 추가
import useChatStore from '../store/chatStore';

import '../styles/VoiceChat.css';

const VoiceChat = () => {
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
  const [currentState, setCurrentState] = useState('disconnected'); // disconnected, connected, recording, processing, speaking
  const [continuousMode, setContinuousMode] = useState(false); // 🔥 연속 대화 모드 추가
  
  // 🔥 프로그레스바 상태 관리
  const [progressState, setProgressState] = useState({
    stage: 'idle', // idle, stt, gpt, tts
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
      
      // 시작 시간 자동 설정
      if (updates.stage && updates.stage !== 'idle' && !prev.startTime) {
        newState.startTime = Date.now();
        newState.processingTime = 0;
      }
      
      // 종료 시 시간 계산
      if (updates.stage === 'idle' && prev.startTime) {
        newState.processingTime = (Date.now() - prev.startTime) / 1000;
        newState.startTime = null;
      }
      
      return newState;
    });
  }, []);
  
  // 🔥 실시간 시간 업데이트 및 가짜 프로그레스 처리
  useEffect(() => {
    let interval;
    
    if (progressState.startTime && progressState.stage !== 'idle') {
      interval = setInterval(() => {
        const elapsed = (Date.now() - progressState.startTime) / 1000;
        
        setProgressState(prev => {
          let newProgress = prev.progress;
          
          // 🔥 단계별 가짜 프로그레스 로직
          if (prev.stage === 'stt') {
            // STT는 녹음 시간에 비례하여 증가
            const recordingProgress = Math.min((elapsed / prev.estimatedDuration) * 100, 90);
            newProgress = Math.max(recordingProgress, prev.progress);
          } else if (prev.stage === 'gpt') {
            // GPT는 예상 시간에 따라 점진적 증가
            const gptProgress = Math.min((elapsed / prev.estimatedDuration) * 85, 85);
            newProgress = Math.max(gptProgress, prev.progress);
          } else if (prev.stage === 'tts') {
            // TTS는 청크 및 시간 기반 증가
            if (prev.progress < 90) {
              const ttsProgress = Math.min((elapsed / prev.estimatedDuration) * 90, 90);
              newProgress = Math.max(ttsProgress, prev.progress);
            }
          }
          
          return {
            ...prev,
            processingTime: elapsed,
            progress: newProgress
          };
        });
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [progressState.startTime, progressState.stage]);
  
  // 훅들
  const conversationFlow = useConversationFlow();
  const audioPlayer = useAudioPlayer();
  const pcmRecorder = usePCMRecorder();
  
  // 오디오 데이터 핸들러들
  const handleSTTResult = useCallback((transcript) => {
    console.log('STT 결과:', transcript);
    
    // 🔥 STT 완료 후 프로그레스바 업데이트
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
      
      // 🔥 GPT 단계 시작
      updateProgress({
        stage: 'gpt',
        progress: 10, // 시작시 10%로 설정
        message: 'AI가 응답을 생성하고 있습니다...',
        subMessage: '질문을 분석하고 있어요',
        isVisible: true,
        estimatedDuration: 4.0 // GPT 예상 시간 조금 늘림
      });
    } else {
      setCurrentState('connected');
    }
  }, [updateProgress]);
  
  const handleGPTResponse = useCallback((response) => {
    console.log('GPT 응답:', response);
    
    // 🔥 GPT 완료 후 프로그레스바 업데이트
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
    
    // 🔥 TTS 시작 후 프로그레스바 업데이트
    updateProgress({
      stage: 'tts',
      progress: 0,
      message: '음성을 생성하고 있습니다...',
      subMessage: '자연스러운 음성으로 변환 중',
      isVisible: true,
      estimatedDuration: 2.5
    });
    
    // 🔥 새 TTS 시작 시 이전 오디오 중단
    audioPlayer.startNewAudio();
    
    setCurrentState('speaking');
    const store = useChatStore.getState();
    store.setSpeaking(true);
    store.setPlaying(true);
    
    console.log('🎵 새 TTS 시작 - 이전 오디오 중단됨');
  }, [audioPlayer, updateProgress]); // audioPlayer 의존성 추가
  
  const handleTTSAudio = useCallback(async (audioBuffer, sampleRate = 24000) => {
    console.log('🎵 handleTTSAudio 호출됨:', {
      bufferSize: audioBuffer?.byteLength,
      bufferType: typeof audioBuffer,
      isArrayBuffer: audioBuffer instanceof ArrayBuffer,
      sampleRate: sampleRate,
      audioPlayerReady: !!audioPlayer,
      audioContextState: audioPlayer.audioContextState
    });
    
    try {
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        console.warn('⚠️ 빈 오디오 버퍼 수신');
        return;
      }
      
      // 🔥 TTS 진행률 업데이트 (대략적 추정)
      const currentProgress = Math.min(progressState.progress + 10, 95);
      updateProgress({
        progress: currentProgress,
        message: '음성을 재생하고 있습니다...',
        subMessage: `오디오 청크 ${Math.floor(currentProgress / 10)} 처리 중`
      });
      
      // 🔥 오디오 데이터 미리보기
      const previewBytes = new Uint8Array(audioBuffer.slice(0, 20));
      console.log('🔍 TTS 오디오 데이터 미리보기:', {
        first20Bytes: Array.from(previewBytes).map(b => b.toString(16).padStart(2, '0')).join(' '),
        bufferByteLength: audioBuffer.byteLength,
        expectedSamples: audioBuffer.byteLength / 2,
        expectedDuration: (audioBuffer.byteLength / 2) / sampleRate
      });
      
      // 🔥 서버에서 전달된 샘플레이트를 사용하여 비동기 재생
      console.log('🎧 audioPlayer.playPCMChunk 호출 시작...');
      await audioPlayer.playPCMChunk(audioBuffer, sampleRate);
      
      console.log('✅ 오디오 청크 재생 요청 완료 (sampleRate:', sampleRate, ')');
      
    } catch (error) {
      console.error('❌ 오디오 재생 오류:', error);
      console.error('오류 스택:', error.stack);
      const store = useChatStore.getState();
      
      // 🔥 오디오 오류 시 상태 정리
      store.setSpeaking(false);
      store.setPlaying(false);
      setCurrentState('connected');
      
      // 🔥 오류 시 프로그레스바 숨기기
      updateProgress({
        stage: 'idle',
        isVisible: false
      });
      
      store.setError('음성 재생 중 오류가 발생했습니다.');
    }
  }, [audioPlayer, updateProgress, progressState.progress]);
  
  const handleTTSComplete = useCallback(() => {
    console.log('TTS 완료');
    
    // 🔥 TTS 완료 후 프로그레스바 업데이트
    updateProgress({
      stage: 'idle',
      progress: 100,
      message: 'TTS 완료',
      isVisible: false
    });
    
    // 🔥 연속 모드일 때 자동으로 다음 녹음 시작
    if (continuousMode && isConnected) {
      console.log('🔄 연속 모드: 자동 녹음 시작');
      setTimeout(() => {
        startRecording();
      }, 1000); // 1초 후 자동 녹음 시작
    } else {
      setCurrentState('connected');
    }
    
    const store = useChatStore.getState();
    store.setSpeaking(false);
    store.setPlaying(false);
    
    if (!continuousMode) {
      store.addSystemMessage('음성 재생이 완료되었습니다.');
    }
  }, [continuousMode, isConnected, startRecording, updateProgress]); // 🔥 startRecording 의존성 추가
  
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
      // 🔥 새로운 이벤트 추가 - 이전 오디오 중단
      case 'audio_stop_previous':
        console.log('🔇 이전 오디오 중단 처리');
        audioPlayer.startNewAudio(); // 이전 오디오 즈시 중단
        break;
      case 'config_updated':
        store.addSystemMessage('설정이 업데이트되었습니다.');
        break;
    }
  }, [audioPlayer]); // audioPlayer 의존성 추가
  
  // PCM 데이터 핸들러
  const handlePCMData = useCallback((arrayBuffer) => {
    if (conversationFlow.isConnected()) {
      conversationFlow.sendVoiceData(arrayBuffer);
    }
  }, [conversationFlow]);
  
  // 연결 시작
  const startConnection = useCallback(async () => {
    try {
      const store = useChatStore.getState();
      store.clearError();
      
      // 오디오 컨텍스트 재개
      await audioPlayer.resumeContext();
      
      // 대화형 WebSocket 연결
      await conversationFlow.connectConversation(
        handleSTTResult,
        handleGPTResponse,
        handleTTSStart,
        handleTTSAudio,
        handleTTSComplete,
        handleError,
        handleStateChange
      );
      
      // 초기 설정 전송 - 개선된 기본값 사용
      const currentSettings = store.settings;
      conversationFlow.updateSettings({
        language: currentSettings.language,
        tts_settings: {
          model: currentSettings.model,
          emotion: currentSettings.emotion,
          fmax: currentSettings.fmax,
          pitch_std: currentSettings.pitch_std,
          speaking_rate: currentSettings.speaking_rate,
          cfg_scale: 1.8 // 🔥 CFG 스케일 낮춤 (음질 vs 속도)
        },
        performance_mode: "quality", // 🔥 품질 모드로 설정
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
    pcmRecorder.stopRecording();
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
  }, [
    pcmRecorder,
    conversationFlow,
    audioPlayer
  ]);
  
  // 녹음 시작
  const startRecording = useCallback(async () => {
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
      
      // 🔥 STT 시작 프로그레스바 표시
      updateProgress({
        stage: 'stt',
        progress: 0,
        message: '음성을 인식하고 있습니다...',
        subMessage: '마이크로 음성을 수집 중',
        isVisible: true,
        estimatedDuration: 5.0
      });
      
      await pcmRecorder.startRecording(handlePCMData);
      store.setRecording(true);
      setCurrentState('recording');
      
      if (continuousMode) {
        store.addSystemMessage('🔄 연속 모드: 음성 인식 시작...');
      } else {
        store.addSystemMessage('음성 인식을 시작합니다...');
      }
      
    } catch (error) {
      console.error('녹음 시작 오류:', error);
      store.setError('마이크 접근 권한이 필요합니다.');
      
      // 🔥 오류 시 프로그레스바 숨기기
      updateProgress({
        stage: 'idle',
        isVisible: false
      });
    }
  }, [
    isConnected,
    isProcessing,
    isSpeaking,
    pcmRecorder,
    handlePCMData,
    continuousMode,
    updateProgress // 🔥 updateProgress 의존성 추가
  ]);
  
  // 녹음 종료
  const stopRecording = useCallback(() => {
    pcmRecorder.stopRecording();
    conversationFlow.stopRecording();
    
    // 🔥 STT 처리 중 프로그레스바 업데이트
    updateProgress({
      progress: 50,
      message: '음성을 분석하고 있습니다...',
      subMessage: 'Whisper AI가 음성을 텍스트로 변환 중'
    });
    
    const store = useChatStore.getState();
    store.setRecording(false);
    setCurrentState('processing');
    store.addSystemMessage('음성 인식을 처리하고 있습니다...');
  }, [pcmRecorder, conversationFlow, updateProgress]);
  
  // 음성 재생 중단
  const stopSpeaking = useCallback(() => {
    console.log('🔇 음성 재생 중단 시작');
    
    // 🔥 TTS 중단 시 프로그레스바 숨기기
    updateProgress({
      stage: 'idle',
      isVisible: false
    });
    
    // 🔥 로컬에서 먼저 오디오 중단
    audioPlayer.stop();
    
    // 🔥 서버에 중단 신호 전송
    conversationFlow.stopSpeaking();
    
    const store = useChatStore.getState();
    store.setSpeaking(false);
    store.setPlaying(false);
    setCurrentState('connected');
    
    store.addSystemMessage('음성 재생이 중단되었습니다.');
  }, [conversationFlow, audioPlayer, updateProgress]);
  
  // 🔥 연속 모드 토글
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
  
  // 🔥 연속 모드 중단
  const stopContinuousMode = useCallback(() => {
    setContinuousMode(false);
    
    // 현재 녹음 중이면 중단
    if (isRecording) {
      stopRecording();
    }
    
    // 현재 재생 중이면 중단
    if (isSpeaking) {
      stopSpeaking();
    }
    
    const store = useChatStore.getState();
    store.addSystemMessage('🛑 연속 대화 모드가 중단되었습니다.');
  }, [isRecording, isSpeaking, stopRecording, stopSpeaking]);
  
  // 설정 변경 시 서버에 업데이트 (안정적인 데이터만 의존성으로)
  useEffect(() => {
    if (isConnected && conversationFlow.isConnected()) {
      const updateData = {
        language: settings.language,
        tts_settings: {
          model: settings.model,
          emotion: settings.emotion,
          fmax: settings.fmax,
          pitch_std: settings.pitch_std,
          speaking_rate: settings.speaking_rate,
          cfg_scale: 2.0
        }
      };
      conversationFlow.updateSettings(updateData);
    }
  }, [isConnected, settings.language, settings.model, settings.emotion, settings.fmax, settings.pitch_std, settings.speaking_rate]); // 구체적인 설정값들만 의존성으로
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 의존성 없이 정리 함수 직접 호출
      pcmRecorder.stopRecording();
      conversationFlow.close();
      audioPlayer.stop();
    };
  }, []); // 빈 의존성 배열로 수정
  
  // 상태별 UI 텍스트
  const getStatusText = () => {
    switch (currentState) {
      case 'disconnected': return '연결 안됨';
      case 'connected': return '대화 준비됨';
      case 'recording': return '음성 인식 중...';
      case 'processing': return 'AI 응답 생성 중...';
      case 'speaking': return '음성 재생 중...';
      default: return '알 수 없는 상태';
    }
  };
  
  const getStatusIcon = () => {
    switch (currentState) {
      case 'disconnected': return '🔴';
      case 'connected': return '🟢';
      case 'recording': return '🎤';
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
      
      <div className="voice-controls">
        {isConnected && (
          <>
            {/* 🔥 연속 모드 컨트롤 */}
            <div className="continuous-mode-controls">
              <div className="mode-toggle">
                <label className="toggle-label">
                  <input 
                    type="checkbox" 
                    checked={continuousMode} 
                    onChange={toggleContinuousMode}
                    disabled={isProcessing || isSpeaking}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">
                    {continuousMode ? '🔄 연속 대화 모드' : '👆 수동 모드'}
                  </span>
                </label>
              </div>
              
              {continuousMode && (
                <div className="continuous-mode-info">
                  <span className="info-text">
                    💡 AI 응답 후 자동으로 다음 대화가 시작됩니다
                  </span>
                  <button 
                    onClick={stopContinuousMode}
                    className="stop-continuous-button"
                    disabled={!continuousMode}
                  >
                    🛑 연속 모드 중단
                  </button>
                </div>
              )}
            </div>
            
            {/* 기존 컨트롤들 */}
            {!continuousMode && currentState === 'connected' && (
              <button 
                onClick={startRecording}
                className="record-button"
                disabled={isProcessing || isSpeaking}
              >
                🎤 말하기 시작
              </button>
            )}
            
            {continuousMode && currentState === 'connected' && (
              <button 
                onClick={startRecording}
                className="record-button continuous"
                disabled={isProcessing || isSpeaking}
              >
                🔄 연속 대화 시작
              </button>
            )}
            
            {currentState === 'recording' && (
              <button 
                onClick={stopRecording}
                className="stop-button"
              >
                ⏹️ 말하기 종료
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
        
        {currentState === 'processing' && (
          <div className="processing-message">
            🤖 AI가 응답을 생성하고 음성으로 변환하고 있습니다...
          </div>
        )}
        
        {/* 🔥 연속 모드 상태 표시 */}
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
      
      {error && (
        <div className="error-message">
          ❌ 오류: {error}
          <button onClick={clearError}>✕</button>
        </div>
      )}
      
      {pcmRecorder.error && (
        <div className="error-message">
          ❌ 마이크 오류: {pcmRecorder.error}
        </div>
      )}
      
      {/* 🔥 디버깅 정보 표시 */}
      {audioPlayer.debugInfo && (
        <div className="debug-info" style={{
          backgroundColor: '#f0f0f0',
          padding: '10px',
          margin: '10px 0',
          borderRadius: '5px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <strong>🐛 디버그 정보:</strong><br />
          {audioPlayer.debugInfo}<br />
          <strong>🎵 AudioContext:</strong> {audioPlayer.audioContextState}<br />
          <strong>🔊 재생 상태:</strong> {audioPlayer.isPlaying ? '재생 중' : '대기 중'}<br />
          <strong>🔊 볼륨:</strong> {audioPlayer.volume}<br />
          
          {/* 🔥 볼륨 제어 추가 */}
          <div style={{ marginTop: '10px' }}>
            <label>🔊 볼륨 제어: </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={audioPlayer.volume} 
              onChange={(e) => audioPlayer.setVolume(parseFloat(e.target.value))}
              style={{ marginLeft: '10px', width: '100px' }}
            />
            <span style={{ marginLeft: '10px' }}>{Math.round(audioPlayer.volume * 100)}%</span>
          </div>
          
          {/* 🔥 오디오 테스트 버튼 추가 */}
          <button 
            onClick={audioPlayer.testAudioPlayback}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🎧 오디오 테스트 (비프음)
          </button>
          
          {/* 🔥 AudioContext 재개 버튼 */}
          <button 
            onClick={audioPlayer.resumeContext}
            style={{
              marginTop: '5px',
              marginLeft: '10px',
              padding: '5px 10px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔊 AudioContext 재개
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
