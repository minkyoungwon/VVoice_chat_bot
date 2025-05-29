@echo off
echo =====================================
echo  Zonos 프론트엔드 서버 시작
echo =====================================
echo.

cd /d "%~dp0\..\Front\ChatBot"

echo 환경 변수 확인 중...
if exist ".env" (
    echo .env 파일 발견 ✓
) else (
    echo 오류: .env 파일을 찾을 수 없습니다!
    echo .env.example을 복사해서 .env를 만들어주세요.
    pause
    exit /b 1
)

echo.
echo Node.js 의존성 확인 중...
if exist "node_modules" (
    echo node_modules 발견 ✓
) else (
    echo node_modules가 없습니다. npm install 실행 중...
    npm install
    if errorlevel 1 (
        echo npm install 실패!
        pause
        exit /b 1
    )
)

echo.
echo Vite 개발 서버 시작 중...
echo 서버 주소: http://localhost:5173
echo 중지하려면 Ctrl+C를 누르세요.
echo.

npm run dev

pause
