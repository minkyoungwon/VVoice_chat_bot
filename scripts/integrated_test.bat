@echo off
REM Zonos TTS 시스템 통합 테스트 스크립트
chcp 65001 >nul

title Zonos TTS 통합 테스트

echo.
echo ================================================
echo   Zonos TTS 시스템 통합 테스트 v2.0
echo ================================================
echo.

REM 작업 디렉터리 설정
set "PROJECT_ROOT=%~dp0.."
set "BACKEND_DIR=%PROJECT_ROOT%\Zonos"
set "FRONTEND_DIR=%PROJECT_ROOT%\Front\ChatBot"

echo [단계 1] 환경 확인 중...
echo.

REM Python 환경 확인
echo Python 버전 확인:
python --version
if errorlevel 1 (
    echo [오류] Python이 설치되지 않았습니다.
    pause
    exit /b 1
)

REM Node.js 환경 확인
echo.
echo Node.js 버전 확인:
node --version
if errorlevel 1 (
    echo [오류] Node.js가 설치되지 않았습니다.
    pause
    exit /b 1
)

echo.
echo [단계 2] 백엔드 환경 확인 중...
cd /d "%BACKEND_DIR%"

REM 가상환경 확인
if not exist ".venv" (
    echo [오류] Python 가상환경이 없습니다.
    echo 가상환경을 생성하시겠습니까? (y/n)
    set /p CREATE_VENV=
    if /i "%CREATE_VENV%"=="y" (
        echo 가상환경 생성 중...
        python -m venv .venv
        call .venv\Scripts\activate.bat
        pip install -r requirements-fastapi.txt
    ) else (
        echo 테스트를 중단합니다.
        pause
        exit /b 1
    )
) else (
    echo [OK] 가상환경이 존재합니다.
    call .venv\Scripts\activate.bat
)

REM .env 파일 확인
if not exist ".env" (
    echo [경고] .env 파일이 없습니다.
    copy ".env.example" ".env"
    echo .env.example을 복사했습니다. 필요한 설정을 확인하세요.
)

REM CUDA 확인
echo.
echo CUDA 환경 확인:
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"CPU\"}')" 2>nul

REM eSpeak 확인
echo.
echo eSpeak 설치 확인:
if exist "C:\Program Files\eSpeak NG\espeak-ng.exe" (
    echo [OK] eSpeak-NG가 설치되어 있습니다.
) else (
    echo [경고] eSpeak-NG가 설치되지 않았습니다.
    echo 다운로드 URL: https://github.com/espeak-ng/espeak-ng/releases
)

echo.
echo [단계 3] 프론트엔드 환경 확인 중...
cd /d "%FRONTEND_DIR%"

REM Node 모듈 확인
if not exist "node_modules" (
    echo [정보] Node.js 의존성을 설치합니다...
    npm install
    if errorlevel 1 (
        echo [오류] npm install 실패
        pause
        exit /b 1
    )
) else (
    echo [OK] Node.js 의존성이 설치되어 있습니다.
)

echo.
echo [단계 4] 백엔드 서버 시작...
cd /d "%BACKEND_DIR%"

REM 백엔드 서버를 백그라운드에서 시작
echo 백엔드 서버를 시작합니다...
start "Zonos Backend" cmd /c "call .venv\Scripts\activate.bat && python main.py"

REM 서버 시작 대기
echo 서버 시작을 기다리는 중...
timeout /t 10 /nobreak >nul

REM 서버 상태 확인
echo.
echo 서버 상태 확인:
curl -s http://localhost:8000/ >nul 2>&1
if errorlevel 1 (
    echo [경고] 백엔드 서버 연결 실패. 더 기다려보겠습니다...
    timeout /t 10 /nobreak >nul
    curl -s http://localhost:8000/ >nul 2>&1
    if errorlevel 1 (
        echo [오류] 백엔드 서버에 연결할 수 없습니다.
        echo 수동으로 백엔드 서버를 확인하세요.
    ) else (
        echo [OK] 백엔드 서버가 실행 중입니다.
    )
) else (
    echo [OK] 백엔드 서버가 실행 중입니다.
)

echo.
echo [단계 5] 프론트엔드 서버 시작...
cd /d "%FRONTEND_DIR%"

echo 프론트엔드 서버를 시작합니다...
start "Zonos Frontend" cmd /c "npm run dev"

echo.
echo ================================================
echo   테스트 시작 완료!
echo ================================================
echo.
echo 🌐 프론트엔드: http://localhost:5173
echo 🔧 백엔드 API: http://localhost:8000
echo 📚 API 문서: http://localhost:8000/docs
echo.
echo 📋 테스트 가이드:
echo 1. 브라우저에서 http://localhost:5173 접속
echo 2. "TTS 테스트" 탭 클릭
echo 3. WebSocket 연결 확인 (녹색 상태)
echo 4. 텍스트 입력 후 "음성 생성" 버튼 클릭
echo 5. 모델 로딩 진행률 확인
echo 6. 음성 생성 진행률 확인
echo 7. 음성 재생 확인
echo 8. 지연시간 800ms 미만 달성 여부 확인
echo.
echo ⚠️  테스트 완료 후 두 창 모두 닫아주세요.
echo.

pause