@echo off
echo =====================================
echo  Zonos 백엔드 서버 시작
echo =====================================
echo.

cd /d "%~dp0\..\Zonos"

echo 가상환경 활성화 중...
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo 가상환경 활성화 완료!
) else (
    echo 경고: 가상환경을 찾을 수 없습니다.
    echo .venv 폴더가 존재하는지 확인해주세요.
    pause
    exit /b 1
)

echo.
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
echo FastAPI 서버 시작 중...
echo 서버 주소: http://localhost:8000
echo 중지하려면 Ctrl+C를 누르세요.
echo.

python main.py

pause
