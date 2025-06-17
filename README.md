# 🎙️ Voice Chat System

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![React](https://img.shields.io/badge/react-18.0+-61dafb.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-009688.svg)

**실시간 음성 대화가 가능한 AI 챗봇 시스템**

[데모 보기](#demo) • [설치 가이드](#installation) • [API 문서](#api) • [기여하기](#contributing)

</div>

---

## ✨ 주요 기능

- 🎤 **실시간 음성 인식** - Whisper 기반 고정밀 STT (Speech-to-Text)
- 🧠 **AI 대화 엔진** - AI API 통하여 자연스러운 대화
- 🔊 **고품질 음성 합성** - Zonos TTS 엔진으로 실시간 음성 생성 (≈800ms)
- 🎭 **보이스 클로닝** - 사용자 맞춤 음성 생성 및 관리
- 🎛️ **VAD 제어** - Voice Activity Detection으로 자동 음성 감지 (기능 보강중)
- 💾 **대화 기록** - Firebase Firestore 기반 대화 내역 저장
- 📱 **반응형 디자인** - 모바일 및 데스크톱 최적화

## 🛠️ 기술 스택

### Frontend
- **React** + **Vite** - 빠른 개발 환경과 최적화된 빌드
- **Zustand** - 상태 관리
- **Web Audio API** - 실시간 오디오 처리
- **WebSocket** - 양방향 실시간 통신
- **Framer Motion** - 부드러운 애니메이션

### Backend
- **FastAPI** + **Uvicorn** - 비동기 웹 프레임워크
- **WebSocket** - 실시간 스트리밍
- **Whisper** - OpenAI 음성 인식 모델
- **Zonos** - Zyphra 고성능 TTS 엔진
- **DeepSeek** - 대화형 AI 모델

### Database & Infrastructure
- **Firebase Firestore** - 실시간 NoSQL 데이터베이스
- **CUDA** - GPU 가속 추론

## 🏗️ 시스템 아키텍처




## 📦 설치 및 실행

### 사전 요구사항
- **Python 3.9+** 
- **Node.js 18+**
- **CUDA 12.x+** (GPU 가속용)
- **Git LFS** (모델 파일용)

### 1️⃣ 저장소 클론
bash
git clone https://github.com/yourusername/VVoice_chat_bot.git


### 2️⃣ 백엔드 설정
bash
cd Zonos

# 가상환경 생성 및 활성화
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# 의존성 설치
pip install -e .

# 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 API 키 설정

# Firebase 인증 파일 설정
# firebase-credentials.json 파일을 프로젝트 루트에 배치

# 서버 실행
python main.py


### 3️⃣ 프론트엔드 설정

cd Front/ChatBot

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env

# 개발 서버 실행
npm run dev


### 4️⃣ 접속
- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs


## 📡 API 엔드포인트

### WebSocket
- `GET /ws/stt` - 실시간 음성 인식
- `GET /ws/tts` - 실시간 음성 합성

### HTTP
- `POST /api/gpt` - GPT 대화 생성
- `GET /api/voices` - 사용 가능한 음성 목록
- `POST /api/voices/upload` - 보이스 클로닝용 파일 업로드
- `GET /health` - 서버 상태 확인

### WebSocket 메시지 형식

#### STT WebSocket
```javascript
// 클라이언트 → 서버: PCM 바이너리 데이터
// 서버 → 클라이언트: 
{
  "transcript": "인식된 텍스트",
  "confidence": 0.95
}
```

#### TTS WebSocket
```javascript
// 클라이언트 → 서버:
{
  "text": "합성할 텍스트",
  "model": "tiny",
  "format": "pcm",
  "speaker": "custom_voice_id"
}

// 서버 → 클라이언트:
// 1. 메타데이터: { "sr": 24000, "dtype": "int16" }
// 2. PCM 바이너리 청크들...
// 3. 완료: "end"
```

## 📁 프로젝트 구조

```
zonos_ui_re/
├── 📁 Front/ChatBot/              # React 프론트엔드
│   ├── 📁 src/
│   │   ├── 📁 components/         # React 컴포넌트
│   │   ├── 📁 hooks/             # 커스텀 훅
│   │   ├── 📁 store/             # Zustand 상태 관리
│   │   └── 📁 styles/            # CSS 스타일
│   ├── package.json
│   └── vite.config.js
├── 📁 Zonos/                     # FastAPI 백엔드
│   ├── 📁 assets/zonos/          # TTS 모델 파일
│   ├── 📁 cache/                 # TTS 캐시
│   ├── main.py                   # 메인 서버
│   ├── conversation_websocket.py  # WebSocket 핸들러
│   ├── gpt_service.py            # GPT 서비스
│   ├── voice_manager.py          # 음성 관리
│   └── firebase_service.py       # Firebase 연동
├── 📁 assets/voices/             # 사용자 음성 파일
├── 📁 scripts/                   # 배포 스크립트
└── README.md
```

## 🚀 성능 최적화

- **병렬 처리**: STT-GPT-TTS 파이프라인 최적화
- **TTS 캐싱**: 자주 사용되는 문장 사전 합성
- **WebSocket 스트리밍**: 실시간 청크 단위 전송
- **GPU 가속**: CUDA를 활용한 모델 추론 가속화
- **Progressive Loading**: 점진적 컨텐츠 로딩

## 🎯 로드맵

### v2.2.0 (계획 중)
- [ ] 실시간 번역 기능
- [ ] 음성 품질 향상
- [ ] 클라우드 배포 최적화
- [ ] API Rate Limiting

최근 주요 업데이트:
- ✅ 보이스 클로닝 기능 구현 완료
- ✅ WebSocket 프록시 설정 문제 해결
- ✅ UI/UX 전면 개선 (화이트 & 블랙 테마)
- ✅ 실시간 로딩 프로그래스바 추가
- ✅ VAD 기능 구현

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [`LICENSE`](./LICENSE) 파일을 참조하세요.

---

