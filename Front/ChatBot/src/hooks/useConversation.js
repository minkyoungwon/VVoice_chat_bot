import { useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// 환경 변수에서 설정 가져오기
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export const useConversationWebSocket = () => {
  const wsRef = useRef(null);
  const clientIdRef = useRef(uuidv4());
  const currentStreamIdRef = useRef(null); // 🔥 현재 스트림 ID 추적
  const pendingAudioChunkRef = useRef(null); // 🔥 대기 중인 오디오 청크 메타데이터
  
  const connect = useCallback((onMessage, onOpen, onClose, onError) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    const url = `${WS_BASE_URL}/ws/conversation/${clientIdRef.current}`;
    wsRef.current = new WebSocket(url);
    
    wsRef.current.onopen = onOpen || (() => {});
    wsRef.current.onclose = onClose || (() => {});
    wsRef.current.onerror = onError || (() => {});
    
    wsRef.current.onmessage = (event) => {
      try {
        // 🔥 바이너리 데이터 처리 개선 - Blob과 ArrayBuffer 모두 처리
        if (event.data instanceof ArrayBuffer) {
          console.log('📊 ArrayBuffer 오디오 데이터 수신:', event.data.byteLength, 'bytes');
          // 바이너리 오디오 데이터 처리
          const pendingMeta = pendingAudioChunkRef.current;
          if (pendingMeta && pendingMeta.stream_id === currentStreamIdRef.current) {
            // 메타데이터와 함께 오디오 데이터 전달
            onMessage?.({
              event: 'audio_chunk_binary',
              ...pendingMeta,
              audioData: event.data
            });
            pendingAudioChunkRef.current = null;
          } else {
            console.warn('⚠️ 메타데이터 없는 ArrayBuffer 데이터 무시');
          }
        } else if (event.data instanceof Blob) {
          console.log('📊 Blob 오디오 데이터 수신:', event.data.size, 'bytes');
          // Blob을 ArrayBuffer로 변환
          event.data.arrayBuffer().then(arrayBuffer => {
            const pendingMeta = pendingAudioChunkRef.current;
            if (pendingMeta && pendingMeta.stream_id === currentStreamIdRef.current) {
              console.log('✅ Blob -> ArrayBuffer 변환 완료:', arrayBuffer.byteLength, 'bytes');
              onMessage?.({
                event: 'audio_chunk_binary',
                ...pendingMeta,
                audioData: arrayBuffer
              });
              pendingAudioChunkRef.current = null;
            } else {
              console.warn('⚠️ 메타데이터 없는 Blob 데이터 무시');
            }
          }).catch(error => {
            console.error('❌ Blob -> ArrayBuffer 변환 실패:', error);
          });
        } else if (typeof event.data === 'string') {
          // JSON 메시지 처리
          try {
            const data = JSON.parse(event.data);
            console.log('📨 JSON 메시지 수신:', data.event || data.type || 'unknown');
            
            // 🔥 오디오 청크 메타데이터 저장
            if (data.event === 'audio_chunk_meta') {
              console.log('📝 오디오 메타데이터 저장:', data.stream_id, data.chunk_index);
              pendingAudioChunkRef.current = data;
              
              // 메타데이터만 전달하여 클라이언트가 준비할 수 있도록 함
              onMessage?.(data);
            } else {
              onMessage?.(data);
            }
          } catch (parseError) {
            console.error('❌ JSON 파싱 오류:', parseError);
            console.error('원본 데이터:', event.data);
          }
        } else {
          console.warn('⚠️ 알 수 없는 데이터 타입:', typeof event.data, event.data);
        }
      } catch (e) {
        console.error('❌ 메시지 처리 오류:', e);
      }
    };
    
    return wsRef.current;
  }, []);
  
  const sendConfiguration = useCallback((config) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(config));
    }
  }, []);
  
  const sendAudioChunk = useCallback((audioData) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
    }
  }, []);
  
  const sendCommand = useCallback((command) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(command);
    }
  }, []);
  
  const close = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    currentStreamIdRef.current = null; // 🔥 스트림 ID 초기화
    pendingAudioChunkRef.current = null; // 🔥 대기 중인 메타데이터 초기화
  }, []);
  
  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN;
  }, []);
  
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  return { 
    connect, 
    sendConfiguration, 
    sendAudioChunk, 
    sendCommand, 
    close, 
    isConnected,
    clientId: clientIdRef.current,
    currentStreamIdRef, // 🔥 스트림 ID 참조 노출
    pendingAudioChunkRef // 🔥 메타데이터 참조 노출
  };
};

