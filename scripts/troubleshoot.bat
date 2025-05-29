@echo off
REM Zonos TTS 문제 진단 및 해결 스크립트
chcp 65001 >nul

title Zonos TTS 문제 해결 도구

echo.
echo ================================================
echo   Zonos TTS 문제 진단 및 해결 도구 v2.0
echo ================================================
echo.

set "PROJECT_ROOT=%~dp0.."
set "BACKEND_DIR=%PROJECT_ROOT%\Zonos"
set "FRONTEND_DIR=%PROJECT_ROOT%\Front\ChatBot"

:MAIN_MENU
echo.
echo 🔧 문제 해결 메뉴:
echo.
echo [1] 백엔드 의존성 문제 해결
echo [2] 프론트엔드 의존성 문제 해결
echo [3] 환경 변수 설정 확인
echo [4] CUDA/PyTorch 환경 진단
echo [5] eSpeak 설치 문제 해결
echo [6] 포트 충돌 확인 및 해결
echo [7] 모델 로딩 문제 진단
echo [8] WebSocket 연결 문제 진단
echo [9] 전체 시스템 재시작
echo [0] 종료
echo.
set /p CHOICE="선택하세요 (0-9): "

if "%CHOICE%"=="1" goto BACKEND_DEPS
if "%CHOICE%"=="2" goto FRONTEND_DEPS
if "%CHOICE%"=="3" goto ENV_CHECK
if "%CHOICE%"=="4" goto CUDA_CHECK
if "%CHOICE%"=="5" goto ESPEAK_FIX
if "%CHOICE%"=="6" goto PORT_CHECK
if "%CHOICE%"=="7" goto MODEL_DIAGNOSE
if "%CHOICE%"=="8" goto WEBSOCKET_DIAGNOSE
if "%CHOICE%"=="9" goto FULL_RESTART
if "%CHOICE%"=="0" goto END
goto MAIN_MENU

:BACKEND_DEPS
echo.
echo ================================================
echo   백엔드 의존성 문제 해결
echo ================================================
cd /d "%BACKEND_DIR%"

echo [1] 가상환경 재생성...
if exist ".venv" (
    rmdir /s /q ".venv"
    echo 기존 가상환경을 삭제했습니다.
)

python -m venv .venv
call .venv\Scripts\activate.bat

echo [2] pip 업그레이드...
python -m pip install --upgrade pip

echo [3] requirements 설치...
pip install -r requirements-fastapi.txt

echo [4] Zonos 패키지 설치...
pip install -e .

echo [5] PyTorch 설치 확인...
python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"

echo.
echo ✅ 백엔드 의존성 문제 해결 완료!
pause
goto MAIN_MENU

:FRONTEND_DEPS
echo.
echo ================================================
echo   프론트엔드 의존성 문제 해결
echo ================================================
cd /d "%FRONTEND_DIR%"

echo [1] node_modules 삭제...
if exist "node_modules" (
    rmdir /s /q "node_modules"
    echo 기존 node_modules를 삭제했습니다.
)

if exist "package-lock.json" (
    del "package-lock.json"
    echo package-lock.json을 삭제했습니다.
)

echo [2] npm 캐시 정리...
npm cache clean --force

echo [3] 의존성 재설치...
npm install

echo [4] 설치 확인...
npm list --depth=0

echo.
echo ✅ 프론트엔드 의존성 문제 해결 완료!
pause
goto MAIN_MENU

:ENV_CHECK
echo.
echo ================================================
echo   환경 변수 설정 확인
echo ================================================
cd /d "%BACKEND_DIR%"

echo [백엔드 .env 파일 확인]
if exist ".env" (
    echo ✅ .env 파일이 존재합니다.
    echo.
    echo 현재 설정:
    findstr /v "API_KEY" .env
    echo.
    echo ⚠️ API_KEY는 보안상 표시하지 않습니다.
) else (
    echo ❌ .env 파일이 없습니다.
    echo .env.example을 복사하여 생성하시겠습니까? (y/n)
    set /p CREATE_ENV=
    if /i "%CREATE_ENV%"=="y" (
        copy ".env.example" ".env"
        echo .env 파일을 생성했습니다. 설정을 확인하세요.
        notepad .env
    )
)

echo.
echo [프론트엔드 .env 파일 확인]
cd /d "%FRONTEND_DIR%"
if exist ".env" (
    echo ✅ 프론트엔드 .env 파일이 존재합니다.
    type .env
) else (
    echo ❌ 프론트엔드 .env 파일이 없습니다.
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo .env 파일을 생성했습니다.
    )
)

