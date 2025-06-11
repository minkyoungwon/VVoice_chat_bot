# 목소리 파일 디렉토리

이 폴더에 목소리 파일들을 추가하면 TTS에서 해당 목소리들을 사용할 수 있습니다.

## 📁 디렉토리 구조
```
assets/voices/
├── README.md                    # 이 파일
├── sample_voice_1.wav          # 여성 목소리 (한국어)
├── sample_voice_2.wav          # 남성 목소리 (한국어)
├── english_female.wav          # 여성 목소리 (영어)
└── user/                       # 사용자 업로드 목소리들
    ├── user_1234567890_my_voice.wav
    └── user_1234567891_friend.wav
```

## 🎤 지원되는 파일 형식
- `.wav` (권장)
- `.mp3` 
- `.flac`

## 📋 목소리 파일 요구사항
- **길이**: 3-30초 권장
- **품질**: 깨끗하고 잡음이 적은 음성
- **내용**: 다양한 음성 특성이 포함된 문장 (단일 단어보다는 문장이 좋음)
- **파일 크기**: 10MB 이하

## 🚀 사용 방법

### 1. 파일 직접 추가
이 폴더에 오디오 파일을 추가하고 서버를 재시작하면 자동으로 인식됩니다.

### 2. API를 통한 업로드
```bash
curl -X POST "http://localhost:8000/api/tts/upload-voice" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@your_voice.wav"
```

### 3. 웹 인터페이스를 통한 업로드
프론트엔드의 목소리 선택 UI에서 파일을 직접 업로드할 수 있습니다.

## 📞 API 사용 예시

### 목소리 목록 확인
```bash
curl http://localhost:8000/api/tts/voices
```

### WebSocket으로 특정 목소리 사용
```javascript
websocket.send(JSON.stringify({
    text: "안녕하세요, 이것은 선택된 목소리입니다.",
    voice_id: "sample_voice_1",  // 파일명에서 확장자 제거
    emotion_preset: "happy",
    enable_emotion: true
}));
```

## 🎭 목소리 + 감정 조합 예시

```javascript
// 행복한 여성 목소리
{
    text: "오늘 정말 좋은 날이네요!",
    voice_id: "sample_voice_1",
    emotion_preset: "happy",
    enable_emotion: true
}

// 슬픈 남성 목소리
{
    text: "아쉽게도 그렇게 할 수 없습니다.",
    voice_id: "sample_voice_2", 
    emotion_preset: "sad",
    enable_emotion: true
}

// 커스텀 감정 (놀라움 + 기쁨)
{
    text: "와! 정말 놀라운데요!",
    voice_id: "sample_voice_1",
    emotion: [0.3, 0.0, 0.0, 0.0, 0.5, 0.0, 0.1, 0.1],
    enable_emotion: true
}
```

## 💡 팁
1. **목소리 품질**: 조용한 환경에서 녹음된 고품질 음성을 사용하세요
2. **길이**: 너무 짧으면 특성을 파악하기 어렵고, 너무 길면 처리 시간이 오래 걸립니다
3. **언어**: 한국어 TTS에는 한국어 목소리를, 영어 TTS에는 영어 목소리를 사용하는 것이 좋습니다
4. **캐싱**: 한번 사용된 목소리는 캐시되므로 재사용 시 빠릅니다

## 🔄 캐시 관리
```bash
# 목소리 캐시 통계 확인
curl http://localhost:8000/api/tts/voice-cache/stats

# 목소리 캐시 삭제 (메모리 절약)
curl -X POST http://localhost:8000/api/tts/voice-cache/clear
```