export const useConversationFlow = () => {
  const { 
    connect, 
    sendConfiguration, 
    sendAudioChunk, 
    sendCommand, 
    close, 
    isConnected,
    clientId,
    currentStreamIdRef,
    pendingAudioChunkRef
  } = useConversationWebSocket();
  
  const connectConversation = useCallback((
    onSTTResult,
    onGPTResponse, 
    onTTSStart,
    onTTSAudio,
    onTTSComplete,
    onError,
    onStateChange
  ) => {
    const handleMessage = (data) => {
      switch (data.event) {
        case 'stt_completed':
          onSTTResult?.(data.transcript);
          break;
          
        case 'stt_empty':
          onSTTResult?.('');
          break;
          
        case 'gpt_response':
          onGPTResponse?.(data.response);
          break;
          
        case 'tts_started':
          onTTSStart?.(data.sr, data.dtype);
          break;
          
        // 🔥 새로운 스트림 시작 처리
        case 'audio_stream_start':
          console.log('🎵 새 오디오 스트림 시작:', data.stream_id);
          currentStreamIdRef.current = data.stream_id;
          onTTSStart?.(data.sample_rate, 'int16');
          break;
          
        // 🔥 이전 스트림 중단 처리
        case 'audio_stop_previous':
          console.log('🔇 이전 오디오 스트림 중단');
          onStateChange?.('audio_stop_previous');
          break;
          
        // 🔥 바이너리 오디오 청크 처리 - 디버깅 강화
        case 'audio_chunk_binary':
          console.log('🎵 바이너리 오디오 청크 수신:', {
            streamId: data.stream_id,
            currentStreamId: currentStreamIdRef.current,
            chunkIndex: data.chunk_index,
            totalChunks: data.total_chunks,
            audioDataSize: data.audioData?.byteLength,
            isFinalChunk: data.is_final_chunk
          });
          
          // 스트림 ID 검증 - 현재 스트림만 처리
          if (data.stream_id && data.stream_id === currentStreamIdRef.current) {
            if (data.audioData && data.audioData.byteLength > 0) {
              console.log(`✅ 오디오 청크 전달: ${data.chunk_index + 1}/${data.total_chunks}`);
              onTTSAudio?.(data.audioData);
            } else {
              console.warn('⚠️ 빈 오디오 데이터 수신');
            }
            
            // 🔥 최종 청크인 경우 완료 처리 준비
            if (data.is_final_chunk) {
              console.log('📤 최종 오디오 청크 수신됨');
            }
          } else {
            console.log('⚠️ 잘못된 스트림 ID의 오디오 청크 무시:', {
              receivedStreamId: data.stream_id,
              expectedStreamId: currentStreamIdRef.current
            });
          }
          break;
          
        // 🔥 레거시 JSON 오디오 청크 처리 (호환성)
        case 'audio_chunk':
          console.warn('⚠️ 레거시 JSON 오디오 청크 발견 - 바이너리로 업데이트 권장');
          const audioArray = new Int16Array(data.data);
          onTTSAudio?.(audioArray.buffer);
          break;
          
        // 🔥 스트림 완료 처리
        case 'audio_stream_complete':
          if (data.stream_id === currentStreamIdRef.current) {
            console.log('✅ 오디오 스트림 완료:', data.stream_id);
            onTTSComplete?.();
            currentStreamIdRef.current = null;
          }
          break;
          
        // 🔥 새로운 간단한 JSON 오디오 데이터 처리 - 강화
        case 'audio_data_complete':
          console.log('🎵 전체 오디오 데이터 수신:', {
            format: data.format,
            sampleRate: data.sample_rate,
            duration: data.duration,
            rtf: data.rtf,
            dataSize: data.audio_data?.length,
            dataPreview: data.audio_data?.substring(0, 50) + '...' // Base64 문자열 미리보기
          });
          
          if (data.audio_data && data.format === 'pcm_int16_base64') {
            try {
              // Base64 디코딩
              console.log('🔍 Base64 디코딩 시작:', {
                base64Length: data.audio_data.length,
                base64Preview: data.audio_data.substring(0, 100)
              });
              
              const binaryString = atob(data.audio_data);
              console.log('🔍 atob 결과:', {
                binaryStringLength: binaryString.length,
                firstCharCodes: Array.from(binaryString.substring(0, 20)).map(c => c.charCodeAt(0))
              });
              
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              console.log('🔍 Uint8Array 변환:', {
                bytesLength: bytes.length,
                first20Bytes: Array.from(bytes.slice(0, 20)),
                first20Hex: Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')
              });
              
              // ArrayBuffer로 변환
              const audioBuffer = bytes.buffer;
              
              console.log('✅ Base64 -> ArrayBuffer 변환 완료:', {
                arrayBufferSize: audioBuffer.byteLength,
                expectedSamples: audioBuffer.byteLength / 2, // 16-bit = 2 bytes per sample
                serverSampleRate: data.sample_rate,
                estimatedDuration: (audioBuffer.byteLength / 2) / data.sample_rate
              });
              
              // 🔥 더 자세한 디버깅: Int16Array로 변환해서 실제 오디오 데이터 확인
              const int16View = new Int16Array(audioBuffer);
              const maxSample = Math.max(...int16View.slice(0, Math.min(1000, int16View.length)));
              const minSample = Math.min(...int16View.slice(0, Math.min(1000, int16View.length)));
              
              console.log('📊 디코딩된 오디오 데이터 분석:', {
                samples: int16View.length,
                maxSample: maxSample,
                minSample: minSample,
                firstFewSamples: Array.from(int16View.slice(0, 10)),
                isQuiet: Math.abs(maxSample) < 100 && Math.abs(minSample) < 100
              });
              
              if (Math.abs(maxSample) < 10 && Math.abs(minSample) < 10) {
                console.warn('⚠️ 디코딩된 오디오 데이터가 매우 조용하거나 무음입니다!');
              }
              
              // 🔥 서버의 샘플레이트를 사용하여 TTS 오디오 핸들러로 전달
              onTTSAudio?.(audioBuffer, data.sample_rate || 24000);
              
            } catch (error) {
              console.error('❌ Base64 디코딩 오류:', error);
              console.error('오류 스택:', error.stack);
              onError?.('Base64 오디오 디코딩 실패');
            }
          } else {
            console.warn('⚠️ 잘못된 오디오 데이터 형식:', data.format);
          }
          break;
          
        case 'tts_completed':
          onTTSComplete?.();
          currentStreamIdRef.current = null; // 🔥 스트림 완료 시 ID 초기화
          break;
          
        case 'tts_stopped':
          onStateChange?.('tts_stopped');
          currentStreamIdRef.current = null; // 🔥 스트림 중단 시 ID 초기화
          break;
          
        case 'config_updated':
          onStateChange?.('config_updated', data.settings);
          break;
          
        // 🔥 스트림 오류 처리
        case 'audio_stream_error':
          console.error('❌ 오디오 스트림 오류:', data.error);
          onError?.(data.error || 'Audio stream error');
          currentStreamIdRef.current = null;
          break;
          
        default:
          if (data.error) {
            onError?.(data.error);
          }
          break;
      }
    };
    
    return connect(
      handleMessage,
      () => {
        console.log('🔗 대화형 WebSocket 연결됨 - URL:', `${WS_BASE_URL}/ws/conversation/${clientId}`);
        onStateChange?.('connected');
      },
      (event) => {
        console.log('🔌 대화형 WebSocket 연결 해제됨 - Code:', event.code, 'Reason:', event.reason);
        currentStreamIdRef.current = null; // 🔥 연결 해제 시 스트림 ID 초기화
        onStateChange?.('disconnected');
      },
      (error) => {
        console.error('❌ 대화형 WebSocket 오류:', error);
        console.error('연결 URL:', `${WS_BASE_URL}/ws/conversation/${clientId}`);
        currentStreamIdRef.current = null; // 🔥 오류 시 스트림 ID 초기화
        onError?.(error);
      }
    );
  }, [connect]);
  
  const updateSettings = useCallback((settings) => {
    sendConfiguration(settings);
  }, [sendConfiguration]);
  
  const startRecording = useCallback(() => {
    // 녹음 시작은 별도의 Web Audio API로 처리
    // 여기서는 서버에 녹음 시작을 알림
    sendCommand('start_recording');
  }, [sendCommand]);
  
  const stopRecording = useCallback(() => {
    sendCommand('stop_recording');
  }, [sendCommand]);
  
  const stopSpeaking = useCallback(() => {
    // 🔥 현재 스트림 중단
    console.log('🔇 음성 재생 중단 요청');
    sendCommand('stop_speaking');
    currentStreamIdRef.current = null; // 스트림 ID 초기화
  }, [sendCommand, currentStreamIdRef]);
  
  const sendVoiceData = useCallback((audioData) => {
    sendAudioChunk(audioData);
  }, [sendAudioChunk]);
  
  return {
    connectConversation,
    updateSettings,
    startRecording,
    stopRecording,
    stopSpeaking,
    sendVoiceData,
    close,
    isConnected,
    clientId
  };
};
