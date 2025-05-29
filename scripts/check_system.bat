@echo off
echo =====================================
echo  Zonos 시스템 상태 체크
echo =====================================
echo.

echo [1] 디렉터리 구조 확인...
if exist "%~dp0\..\Zonos" (
    echo ✓ 백엔드 디렉터리 존재
) else (
    echo ✗ 백엔드 디렉터리 없음
)

if exist "%~dp0\..\Front\ChatBot" (
    echo ✓ 프론트엔드 디렉터리 존재
) else (
    echo ✗ 프론트엔드 디렉터리 없음
)

echo.
echo [2] 환경 변수 파일 확인...
if exist "%~dp0\..\Zonos\.env" (
    echo ✓ 백엔드 .env 파일 존재
) else (
    echo ✗ 백엔드 .env 파일 없음
)

if exist "%~dp0\..\Front\ChatBot\.env" (
    echo ✓ 프론트엔드 .env 파일 존재
) else (
    echo ✗ 프론트엔드 .env 파일 없음
)

echo.
echo [3] 가상환경 확인...
if exist "%~dp0\..\Zonos\.venv" (
    echo ✓ Python 가상환경 존재
) else (
    echo ✗ Python 가상환경 없음
)

echo.
echo [4] Node.js 의존성 확인...
if exist "%~dp0\..\Front\ChatBot\node_modules" (
    echo ✓ Node.js 의존성 설치됨
) else (
    echo ✗ Node.js 의존성 없음 (npm install 필요)
)

echo.
echo [5] 주요 파일 확인...
if exist "%~dp0\..\Zonos\main.py" (
    echo ✓ FastAPI 서버 파일 존재
) else (
    echo ✗ FastAPI 서버 파일 없음
)

if exist "%~dp0\..\Front\ChatBot\package.json" (
    echo ✓ React 프로젝트 파일 존재
) else (
    echo ✗ React 프로젝트 파일 없음
)

echo.
echo =====================================
echo  상태 체크 완료
echo =====================================
echo.

pause
