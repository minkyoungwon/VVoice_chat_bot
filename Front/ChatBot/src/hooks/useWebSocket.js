import { useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// 환경 변수에서 설정 가져오기
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export const useWebSocket = () => {
  const wsRef = useRef(null);
  const clientIdRef = useRef(uuidv4());
  
  const connect = useCallback((endpoint, onMessage, onOpen, onClose, onError) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    const url = `${WS_BASE_URL}/ws/${endpoint}/${clientIdRef.current}`;
    wsRef.current = new WebSocket(url);
    
    wsRef.current.onopen = onOpen || (() => {});
    wsRef.current.onmessage = onMessage || (() => {});
    wsRef.current.onclose = onClose || (() => {});
    wsRef.current.onerror = onError || (() => {});
    
    return wsRef.current;
  }, []);
  
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        wsRef.current.send(data);
      } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        wsRef.current.send(data);
      } else {
        wsRef.current.send(JSON.stringify(data));
      }
    }
  }, []);
  
  const close = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
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
  
  return { connect, send, close, isConnected };
};

export const useTTSWebSocket = () => {
  const { connect, send, close, isConnected } = useWebSocket();
  
  const connectTTS = useCallback((onAudioData, onComplete, onError) => {
    const handleMessage = (event) => {
      if (typeof event.data === 'string') {
        if (event.data === 'end') {
          onComplete?.();
        } else {
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              onError?.(data.error);
            } else if (data.sr && data.dtype) {
              // 샘플링 정보 수신
              console.log('TTS 샘플링 정보:', data);
            }
          } catch (e) {
            console.error('TTS 메시지 파싱 오류:', e);
          }
        }
      } else if (event.data instanceof Blob) {
        // 오디오 데이터 수신
        event.data.arrayBuffer().then(onAudioData);
      }
    };
    
    return connect(
      'tts',
      handleMessage,
      () => console.log('TTS WebSocket 연결됨'),
      () => console.log('TTS WebSocket 연결 해제됨'),
      (error) => {
        console.error('TTS WebSocket 오류:', error);
        onError?.(error);
      }
    );
  }, [connect]);
  
  const generateTTS = useCallback((text, options = {}) => {
    const request = {
      text,
      model: options.model || "Zyphra/Zonos-v0.1-transformer",
      language: options.language || "ko",
      format: "pcm",
      ...options
    };
    
    send(request);
  }, [send]);
  
  const stopTTS = useCallback(() => {
    send("stop");
  }, [send]);
  
  return {
    connectTTS,
    generateTTS,
    stopTTS,
    close,
    isConnected
  };
};

export const useSTTWebSocket = () => {
  const { connect, send, close, isConnected } = useWebSocket();
  
  const connectSTT = useCallback((onTranscript, onError) => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          onError?.(data.error);
        } else if (data.transcript !== undefined) {
          onTranscript?.(data.transcript);
        }
      } catch (e) {
        console.error('STT 메시지 파싱 오류:', e);
      }
    };
    
    return connect(
      'stt',
      handleMessage,
      () => console.log('STT WebSocket 연결됨'),
      () => console.log('STT WebSocket 연결 해제됨'),
      (error) => {
        console.error('STT WebSocket 오류:', error);
        onError?.(error);
      }
    );
  }, [connect]);
  
  const sendAudioChunk = useCallback((audioData) => {
    send(audioData);
  }, [send]);
  
  const endSTT = useCallback(() => {
    send("end");
  }, [send]);
  
  return {
    connectSTT,
    sendAudioChunk,
    endSTT,
    close,
    isConnected
  };
};
