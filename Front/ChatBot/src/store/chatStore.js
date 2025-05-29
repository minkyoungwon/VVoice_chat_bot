import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  // 연결 상태
  isConnected: false,
  isConnecting: false,
  
  // 음성 상태
  isRecording: false,
  isPlaying: false,
  isSpeaking: false,
  
  // 대화 기록
  messages: [],
  currentTranscript: '',
  
  // 설정
  settings: {
    model: "Zyphra/Zonos-v0.1-transformer",
    language: "ko",
    volume: 1.0,
    autoSpeak: true,
    // 🔥 개선된 기본 설정 - 더 나은 음성 품질
    emotion: [0.6, 0.1, 0.05, 0.05, 0.1, 0.05, 0.3, 0.2], // 더 표현력 있는 감정
    fmax: 24000.0, // 더 높은 주파수로 음질 향상
    pitch_std: 35.0, // 피치 변화 증가로 자연스러움
    speaking_rate: 18.0 // 말하기 속도 개선
  },
  
  // 에러 상태
  error: null,
  
  // Actions
  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  
  setRecording: (recording) => set({ isRecording: recording }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  
  setCurrentTranscript: (transcript) => set({ currentTranscript: transcript }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      ...message
    }]
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  // 복합 액션들
  startConversation: () => {
    set({ 
      isConnecting: true, 
      error: null,
      currentTranscript: ''
    });
  },
  
  endConversation: () => {
    set({ 
      isConnected: false,
      isConnecting: false,
      isRecording: false,
      isPlaying: false,
      isSpeaking: false,
      currentTranscript: '',
      error: null
    });
  },
  
  addUserMessage: (text) => {
    const { addMessage } = get();
    addMessage({
      role: 'user',
      text: text,
      type: 'text'
    });
  },
  
  addAssistantMessage: (text) => {
    const { addMessage } = get();
    addMessage({
      role: 'assistant',
      text: text,
      type: 'text'
    });
  },
  
  addSystemMessage: (text) => {
    const { addMessage } = get();
    addMessage({
      role: 'system',
      text: text,
      type: 'system'
    });
  }
}));

export default useChatStore;
