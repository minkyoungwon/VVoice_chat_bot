import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useConversationFlow } from '../hooks/useConversation';
import { useAudioPlayer } from '../hooks/useAudio';
import { useVADRecorder } from '../hooks/useVAD';
import useChatStore from '../store/chatStore';
import FullScreenAvatar from './FullScreenAvatar';
import TTSEmotionControl from './TTSEmotionControl';
import VoiceTTSControl from './VoiceTTSControl';
import VADControl from './VADControl';
import LoadingProgressBar from './LoadingProgressBar';
import '../styles/SimpleVoiceChat.css';

// React SVG 이미지 import
import reactSvg from '../assets/react.svg';

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
  const [conversationActive, setConversationActive] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('disconnected');
  const [processingStep, setProcessingStep] = useState('');
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isVADEnabled, setIsVADEnabled] = useState(true);
  const [showTTSControls, setShowTTSControls] = useState(false);
  const [showVADControls, setShowVADControls] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  
  // 🔥 LoadingProgressBar 상태 개선 - 더 명확한 상태 관리
  const [loadingState, setLoadingState] = useState({
    isVisible: false,
    progress: 0,
    status: '',
    title: '로딩 중...',
    modelName: '',
    isComplete: false, // 완료 여부 추가
    autoHideTimer: null // 타이머 참조 추가
  });
  
  const [currentSettings, setCurrentSettings] = useState({
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
  
  // 🔥 타이머 정리 함수
  const clearAutoHideTimer = useCallback(() => {
    if (loadingState.autoHideTimer) {
      clearTimeout(loadingState.autoHideTimer);
      setLoadingState(prev => ({ ...prev, autoHideTimer: null }));
    }
  }, [loadingState.autoHideTimer]);
  
  // 🔥 로딩 상태 초기화 함수
  const resetLoadingState = useCallback(() => {
    clearAutoHideTimer();
    setLoadingState({
      isVisible: false,
      progress: 0,
      status: '',
      title: '로딩 중...',
      modelName: '',
      isComplete: false,
      autoHideTimer: null
    });
  }, [clearAutoHideTimer]);
  
  // 🔥 로딩 완료 처리 함수
  const completeLoading = useCallback((delay = 2000) => {
    setLoadingState(prev => ({
      ...prev,
      isComplete: true,
      progress: 100
    }));
    
    const timer = setTimeout(() => {
      resetLoadingState();
    }, delay);
    
    setLoadingState(prev => ({ ...prev, autoHideTimer: timer }));
  }, [resetLoadingState]);
  
  // 🔥 백엔드 로딩 메시지 처리 함수 개선
  const handleBackendLoadingMessage = useCallback((data) => {
    console.log('🔄 백엔드 로딩 메시지:', data);
    
    // 이미 완료된 상태면 새로운 로딩 메시지 무시 (단, 새로운 작업 시작은 제외)
    if (loadingState.isComplete && !['model_loading_progress', 'generation_started'].includes(data.type)) {
      return;
    }
    
    switch (data.type) {
      case 'model_loading_progress':
        clearAutoHideTimer(); // 기존 타이머 제거
        setLoadingState(prev => ({
          ...prev,
          isVisible: true,
          progress: data.progress || 0,
          status: data.status || '로딩 중...',
          title: '모델 로드 중',
          modelName: data.model || '',
          isComplete: false
        }));
        break;
        
      case 'model_loading_complete':
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          status: '로딩 완료!',
          title: '모델 준비 완료'
        }));
        completeLoading(3000); // 3초 후 숨기기
        break;
        
      case 'model_loading_error':
        setLoadingState(prev => ({
          ...prev,
          progress: 0,
          status: `오류: ${data.error}`,
          title: '로딩 실패',
          isComplete: true
        }));
        completeLoading(5000); // 5초 후 숨기기 (에러는 더 오래 표시)
        break;
        
      case 'model_warmup_start':
        clearAutoHideTimer();
        setLoadingState(prev => ({
          ...prev,
          isVisible: true,
          progress: 80,
          status: '모델 웜업 중...',
          title: '성능 최적화',
          modelName: data.model || '',
          isComplete: false
        }));
        break;
        
      case 'model_warmup_complete':
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          status: '웜업 완료!'
        }));
        completeLoading(2000); // 2초 후 숨기기
        break;
        
      case 'cache_hit':
        // 캐시 히트는 짧게 표시
        setLoadingState({
          isVisible: true,
          progress: 100,
          status: '캐시된 오디오 사용 중',
          title: '🚀 초고속 처리',
          modelName: '',
          isComplete: false,
          autoHideTimer: null
        });
        completeLoading(1000); // 1초 후 숨기기
        break;
        
      case 'generation_started':
        clearAutoHideTimer();
        setLoadingState(prev => ({
          ...prev,
          isVisible: true,
          progress: 10,
          status: 'AI 음성 생성 시작...',
          title: '음성 합성 중',
          modelName: data.model || '',
          isComplete: false
        }));
        break;
        
      case 'generation_metadata':
        const rtf = data.rtf || 0;
        const performance = rtf < 0.5 ? '🚀 초고속' : rtf < 1.0 ? '⚡ 빠름' : '⚠️ 보통';
        
        setLoadingState(prev => ({
          ...prev,
          progress: 90,
          status: `음성 생성 완료 (${performance})`,
          title: '음성 재생 준비'
        }));
        break;
        
      case 'generation_complete':
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          status: '음성 생성 완료!'
        }));
        completeLoading(1500); // 1.5초 후 숨기기
        break;
        
      case 'connection_established':
        const serverInfo = data.server_info || {};
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          status: '서버 연결 완료!',
          title: '🎉 준비 완료',
          modelName: serverInfo.device || ''
        }));
        completeLoading(2500); // 2.5초 후 숨기기
        break;
        
      default:
        // 기타 백엔드 처리 상태
        if (data.status && (data.status.includes('로딩') || data.status.includes('처리'))) {
          setLoadingState(prev => ({
            ...prev,
            isVisible: true,
            status: data.status,
            isComplete: false
          }));
        }
        break;
    }
  }, [loadingState.isComplete, clearAutoHideTimer, completeLoading]);
  
  // 🔥 프로그래스바 수동 닫기 핸들러
  const handleCloseProgressBar = useCallback(() => {
    resetLoadingState();
  }, [resetLoadingState]);
  
  // 🔥 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      clearAutoHideTimer();
    };
  }, [clearAutoHideTimer]);
  
  // 🔥 설정 변경 핸들러
  const handleTTSSettingsChange = useCallback((newSettings) => {
    console.log('🎭 TTS 설정 변경:', newSettings);
    
    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };
    
    setCurrentSettings(updatedSettings);
    
    if (isConnected) {
      // 🎤 목소리 설정을 tts_settings에 포함하여 전송
      conversationFlow.updateSettings({
        language: "ko",
        tts_settings: {
          ...currentSettings.tts_settings,
          ...newSettings,
          // 🔥 목소리 관련 데이터 명시적 전송
          voice_id: newSettings.voice_id,
          voice_audio_base64: newSettings.voice_audio_base64,
          voice_file_path: newSettings.voice_file_path
        },
        performance_mode: "fast",
        system_prompt: "친근하고 도움이 되는 AI 어시스턴트로서 간단하고 명확하게 대답해주세요. 한두 문장으로 답변해주세요."
      });
      
      console.log('🔥 WebSocket으로 전송된 목소리 설정:', {
        voice_id: newSettings.voice_id,
        voice_audio_base64: newSettings.voice_audio_base64 ? '미미비참입력됨' : 'null',
        voice_file_path: newSettings.voice_file_path
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
      setTimeout(() => {
        setCurrentStatus('listening');
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      }, 1500);
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
    
    // 로딩 프로그래스바도 숨기기
    resetLoadingState();
  }, [setError, setSpeaking, setRecording, resetLoadingState]);
  
  // 🔥 상태 변경 처리 - 백엔드 로딩 메시지 포함
  const handleStateChange = useCallback((state, data) => {
    console.log('📊 상태 변경:', state, data);
    
    // 🔥 백엔드 로딩 관련 메시지 처리
    if (data && typeof data === 'object' && data.type) {
      handleBackendLoadingMessage(data);
    }
    
    switch (state) {
      case 'connected':
        setConnected(true);
        setCurrentStatus('ready');
        break;
      case 'disconnected':
        setConnected(false);
        setCurrentStatus('disconnected');
        setConversationActive(false);
        resetLoadingState(); // 로딩바 숨기기
        break;
      case 'audio_stop_previous':
        audioPlayer.startNewAudio();
        break;
    }
  }, [setConnected, audioPlayer, handleBackendLoadingMessage, resetLoadingState]);
  
  // 🔥 VAD 이벤트 핸들러들
  const handleVoiceStart = useCallback(() => {
    console.log('🎤 VAD: 음성 시작 감지');
    
    if (isSpeaking) {
      console.log('🔇 TTS 중에 음성 감지 - TTS 중단');
      audioPlayer.stop();
      conversationFlow.stopSpeaking();
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

  const handlePCMData = useCallback((arrayBuffer) => {
    if (conversationFlow.isConnected()) {
      conversationFlow.sendVoiceData(arrayBuffer);
    }
  }, [conversationFlow]);
  
  // 🔥 연결 시작
  const startConnection = useCallback(async () => {
    try {
      clearError();
      
      // 🔥 연결 시작 시 로딩 표시
      setLoadingState({
        isVisible: true,
        progress: 10,
        status: '서버 연결 중...',
        title: '연결 시작',
        modelName: '',
        isComplete: false,
        autoHideTimer: null
      });
      
      await audioPlayer.resumeContext();
      
      setLoadingState(prev => ({ ...prev, progress: 30, status: '오디오 시스템 초기화 완료' }));
      
      await conversationFlow.connectConversation(
        handleSTTResult,
        handleGPTResponse,
        handleTTSStart,
        handleTTSAudio,
        handleTTSComplete,
        handleError,
        handleStateChange
      );
      
      setLoadingState(prev => ({ ...prev, progress: 60, status: 'WebSocket 연결 완료' }));
      
      conversationFlow.updateSettings({
        language: "ko",
        ...currentSettings,
        performance_mode: "fast",
        system_prompt: "친근하고 도움이 되는 AI 어시스턴트로서 간단하고 명확하게 대답해주세요. 한두 문장으로 답변해주세요."
      });
      
      setLoadingState(prev => ({ ...prev, progress: 90, status: '설정 적용 완료' }));
      
      addSystemMessage('💬 대화 준비 완료! 아래 버튼을 눌러 대화를 시작하세요.');
      
      // 백엔드에서 connection_established 메시지가 올 때까지 대기
      
    } catch (error) {
      console.error('❌ 연결 실패:', error);
      setError('연결에 실패했습니다. 다시 시도해주세요.');
      resetLoadingState();
    }
  }, [audioPlayer, conversationFlow, handleSTTResult, handleGPTResponse, handleTTSStart, handleTTSAudio, handleTTSComplete, handleError, handleStateChange, clearError, addSystemMessage, currentSettings, resetLoadingState]);
  
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
        await vadRecorder.startRecording(handlePCMData, {
          onVoiceStart: handleVoiceStart,
          onVoiceEnd: handleVoiceEnd,
          onSilenceDetected: handleSilenceDetected,
          vadConfig: currentSettings.vadConfig
        });
      } else {
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
    
    setShowAvatar(true);
    
    setConversationActive(true);
    addSystemMessage(isVADEnabled ? '🤖 VAD 모드로 연속 대화 시작! 자동으로 음성을 감지합니다.' : '💬 연속 대화 모드 시작! AI와 자유롭게 대화하세요.');
    
    await startListening();
  }, [isConnected, startConnection, addSystemMessage, startListening, isVADEnabled]);
  
  // 🔥 대화 중지
  const stopConversation = useCallback(() => {
    setConversationActive(false);
    
    vadRecorder.stopRecording();
    audioPlayer.stop();
    conversationFlow.stopSpeaking();
    
    setRecording(false);
    setSpeaking(false);
    setCurrentStatus('ready');
    setProcessingStep('');
    
    // 로딩 프로그래스바도 숨기기
    resetLoadingState();
    
    addSystemMessage('🛑 대화가 중지되었습니다.');
  }, [vadRecorder, audioPlayer, conversationFlow, setRecording, setSpeaking, addSystemMessage, resetLoadingState]);
  
  // 🔥 연결 종료
  const disconnect = useCallback(() => {
    stopConversation();
    conversationFlow.close();
    
    setConnected(false);
    setCurrentStatus('disconnected');
    setShowAvatar(false);
    resetLoadingState();
    addSystemMessage('👋 연결이 종료되었습니다.');
  }, [stopConversation, conversationFlow, setConnected, addSystemMessage, resetLoadingState]);
  
  // 🔥 전체 화면 모드 열기/닫기
  const openFullScreen = useCallback(async () => {
    setShowFullScreen(true);
  }, []);

  const closeFullScreen = useCallback(() => {
    setShowFullScreen(false);
  }, []);

  // 🔥 아바타 상태 계산
  const getAvatarAnimationClass = () => {
    if (!isConnected || !showAvatar) return 'ready';
    if (isRecording) return 'listening';
    if (isSpeaking) return 'talking';
    if (currentStatus === 'thinking') return 'thinking';
    return 'ready';
  };

  // 🔥 상태별 버튼 및 메시지
  const getMainButton = () => {
    if (!isConnected) {
      return (
        <button 
          className="main-button connect-button"
          onClick={startConnection}
          disabled={false}
        >
          <span className="button-icon">🔌</span>
          <span className="button-text">대화 시작</span>
        </button>
      );
    }
    
    if (!conversationActive) {
      return (
        <>
          <button 
            className="main-button start-conversation-button"
            onClick={startConversation}
            disabled={false}
          >
            <span className="button-icon">💬</span>
            <span className="button-text">{isVADEnabled ? 'VAD 대화하기' : '대화하기'}</span>
            <span className="button-subtitle">{isVADEnabled ? '자동 음성 감지 모드' : '한 번 클릭으로 연속 대화'}</span>
          </button>
          
          <button 
            className="manual-button"
            onClick={startListening}
          >
            🎤 한 번만 말하기
          </button>
        </>
      );
    }
    
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
      talking: '🗣️ AI가 답변하고 있어요!'
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
      {/* 🔥 백엔드 로딩 프로그래스바 - 개선된 조건 */}
      <LoadingProgressBar
        isVisible={loadingState.isVisible}
        progress={loadingState.progress}
        status={loadingState.status}
        title={loadingState.title}
        modelName={loadingState.modelName}
        onClose={loadingState.isComplete ? handleCloseProgressBar : null}
      />
      
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
          
          {currentTranscript && (
            <div className="current-transcript">
              <span className="transcript-label">인식된 음성:</span>
              <span className="transcript-text">"{currentTranscript}"</span>
            </div>
          )}
          
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

        {/* 🔥 아바타 표시 공간 - 대화하기 버튼 클릭 시 react.svg 표시 */}
        {showAvatar && (
          <div className="avatar-space">
            <div className="avatar-placeholder">
              <img 
                src={reactSvg} 
                alt="React Avatar" 
                className={`avatar-image ${getAvatarAnimationClass()}`}
              />
              <p className="avatar-status-text">
                {getStatusMessage()}
              </p>
            </div>
          </div>
        )}
        
        {/* 🔥 메인 컨트롤 버튼 */}
        <div className="control-section">
          {getMainButton()}
          
          {isConnected && (
            <>
              <div className="settings-buttons">
                <button 
                  className={`secondary-button tts-settings-button ${showTTSControls ? 'active' : ''}`}
                  onClick={() => setShowTTSControls(!showTTSControls)}
                >
                  <span className="button-icon">🎤</span>
                  <span className="button-text">음성 설정</span>
                </button>
                
                <button 
                  className={`secondary-button vad-settings-button ${showVADControls ? 'active' : ''}`}
                  onClick={() => setShowVADControls(!showVADControls)}
                >
                  <span className="button-icon">🎙️</span>
                  <span className="button-text">VAD 설정</span>
                </button>
                
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

        {/* 🔥 TTS 및 목소리 설정 UI */}
        {showTTSControls && (
          <div className="settings-panel">
            <VoiceTTSControl 
              onSettingsChange={handleTTSSettingsChange}
              className="voice-tts-panel"
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