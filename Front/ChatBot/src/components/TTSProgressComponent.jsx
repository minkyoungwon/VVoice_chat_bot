import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/TTSProgressComponent.css';

const TTSProgressComponent = () => {
  // WebSocket 연결 상태
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('연결 중...');
  
  // 모델 로딩 상태
  const [modelLoadingStatus, setModelLoadingStatus] = useState({
    isLoading: false,
    progress: 0,
    status: '',
    model: '',
    error: null
  });
  
  // TTS 생성 상태
  const [ttsStatus, setTtsStatus] = useState({
    isGenerating: false,
    progress: 0,
    step: 0,
    totalSteps: 0,
    estimatedTimeRemaining: 0,
    text: '',
    latency: 0,
    rtf: 0 // Real-Time Factor
  });
  
  // 서버 정보
  const [serverInfo, setServerInfo] = useState({
    supportedModels: [],
    device: '',
    memoryUsage: {}
  });
  
  // 사용자 입력
  const [textInput, setTextInput] = useState('안녕하세요, 테스트 음성입니다.');
  const [selectedModel, setSelectedModel] = useState('Zyphra/Zonos-v0.1-transformer');
  const [audioSettings, setAudioSettings] = useState({
    language: 'ko',
    pitch_std: 20.0,
    speaking_rate: 15.0,
    emotion: [0.3077, 0.0256, 0.0256, 0.0256, 0.0256, 0.0256, 0.2564, 0.3077]
  });
  
  // WebSocket 및 오디오 관련
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  
  // WebSocket 연결 함수
  const connectWebSocket = useCallback(() => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wsUrl = `ws://localhost:8000/ws/tts/${clientId}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('연결됨');
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // 바이너리 오디오 데이터 처리
          await handleAudioChunk(event.data);
        } else {
          // JSON 메시지 처리
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('연결 끊김');
        console.log('WebSocket disconnected');
      };
      
      wsRef.current.onerror = (error) => {
        setConnectionStatus('연결 오류');
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('연결 실패');
    }
  }, []);
  
  // WebSocket 메시지 처리
  const handleWebSocketMessage = (message) => {
    console.log('Received message:', message);
    
    switch (message.type) {
      case 'connection_established':
        setServerInfo({
          supportedModels: message.server_info.supported_models || [],
          device: message.server_info.device || '',
          memoryUsage: message.server_info.memory_info || {}
        });
        break;
        
      case 'model_loading_progress':
        setModelLoadingStatus({
          isLoading: true,
          progress: message.progress,
          status: message.status,
          model: message.model,
          error: null
        });
        break;
        
      case 'model_loading_complete':
        setModelLoadingStatus({
          isLoading: false,
          progress: 100,
          status: '모델 로드 완료',
          model: message.model,
          error: null
        });
        setServerInfo(prev => ({
          ...prev,
          memoryUsage: message.memory_usage || {}
        }));
        break;
        
      case 'model_loading_error':
        setModelLoadingStatus({
          isLoading: false,
          progress: 0,
          status: '모델 로드 실패',
          model: message.model,
          error: message.error
        });
        break;
        
      case 'generation_started':
        setTtsStatus({
          isGenerating: true,
          progress: 0,
          step: 0,
          totalSteps: 0,
          estimatedTimeRemaining: message.estimated_duration || 0,
          text: message.text,
          latency: 0,
          rtf: 0
        });
        break;
        
      case 'generation_progress':
        setTtsStatus(prev => ({
          ...prev,
          progress: message.progress,
          step: message.step,
          totalSteps: message.total_steps,
          estimatedTimeRemaining: message.estimated_time_remaining || 0
        }));
        break;
        
      case 'generation_metadata':
        setTtsStatus(prev => ({
          ...prev,
          latency: message.generation_time,
          rtf: message.rtf
        }));
        break;
        
      case 'generation_complete':
        setTtsStatus(prev => ({
          ...prev,
          isGenerating: false,
          progress: 100
        }));
        break;
        
      case 'generation_error':
        setTtsStatus(prev => ({
          ...prev,
          isGenerating: false,
          progress: 0
        }));
        alert(`TTS 생성 오류: ${message.error}`);
        break;
        
      case 'error':
        console.error('Server error:', message.error);
        alert(`서버 오류: ${message.error}`);
        break;
        
      case 'pong':
        // Heartbeat 응답
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };
  
  // 오디오 청크 처리
  const handleAudioChunk = async (blob) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const arrayBuffer = await blob.arrayBuffer();
      
      // PCM 16-bit 데이터를 Float32Array로 변환
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768; // 16-bit 정수를 -1~1 범위로 변환
      }
      
      // AudioBuffer 생성
      const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000); // 24kHz
      audioBuffer.copyToChannel(float32Array, 0);
      
      audioQueueRef.current.push(audioBuffer);
      
      if (!isPlayingRef.current) {
        playNextAudioChunk();
      }
    } catch (error) {
      console.error('Failed to process audio chunk:', error);
    }
  };
  
  // 오디오 재생
  const playNextAudioChunk = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    
    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift();
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      playNextAudioChunk();
    };
    
    source.start();
  };
  
  // TTS 생성 요청
  const handleGenerateTTS = () => {
    if (!isConnected || !textInput.trim()) {
      alert('WebSocket이 연결되지 않았거나 텍스트가 비어있습니다.');
      return;
    }
    
    const request = {
      text: textInput,
      model: selectedModel,
      language: audioSettings.language,
      format: 'pcm',
      pitch_std: audioSettings.pitch_std,
      speaking_rate: audioSettings.speaking_rate,
      emotion: audioSettings.emotion,
      randomize_seed: true
    };
    
    wsRef.current.send(JSON.stringify(request));
  };
  
  // TTS 중지
  const handleStopTTS = () => {
    if (isConnected) {
      wsRef.current.send('stop');
    }
    
    // 오디오 큐 정리
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    setTtsStatus(prev => ({
      ...prev,
      isGenerating: false
    }));
  };
  
  // 모델 미리 로드
  const handlePreloadModel = async (modelName) => {
    try {
      const response = await fetch(`http://localhost:8000/api/tts/preload?model_name=${modelName}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to preload model: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Model preloaded:', result);
    } catch (error) {
      console.error('Failed to preload model:', error);
      alert(`모델 로드 실패: ${error.message}`);
    }
  };
  
  // 컴포넌트 마운트 시 WebSocket 연결
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [connectWebSocket]);
  
  // Heartbeat 전송
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && wsRef.current) {
        wsRef.current.send('ping');
      }
    }, 30000); // 30초마다
    
    return () => clearInterval(interval);
  }, [isConnected]);
  
  return (
    <div className="tts-progress-container">
      <h2>Zonos TTS 실시간 음성 생성</h2>
      
      {/* 연결 상태 */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="status-indicator"></div>
        <span>{connectionStatus}</span>
        {!isConnected && (
          <button onClick={connectWebSocket} className="reconnect-btn">
            재연결
          </button>
        )}
      </div>
      
      {/* 서버 정보 */}
      {isConnected && (
        <div className="server-info">
          <h3>서버 정보</h3>
          <p><strong>장치:</strong> {serverInfo.device}</p>
          {serverInfo.memoryUsage.gpu_allocated && (
            <p><strong>GPU 메모리:</strong> {serverInfo.memoryUsage.gpu_allocated.toFixed(2)}GB / {serverInfo.memoryUsage.gpu_total.toFixed(2)}GB</p>
          )}
        </div>
      )}
      
      {/* 모델 로딩 상태 */}
      {modelLoadingStatus.isLoading && (
        <div className="model-loading">
          <h3>모델 로딩 중...</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${modelLoadingStatus.progress}%` }}
            ></div>
          </div>
          <p>{modelLoadingStatus.status} ({modelLoadingStatus.progress.toFixed(1)}%)</p>
          <p><strong>모델:</strong> {modelLoadingStatus.model}</p>
        </div>
      )}
      
      {modelLoadingStatus.error && (
        <div className="error-message">
          <h3>모델 로딩 오류</h3>
          <p>{modelLoadingStatus.error}</p>
        </div>
      )}
      
      {/* TTS 설정 */}
      <div className="tts-controls">
        <h3>TTS 설정</h3>
        
        <div className="input-group">
          <label>모델 선택:</label>
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={!isConnected}
          >
            {serverInfo.supportedModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <button 
            onClick={() => handlePreloadModel(selectedModel)}
            disabled={!isConnected}
            className="preload-btn"
          >
            미리 로드
          </button>
        </div>
        
        <div className="input-group">
          <label>텍스트:</label>
          <textarea 
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="생성할 음성 텍스트를 입력하세요..."
            disabled={!isConnected}
            rows={3}
          />
        </div>
        
        <div className="input-row">
          <div className="input-group">
            <label>언어:</label>
            <select 
              value={audioSettings.language}
              onChange={(e) => setAudioSettings(prev => ({...prev, language: e.target.value}))}
              disabled={!isConnected}
            >
              <option value="ko">한국어</option>
              <option value="en-us">영어</option>
            </select>
          </div>
          
          <div className="input-group">
            <label>음조 변화 (0-100):</label>
            <input 
              type="range"
              min="0"
              max="100"
              value={audioSettings.pitch_std}
              onChange={(e) => setAudioSettings(prev => ({...prev, pitch_std: parseFloat(e.target.value)}))}
              disabled={!isConnected}
            />
            <span>{audioSettings.pitch_std}</span>
          </div>
          
          <div className="input-group">
            <label>말하기 속도 (5-30):</label>
            <input 
              type="range"
              min="5"
              max="30"
              value={audioSettings.speaking_rate}
              onChange={(e) => setAudioSettings(prev => ({...prev, speaking_rate: parseFloat(e.target.value)}))}
              disabled={!isConnected}
            />
            <span>{audioSettings.speaking_rate}</span>
          </div>
        </div>
        
        <div className="control-buttons">
          <button 
            onClick={handleGenerateTTS}
            disabled={!isConnected || ttsStatus.isGenerating || !textInput.trim()}
            className="generate-btn"
          >
            {ttsStatus.isGenerating ? '생성 중...' : '음성 생성'}
          </button>
          
          {ttsStatus.isGenerating && (
            <button 
              onClick={handleStopTTS}
              className="stop-btn"
            >
              중지
            </button>
          )}
        </div>
      </div>
      
      {/* TTS 생성 진행률 */}
      {ttsStatus.isGenerating && (
        <div className="tts-progress">
          <h3>음성 생성 중...</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill tts-progress-fill"
              style={{ width: `${ttsStatus.progress}%` }}
            ></div>
          </div>
          <div className="progress-info">
            <p>진행률: {ttsStatus.progress.toFixed(1)}%</p>
            {ttsStatus.totalSteps > 0 && (
              <p>단계: {ttsStatus.step} / {ttsStatus.totalSteps}</p>
            )}
            {ttsStatus.estimatedTimeRemaining > 0 && (
              <p>예상 남은 시간: {ttsStatus.estimatedTimeRemaining.toFixed(1)}초</p>
            )}
          </div>
          <p className="generating-text">"{ttsStatus.text}"</p>
        </div>
      )}
      
      {/* TTS 완료 정보 */}
      {ttsStatus.latency > 0 && !ttsStatus.isGenerating && (
        <div className="tts-results">
          <h3>생성 완료</h3>
          <div className="result-metrics">
            <p><strong>지연시간:</strong> {(ttsStatus.latency * 1000).toFixed(0)}ms</p>
            <p><strong>실시간 배율:</strong> {ttsStatus.rtf.toFixed(2)}x</p>
            <p className={ttsStatus.latency < 0.8 ? 'metric-good' : 'metric-warning'}>
              {ttsStatus.latency < 0.8 ? '✓ 목표 지연시간 달성 (<800ms)' : '⚠ 목표 지연시간 초과 (>800ms)'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TTSProgressComponent;