pause
goto MAIN_MENU

:CUDA_CHECK
echo.
echo ================================================
echo   CUDA/PyTorch 환경 진단
echo ================================================
cd /d "%BACKEND_DIR%"
call .venv\Scripts\activate.bat

echo [1] CUDA 설치 확인...
nvidia-smi 2>nul
if errorlevel 1 (
    echo ❌ NVIDIA GPU 드라이버가 설치되지 않았거나 CUDA가 없습니다.
    echo CPU 모드로 실행됩니다.
) else (
    echo ✅ NVIDIA GPU가 감지되었습니다.
)

echo.
echo [2] PyTorch CUDA 지원 확인...
python -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'CUDA version: {torch.version.cuda}')
    print(f'Device count: {torch.cuda.device_count()}')
    for i in range(torch.cuda.device_count()):
        print(f'Device {i}: {torch.cuda.get_device_name(i)}')
        print(f'Memory: {torch.cuda.get_device_properties(i).total_memory / 1024**3:.1f} GB')
else:
    print('CUDA를 사용할 수 없습니다. CPU 모드로 실행됩니다.')
"

echo.
echo [3] Zonos 모델 로딩 테스트...
python -c "
try:
    from zonos.model import Zonos
    from zonos.utils import DEFAULT_DEVICE
    print(f'Default device: {DEFAULT_DEVICE}')
    print('Zonos 모듈 import 성공!')
except Exception as e:
    print(f'Zonos 모듈 import 실패: {e}')
"

pause
goto MAIN_MENU

:ESPEAK_FIX
echo.
echo ================================================
echo   eSpeak 설치 문제 해결
echo ================================================

echo [1] eSpeak 설치 확인...
if exist "C:\Program Files\eSpeak NG\espeak-ng.exe" (
    echo ✅ eSpeak-NG가 설치되어 있습니다.
    "C:\Program Files\eSpeak NG\espeak-ng.exe" --version
) else (
    echo ❌ eSpeak-NG가 설치되지 않았습니다.
    echo.
    echo 다운로드 링크를 열겠습니까? (y/n)
    set /p OPEN_LINK=
    if /i "%OPEN_LINK%"=="y" (
        start https://github.com/espeak-ng/espeak-ng/releases/latest
        echo 다운로드 후 설치하고 이 스크립트를 다시 실행하세요.
    )
    pause
    goto MAIN_MENU
)

echo.
echo [2] 환경 변수 설정...
echo ESPEAK_NG_PATH=C:\Program Files\eSpeak NG\espeak-ng-data
echo ESPEAK_NG_LIBRARY_PATH=C:\Program Files\eSpeak NG

echo.
echo [3] 음성 테스트...
"C:\Program Files\eSpeak NG\espeak-ng.exe" -s 150 "Hello, this is a test of eSpeak"

pause
goto MAIN_MENU

:PORT_CHECK
echo.
echo ================================================
echo   포트 충돌 확인 및 해결
echo ================================================

echo [1] 포트 8000 사용 확인...
netstat -ano | findstr :8000
if errorlevel 1 (
    echo ✅ 포트 8000이 사용 가능합니다.
) else (
    echo ❌ 포트 8000이 이미 사용 중입니다.
    echo 사용 중인 프로세스를 종료하시겠습니까? (y/n)
    set /p KILL_PROCESS=
    if /i "%KILL_PROCESS%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
            taskkill /pid %%a /f
        )
    )
)

echo.
echo [2] 포트 5173 사용 확인...
netstat -ano | findstr :5173
if errorlevel 1 (
    echo ✅ 포트 5173이 사용 가능합니다.
) else (
    echo ❌ 포트 5173이 이미 사용 중입니다.
    echo 사용 중인 프로세스를 종료하시겠습니까? (y/n)
    set /p KILL_PROCESS=
    if /i "%KILL_PROCESS%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
            taskkill /pid %%a /f
        )
    )
)

pause
goto MAIN_MENU

:MODEL_DIAGNOSE
echo.
echo ================================================
echo   모델 로딩 문제 진단
echo ================================================
cd /d "%BACKEND_DIR%"
call .venv\Scripts\activate.bat

echo [1] 모델 다운로드 가능성 확인...
python -c "
from huggingface_hub import list_repo_files
try:
    files = list_repo_files('Zyphra/Zonos-v0.1-transformer')
    print('✅ Hugging Face에서 모델에 접근 가능합니다.')
    print('모델 파일:')
    for f in files[:5]:  # 처음 5개 파일만 표시
        print(f'  {f}')
    if len(files) > 5:
        print(f'  ... 총 {len(files)}개 파일')
