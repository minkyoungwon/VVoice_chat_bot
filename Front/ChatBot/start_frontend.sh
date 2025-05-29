#!/bin/bash

# Zonos 프론트엔드 실행 스크립트

echo "🚀 Zonos 실시간 음성 대화 프론트엔드 시작"
echo "=========================================="

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되지 않았습니다."
    echo "https://nodejs.org에서 Node.js를 다운로드하여 설치하세요."
    exit 1
fi

# npm 설치 확인
if ! command -v npm &> /dev/null; then
    echo "❌ npm이 설치되지 않았습니다."
    echo "Node.js와 함께 설치되어야 합니다."
    exit 1
fi

echo "✅ Node.js 버전: $(node --version)"
echo "✅ npm 버전: $(npm --version)"

# 환경 변수 파일 확인
if [ ! -f ".env" ]; then
    echo "⚠️  .env 파일이 없습니다."
    if [ -f ".env.example" ]; then
        echo "📝 .env.example에서 .env 파일을 생성합니다..."
        cp .env.example .env
        echo "✅ .env 파일이 생성되었습니다. 필요한 값들을 수정해주세요."
    else
        echo "❌ .env.example 파일도 없습니다. 환경 설정이 필요합니다."
        exit 1
    fi
else
    echo "✅ .env 파일 확인됨"
fi

# package.json 확인
if [ ! -f "package.json" ]; then
    echo "❌ package.json 파일이 없습니다. 올바른 디렉터리에서 실행하세요."
    exit 1
fi

# node_modules 확인 및 패키지 설치
if [ ! -d "node_modules" ]; then
    echo "📦 패키지가 설치되지 않았습니다. 설치를 시작합니다..."
    npm install
else
    echo "📦 기존 패키지를 확인하고 업데이트합니다..."
    npm install
fi

# 백엔드 서버 연결 확인
echo "🔗 백엔드 서버 연결 확인 중..."
BACKEND_URL=$(grep VITE_API_BASE_URL .env | cut -d '=' -f2 | tr -d '"' || echo "http://localhost:8000")

if curl -s "$BACKEND_URL" > /dev/null 2>&1; then
    echo "✅ 백엔드 서버 연결 확인됨: $BACKEND_URL"
else
    echo "⚠️  백엔드 서버에 연결할 수 없습니다: $BACKEND_URL"
    echo "백엔드 서버가 실행 중인지 확인해주세요."
    echo "백엔드 시작: cd ../Zonos && ./start_backend.sh"
fi

echo ""
echo "🎯 프론트엔드 개발 서버 시작..."
echo "접속 주소: http://localhost:5173"
echo "중단하려면 Ctrl+C를 누르세요"
echo "=========================================="

# Vite 개발 서버 실행
npm run dev
