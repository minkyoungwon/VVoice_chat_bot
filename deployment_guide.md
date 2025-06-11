# 무료 배포 가이드 🚀

## 방법 1: 하이브리드 배포 (추천)

### 프론트엔드 - Vercel 무료 배포

1. **GitHub에 프론트엔드 코드 푸시**
```bash
cd C:\src\zonos_train\Front\ChatBot
git init
git add .
git commit -m "Initial commit"
# GitHub 레포지토리 생성 후
git remote add origin https://github.com/yourusername/zonos-frontend.git
git push -u origin main
```

2. **Vercel 배포**
- https://vercel.com 접속
- GitHub 연동 후 레포지토리 선택
- 자동 배포됨

3. **환경 변수 설정**
```env
# vercel.json 파일 생성
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-backend-url.com/api/$1"
    },
    {
      "source": "/ws/(.*)",
      "destination": "wss://your-backend-url.com/ws/$1"
    }
  ]
}
```

### 백엔드 - Ngrok 터널링 (무료)

1. **Ngrok 설치**
```bash
# https://ngrok.com/download
# 회원가입 후 authtoken 설정
ngrok config add-authtoken your_token
```

2. **백엔드 실행 + 터널 오픈**
```bash
# 터미널 1: 백엔드 실행
cd C:\src\zonos_train\Zonos
python main.py

# 터미널 2: 터널 생성
ngrok http 8000
```

3. **프론트엔드에서 Ngrok URL 사용**
- `https://abc123.ngrok.io` 형태의 URL 획득
- Vercel 환경 변수에서 이 URL 사용

---

## 방법 2: Railway 무료 배포 (CPU 전용)

### CPU 전용 버전 생성

1. **경량화된 main.py 생성**
```python
# main_cpu.py - CPU 전용 버전
import os
os.environ["FORCE_CPU"] = "true"
os.environ["PRELOAD_DEFAULT_MODEL"] = "false"

# 기존 main.py 내용...
```

2. **Railway 배포 파일 생성**
```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "main_cpu.py"]
```

```yaml
# railway.toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "python main_cpu.py"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "never"
```

---

## 방법 3: Google Cloud Run (무료 티어)

### 컨테이너화

1. **Docker 파일 최적화**
```dockerfile
FROM python:3.10-slim

# 경량화 설정
ENV FORCE_CPU=true
ENV MIXED_PRECISION=false
ENV PRELOAD_DEFAULT_MODEL=false

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

2. **Cloud Run 배포**
```bash
# Google Cloud SDK 설치 후
gcloud run deploy zonos-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300
```

---

## 방법 4: GitHub Codespaces (개발 환경)

### .devcontainer 설정

```json
// .devcontainer/devcontainer.json
{
  "name": "Zonos Development",
  "image": "python:3.10",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "bradlc.vscode-tailwindcss"
      ]
    }
  },
  "forwardPorts": [8000, 5173],
  "postCreateCommand": "pip install -r requirements.txt && cd Front/ChatBot && npm install"
}
```

---

## 방법 5: Render.com 무료 배포

### 설정 파일

```yaml
# render.yaml
services:
  - type: web
    name: zonos-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "python main.py"
    envVars:
      - key: FORCE_CPU
        value: "true"
      - key: PORT
        value: "8000"
```

---

## 파일 저장소 해결 방안

### 무료 클라우드 스토리지 연동

1. **Firebase Storage (무료 1GB)**
```python
# firebase_storage.py
import firebase_admin
from firebase_admin import storage

def upload_voice_file(file_content, filename):
    bucket = storage.bucket()
    blob = bucket.blob(f"voices/{filename}")
    blob.upload_from_string(file_content)
    return blob.public_url
```

2. **Supabase Storage (무료 1GB)**
```python
# supabase_storage.py
from supabase import create_client

def upload_to_supabase(file_content, filename):
    supabase = create_client(url, key)
    res = supabase.storage.from_("voices").upload(filename, file_content)
    return res
```

---

## 추천 조합

### 💡 가장 현실적인 무료 배포

1. **프론트엔드**: Vercel (완전 무료)
2. **백엔드**: 로컬 PC + Ngrok (무료, 8시간 제한)
3. **파일 저장**: Firebase Storage (1GB 무료)

### 장점:
- ✅ 완전 무료
- ✅ GPU 사용 가능 (로컬)
- ✅ 외부 접근 가능
- ✅ 실시간 WebSocket 지원

### 단점:
- ❌ PC를 계속 켜두어야 함
- ❌ Ngrok 8시간 제한 (재시작 필요)
- ❌ 인터넷 속도에 따라 성능 좌우

---

## 비용 절약 팁

1. **학생이면**: GitHub Student Pack으로 무료 크레딧
2. **신규 가입**: AWS/GCP 무료 티어 1년
3. **오픈소스**: 프로젝트를 오픈소스화하면 무료 호스팅 지원

어떤 방법을 시도해보시겠어요?
