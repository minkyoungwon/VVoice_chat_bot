@echo off
echo =====================================
echo  Zonos 전체 시스템 시작
echo =====================================
echo.

echo 백엔드 서버 시작 중...
start "Zonos Backend" cmd /k "call %~dp0start_backend.bat"

echo 3초 대기 중 (백엔드 서버 준비 시간)...
timeout /t 3 /nobreak > nul

echo 프론트엔드 서버 시작 중...
start "Zonos Frontend" cmd /k "call %~dp0start_frontend.bat"

echo.
echo =====================================
echo  시스템 시작 완료!
echo =====================================
echo.
echo 백엔드: http://localhost:8000
echo 프론트엔드: http://localhost:5173
echo.
echo 각 서버를 중지하려면 해당 창에서 Ctrl+C를 누르세요.
echo.

pause
