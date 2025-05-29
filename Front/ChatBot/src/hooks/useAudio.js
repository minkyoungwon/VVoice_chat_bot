import { useRef, useCallback, useEffect, useState } from 'react';

export const useAudioPlayer = () => {
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const currentSourceRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [debugInfo, setDebugInfo] = useState('');
  
  useEffect(() => {
    // AudioContext 초기화 - 고정된 샘플레이트 사용
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000, // 🔥 서버와 동일한 샘플레이트로 고정
          latencyHint: 'interactive'
        });
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
        
        console.log('🎵 AudioContext 초기화 완료:', {
          sampleRate: audioContextRef.current.sampleRate,
          state: audioContextRef.current.state
        });
        setDebugInfo(`AudioContext 생성됨 (${audioContextRef.current.sampleRate}Hz)`);
      } catch (error) {
        console.error('❌ AudioContext 초기화 실패:', error);
        setDebugInfo(`AudioContext 초기화 실패: ${error.message}`);
      }
    }
    
    return () => {
      stop();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);
  
  // 🔥 현재 오디오 중단 함수 (개선됨)
  const stopCurrentAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        console.log('🔇 현재 오디오 소스 중단됨');
      } catch (e) {
        // 이미 중단된 경우 무시
        console.log('ℹ️ 오디오 소스 이미 중단됨');
      }
      currentSourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);
  
  // 🔥 완전히 새롭게 작성된 PCM 재생 함수 - 디버깅 강화
  const playPCMChunk = useCallback(async (arrayBuffer, inputSampleRate = 24000) => {
    console.log('🎵 PCM 재생 시작:', {
      bufferSize: arrayBuffer.byteLength,
      inputSampleRate: inputSampleRate,
      audioContextState: audioContextRef.current?.state,
      audioContextSampleRate: audioContextRef.current?.sampleRate
    });
    
    if (!audioContextRef.current || !gainNodeRef.current) {
      console.error('❌ AudioContext가 준비되지 않음');
      setDebugInfo('AudioContext가 준비되지 않음');
      return;
    }
    
    // AudioContext 상태 확인 및 재개
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        console.log('🔊 AudioContext 재개됨');
        setDebugInfo('AudioContext 재개됨');
      } catch (error) {
        console.error('❌ AudioContext 재개 실패:', error);
        setDebugInfo(`AudioContext 재개 실패: ${error.message}`);
        return;
      }
    }
    
    try {
      // 🔥 이전 오디오 즉시 중단
      stopCurrentAudio();
      
      // 🔥 디버깅: ArrayBuffer 내용 검사
      const uint8View = new Uint8Array(arrayBuffer.slice(0, 20));
      console.log('🔍 ArrayBuffer 처음 20바이트:', Array.from(uint8View).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Int16Array로 변환
      const int16Array = new Int16Array(arrayBuffer);
      console.log('📊 오디오 데이터 분석:', {
        samples: int16Array.length,
        duration: int16Array.length / inputSampleRate,
        maxValue: Math.max(...int16Array.slice(0, Math.min(1000, int16Array.length))),
        minValue: Math.min(...int16Array.slice(0, Math.min(1000, int16Array.length))),
        firstFewSamples: Array.from(int16Array.slice(0, 10))
      });
      
      // 🔥 오디오 데이터가 비어있거나 조용한지 확인
      const maxSample = Math.max(...int16Array.slice(0, Math.min(1000, int16Array.length)));
      const minSample = Math.min(...int16Array.slice(0, Math.min(1000, int16Array.length)));
      if (Math.abs(maxSample) < 100 && Math.abs(minSample) < 100) {
        console.warn('⚠️ 오디오 데이터가 매우 조용합니다 (max:', maxSample, ', min:', minSample, ')');
        setDebugInfo('오디오 데이터가 매우 조용함');
      }
      
      // Float32Array로 변환
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      // 🔥 AudioBuffer 생성 - 샘플레이트 맞춤
      const audioContextSampleRate = audioContextRef.current.sampleRate;
      let finalAudioBuffer;
      
      if (inputSampleRate === audioContextSampleRate) {
        // 샘플레이트가 같으면 바로 사용
        finalAudioBuffer = audioContextRef.current.createBuffer(
          1, // 모노
          float32Array.length,
          audioContextSampleRate
        );
        finalAudioBuffer.getChannelData(0).set(float32Array);
        console.log('✅ 샘플레이트 일치 - 바로 사용');
      } else {
        // 샘플레이트가 다르면 리샘플링
        console.log('🔄 샘플레이트 변환 시작:', inputSampleRate, '→', audioContextSampleRate);
        
        const ratio = audioContextSampleRate / inputSampleRate;
        const newLength = Math.floor(float32Array.length * ratio);
        const resampledArray = new Float32Array(newLength);
        
        // 선형 보간 리샘플링
        for (let i = 0; i < newLength; i++) {
          const sourceIndex = i / ratio;
          const index = Math.floor(sourceIndex);
          const fraction = sourceIndex - index;
          
          if (index + 1 < float32Array.length) {
            resampledArray[i] = float32Array[index] * (1 - fraction) + float32Array[index + 1] * fraction;
          } else {
            resampledArray[i] = float32Array[index] || 0;
          }
        }
        
        finalAudioBuffer = audioContextRef.current.createBuffer(
          1,
          newLength,
          audioContextSampleRate
        );
        finalAudioBuffer.getChannelData(0).set(resampledArray);
        
        console.log('✅ 리샘플링 완료:', {
          originalLength: float32Array.length,
          newLength: newLength,
          ratio: ratio
        });
      }
      
      // 🔥 AudioBuffer 내용 검사
      const bufferData = finalAudioBuffer.getChannelData(0);
      const bufferMax = Math.max(...bufferData.slice(0, Math.min(1000, bufferData.length)));
      const bufferMin = Math.min(...bufferData.slice(0, Math.min(1000, bufferData.length)));
      console.log('🎶 최종 AudioBuffer 분석:', {
        duration: finalAudioBuffer.duration,
        sampleRate: finalAudioBuffer.sampleRate,
        length: finalAudioBuffer.length,
        maxValue: bufferMax,
        minValue: bufferMin,
        firstFewSamples: Array.from(bufferData.slice(0, 10))
      });
      
      if (Math.abs(bufferMax) < 0.01 && Math.abs(bufferMin) < 0.01) {
        console.warn('⚠️ 최종 AudioBuffer가 매우 조용합니다!');
        setDebugInfo('최종 AudioBuffer가 매우 조용함');
      }
      
      // 🔥 오디오 소스 생성 및 재생
      const source = audioContextRef.current.createBufferSource();
      source.buffer = finalAudioBuffer;
      source.connect(gainNodeRef.current);
      
      // 현재 소스로 설정
      currentSourceRef.current = source;
      setIsPlaying(true);
      
      // 재생 완료 이벤트
      source.onended = () => {
        console.log('✅ 오디오 재생 완료');
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null;
          setIsPlaying(false);
        }
      };
      
      // 오류 이벤트
      source.onerror = (error) => {
        console.error('❌ 오디오 재생 오류:', error);
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null;
          setIsPlaying(false);
        }
        setDebugInfo(`재생 오류: ${error.message || '알 수 없는 오류'}`);
      };
      
      // 재생 시작
      source.start();
      
      console.log('🎶 오디오 재생 시작:', {
        duration: finalAudioBuffer.duration,
        sampleRate: finalAudioBuffer.sampleRate,
        gainValue: gainNodeRef.current.gain.value
      });
      
      setDebugInfo(`재생 중: ${finalAudioBuffer.duration.toFixed(2)}초, ${finalAudioBuffer.sampleRate}Hz, 볼륨: ${gainNodeRef.current.gain.value}`);
      
    } catch (error) {
      console.error('❌ PCM 재생 오류:', error);
      console.error('오류 스택:', error.stack);
      setDebugInfo(`재생 오류: ${error.message}`);
      setIsPlaying(false);
    }
  }, [stopCurrentAudio]);
  
  // 🔥 전체 중단 함수
  const stop = useCallback(() => {
    stopCurrentAudio();
    console.log('🔇 오디오 플레이어 중단');
  }, [stopCurrentAudio]);
  
  // 🔥 새 오디오 시작 시 이전 오디오 중단
  const startNewAudio = useCallback(() => {
    stopCurrentAudio();
    console.log('🎵 새 오디오 시작 - 이전 오디오 중단');
  }, [stopCurrentAudio]);
  
  // 🔥 테스트용 오디오 재생 함수 (개선됨)
  const testAudioPlayback = useCallback(async () => {
    console.log('🎧 오디오 재생 테스트 시작');
    
    try {
      if (!audioContextRef.current) {
        setDebugInfo('오류: AudioContext가 생성되지 않음');
        return;
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('🔊 AudioContext 재개됨');
      }
      
      // 테스트용 440Hz 사인파 생성 (1초)
      const sampleRate = audioContextRef.current.sampleRate;
      const duration = 1;
      const frequency = 440;
      
      const buffer = audioContextRef.current.createBuffer(1, sampleRate * duration, sampleRate);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
      }
      
      // 이전 오디오 중단
      stopCurrentAudio();
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current);
      
      currentSourceRef.current = source;
      setIsPlaying(true);
      
      source.onended = () => {
        console.log('✅ 테스트 오디오 재생 완료');
        setDebugInfo('테스트 오디오 재생 완료');
        setIsPlaying(false);
        currentSourceRef.current = null;
      };
      
      source.start();
      
      console.log('🎵 테스트 오디오 재생 시작');
      setDebugInfo('테스트 오디오 재생 중... (440Hz 사인파)');
      
    } catch (error) {
      console.error('❌ 테스트 오디오 재생 실패:', error);
      setDebugInfo(`테스트 오디오 실패: ${error.message}`);
    }
  }, [stopCurrentAudio]);
  
  const resumeContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
      console.log('🔊 AudioContext 재개됨');
    }
  }, []);
  
  return {
    playPCMChunk,
    stop,
    startNewAudio,
    resumeContext,
    testAudioPlayback,
    isPlaying,
    volume,
    setVolume,
    debugInfo,
    audioContextState: audioContextRef.current?.state || 'not_created'
  };
};

export const useAudioRecorder = () => {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  
  const startRecording = useCallback(async (onDataAvailable) => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onDataAvailable?.(event.data);
        }
      };
      
      mediaRecorderRef.current.onstart = () => {
        setIsRecording(true);
      };
      
      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
      };
      
      mediaRecorderRef.current.start(100);
      
    } catch (err) {
      console.error('녹음 시작 오류:', err);
      setError(err.message);
      setIsRecording(false);
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  }, [isRecording]);
  
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