except Exception as e:
    print(f'❌ 모델 접근 실패: {e}')
"

echo.
echo [2] 로컬 캐시 확인...
python -c "
import os
from huggingface_hub import scan_cache_dir
try:
    cache_info = scan_cache_dir()
    print(f'캐시 크기: {cache_info.size_on_disk / 1024**3:.2f} GB')
    zonos_repos = [repo for repo in cache_info.repos if 'zonos' in repo.repo_id.lower()]
    if zonos_repos:
        print('Zonos 모델 캐시 발견:')
        for repo in zonos_repos:
            print(f'  {repo.repo_id}: {repo.size_on_disk / 1024**3:.2f} GB')
    else:
        print('Zonos 모델 캐시가 없습니다.')
except Exception as e:
    print(f'캐시 확인 실패: {e}')
"

echo.
echo [3] 메모리 요구사항 확인...
python -c "
import torch
total_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3 if torch.cuda.is_available() else 0
print(f'사용 가능한 GPU 메모리: {total_memory:.1f} GB')
print()
print('모델 메모리 요구사항:')
print('  - Zonos Transformer: ~4-6 GB')
print('  - Zonos Hybrid: ~6-8 GB')
print()
if total_memory > 0:
    if total_memory >= 8:
        print('✅ 모든 모델 실행 가능')
    elif total_memory >= 4:
        print('⚠️ Transformer 모델만 실행 가능')
    else:
        print('❌ GPU 메모리 부족. CPU 실행 권장')
else:
    print('ℹ️ CPU 모드로 실행됩니다.')
"

pause
goto MAIN_MENU

:WEBSOCKET_DIAGNOSE
echo.
echo ================================================
echo   WebSocket 연결 문제 진단
echo ================================================

echo [1] 백엔드 서버 상태 확인...
curl -s http://localhost:8000/ >nul 2>&1
if errorlevel 1 (
    echo ❌ 백엔드 서버에 연결할 수 없습니다.
    echo 백엔드 서버를 시작하시겠습니까? (y/n)
    set /p START_BACKEND=
    if /i "%START_BACKEND%"=="y" (
        cd /d "%BACKEND_DIR%"
        start "Backend Debug" cmd /k "call .venv\Scripts\activate.bat && python main.py"
        echo 백엔드 서버를 시작했습니다.
    )
) else (
    echo ✅ 백엔드 서버가 응답합니다.
)

echo.
echo [2] WebSocket 엔드포인트 확인...
curl -s -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:8000/ws/tts/test 2>nul
if errorlevel 1 (
    echo ⚠️ WebSocket 엔드포인트 테스트 실패 (정상적일 수 있음)
) else (
    echo ✅ WebSocket 엔드포인트가 응답합니다.
)

echo.
echo [3] 방화벽 설정 확인...
echo Windows 방화벽에서 다음 포트가 허용되어야 합니다:
echo   - 8000 (백엔드)
echo   - 5173 (프론트엔드)
echo.
echo 방화벽 설정을 확인하시겠습니까? (y/n)
set /p CHECK_FIREWALL=
if /i "%CHECK_FIREWALL%"=="y" (
    start wf.msc
)

pause
goto MAIN_MENU

:FULL_RESTART
echo.
echo ================================================
echo   전체 시스템 재시작
echo ================================================

echo [1] 모든 관련 프로세스 종료...
taskkill /f /im "python.exe" 2>nul
taskkill /f /im "node.exe" 2>nul
echo 프로세스 정리 완료.

echo.
echo [2] 포트 정리...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    taskkill /pid %%a /f 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /pid %%a /f 2>nul
)

echo.
echo [3] 백엔드 재시작...
cd /d "%BACKEND_DIR%"
start "Zonos Backend" cmd /k "call .venv\Scripts\activate.bat && python main.py"

echo.
echo [4] 잠시 대기...
timeout /t 5 /nobreak >nul

echo.
echo [5] 프론트엔드 재시작...
cd /d "%FRONTEND_DIR%"
start "Zonos Frontend" cmd /k "npm run dev"

echo.
echo ✅ 시스템 재시작 완료!
echo 브라우저에서 http://localhost:5173 에 접속하세요.

pause
goto MAIN_MENU

:END
echo.
echo 문제 해결 도구를 종료합니다.
exit /b 0