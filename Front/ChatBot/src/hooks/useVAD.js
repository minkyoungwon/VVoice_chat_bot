import { useRef, useCallback, useState, useEffect } from 'react';

// VAD (Voice Activity Detection) 기능이 있는 PCM 레코더
export const useVADRecorder = () => {
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isVoiceDetected, setIsVoiceDetected] = useState(false);
  
  // VAD 설정
  const vadConfigRef = useRef({
    voiceThreshold: 0.06,     // 🔥 음성 감지 임계값 0.1 → 0.06으로 더 민감하게
    silenceThreshold: 0.025,  // 🔥 정적 감지 임계값 0.05 → 0.025로 더 민감하게
    minVoiceDuration: 250,    // 🔥 최소 음성 지속 시간 300 → 250으로 더 빠르게
    maxSilenceDuration: 1000, // 🔥 최대 정적 지속 시간 1500 → 1000으로 더 빠르게
    bufferDuration: 400       // 🔥 녹음 시작 전 버퍼 시간 500 → 400으로 더 빠르게
  });
  
  // VAD 상태 추적
  const vadStateRef = useRef({
    isVoiceActive: false,
    voiceStartTime: 0,
    silenceStartTime: 0,
    lastVoiceTime: 0,
    audioBuffer: []
  });
  
  const onPCMDataRef = useRef(null);
  const onVoiceStartRef = useRef(null);
  const onVoiceEndRef = useRef(null);
  const onSilenceDetectedRef = useRef(null);
  
  // 오디오 레벨 분석 함수
  const analyzeAudioLevel = useCallback((audioData) => {
    if (!analyserRef.current) return 0;
    
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);
    
    // RMS (Root Mean Square) 계산
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    
    return rms;
  }, []);
  
  // VAD 로직 처리
  const processVAD = useCallback((audioLevel) => {
    const now = Date.now();
    const config = vadConfigRef.current;
    const state = vadStateRef.current;
    
    setVoiceLevel(audioLevel);
    
    if (audioLevel > config.voiceThreshold) {
      // 음성 감지됨
      if (!state.isVoiceActive) {
        // 음성 시작
        state.isVoiceActive = true;
        state.voiceStartTime = now;
        setIsVoiceDetected(true);
        
        if (onVoiceStartRef.current) {
          onVoiceStartRef.current();
        }
        
        console.log('🎤 음성 감지 시작 - 레벨:', audioLevel.toFixed(3));
      }
      
      state.lastVoiceTime = now;
      state.silenceStartTime = 0; // 정적 타이머 리셋
      
    } else if (audioLevel < config.silenceThreshold) {
      // 정적 감지됨
      if (state.isVoiceActive) {
        const voiceDuration = now - state.voiceStartTime;
        
        if (voiceDuration >= config.minVoiceDuration) {
          // 충분한 음성이 감지되었음
          if (state.silenceStartTime === 0) {
            state.silenceStartTime = now;
          }
          
          const silenceDuration = now - state.silenceStartTime;
          
          if (silenceDuration >= config.maxSilenceDuration) {
            // 충분한 정적이 지속됨 - 음성 종료
            state.isVoiceActive = false;
            setIsVoiceDetected(false);
            
            if (onVoiceEndRef.current) {
              onVoiceEndRef.current();
            }
            
            if (onSilenceDetectedRef.current) {
              onSilenceDetectedRef.current();
            }
            
            console.log('🔇 음성 종료 감지 - 음성 길이:', voiceDuration, 'ms, 정적 길이:', silenceDuration, 'ms');
          }
        }
      }
    }
    
    // 중간 레벨 (임계값 사이)
    if (audioLevel >= config.silenceThreshold && audioLevel <= config.voiceThreshold) {
      // 임계값 사이의 모호한 레벨은 현재 상태 유지
      if (state.isVoiceActive && state.silenceStartTime > 0) {
        const silenceDuration = now - state.silenceStartTime;
        if (silenceDuration >= config.maxSilenceDuration) {
          const voiceDuration = now - state.voiceStartTime;
          if (voiceDuration >= config.minVoiceDuration) {
            state.isVoiceActive = false;
            setIsVoiceDetected(false);
            
            if (onVoiceEndRef.current) {
              onVoiceEndRef.current();
            }
            
            if (onSilenceDetectedRef.current) {
              onSilenceDetectedRef.current();
            }
            
            console.log('🔇 음성 종료 감지 (중간 레벨) - 음성 길이:', voiceDuration, 'ms');
          }
        }
      }
    }
  }, []);
  
  const startRecording = useCallback(async (onPCMData, options = {}) => {
    try {
      setError(null);
      
      // 콜백 저장
      onPCMDataRef.current = onPCMData;
      onVoiceStartRef.current = options.onVoiceStart;
      onVoiceEndRef.current = options.onVoiceEnd;
      onSilenceDetectedRef.current = options.onSilenceDetected;
      
      // VAD 설정 업데이트
      if (options.vadConfig) {
        vadConfigRef.current = { ...vadConfigRef.current, ...options.vadConfig };
      }
      
      // VAD 상태 초기화
      vadStateRef.current = {
        isVoiceActive: false,
        voiceStartTime: 0,
        silenceStartTime: 0,
        lastVoiceTime: 0,
        audioBuffer: []
      };
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false // VAD를 위해 자동 게인 컨트롤 비활성화
        }
      });
      
      streamRef.current = stream;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // 분석기 생성 (VAD용)
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      source.connect(analyserRef.current);
      
      // 프로세서 생성 (PCM 데이터 추출용)
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // 오디오 레벨 분석
        const audioLevel = analyzeAudioLevel(inputData);
        processVAD(audioLevel);
        
        // PCM 데이터 변환
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // PCM 데이터 전송
        if (onPCMDataRef.current) {
          onPCMDataRef.current(int16Array.buffer);
        }
      };
      
      analyserRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      setIsVoiceDetected(false);
      
      console.log('🎤 VAD 레코더 시작됨');
      
    } catch (err) {
      console.error('❌ VAD 녹음 시작 오류:', err);
      setError(err.message);
      setIsRecording(false);
    }
  }, [analyzeAudioLevel, processVAD]);
  
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // VAD 상태 초기화
    vadStateRef.current = {
      isVoiceActive: false,
      voiceStartTime: 0,
      silenceStartTime: 0,
      lastVoiceTime: 0,
      audioBuffer: []
    };
    
    setIsRecording(false);
    setIsVoiceDetected(false);
    setVoiceLevel(0);
    
    console.log('🔇 VAD 레코더 중지됨');
  }, []);
  
  const updateVADConfig = useCallback((newConfig) => {
    vadConfigRef.current = { ...vadConfigRef.current, ...newConfig };
    console.log('⚙️ VAD 설정 업데이트됨:', vadConfigRef.current);
  }, []);
  
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);
  
  return {
    startRecording,
    stopRecording,
    updateVADConfig,
    isRecording,
    isVoiceDetected,
    voiceLevel,
    vadConfig: vadConfigRef.current,
    error
  };
};

// 기존 usePCMRecorder도 내보내기 (하위 호환성)
export const usePCMRecorder = () => {
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  
  const startRecording = useCallback(async (onPCMData) => {
    try {
      setError(null);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        onPCMData?.(int16Array.buffer);
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      
    } catch (err) {
      console.error('PCM 녹음 시작 오류:', err);
      setError(err.message);
      setIsRecording(false);
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  }, []);
  
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);
  
  return {
    startRecording,
    stopRecording,
    isRecording,
    error
  };
};
