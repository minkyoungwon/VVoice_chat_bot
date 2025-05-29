@echo off
REM Zonos Frontend Start Script
REM Set UTF-8 encoding for proper display
chcp 65001 >nul

title Zonos Frontend Server

echo.
echo ================================================
echo   Zonos Real-time Voice Chat Frontend
echo ================================================

REM Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo Please download and install Node.js from: https://nodejs.org
    pause
    exit /b 1
)

REM Check npm installation
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found.
    echo npm should be installed with Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%a in ('node --version') do echo [OK] Node.js version: %%a
for /f "tokens=*" %%a in ('npm --version') do echo [OK] npm version: %%a

REM Check environment file
if not exist ".env" (
    echo [WARNING] .env file not found.
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env
        echo [OK] .env file created. Please modify the values as needed.
    ) else (
        echo [ERROR] .env.example file not found.
        pause
        exit /b 1
    )
) else (
    echo [OK] .env file found
)

REM Check package.json
if not exist "package.json" (
    echo [ERROR] package.json not found.
    echo Please run this script from the correct directory.
    pause
    exit /b 1
)

REM Install/update packages
if not exist "node_modules" (
    echo [INFO] Installing packages...
    npm install
) else (
    echo [INFO] Updating packages...
    npm install
)

if %errorlevel% neq 0 (
    echo [ERROR] Package installation failed.
    pause
    exit /b 1
)

REM Check backend server connection
echo [INFO] Checking backend server connection...
for /f "tokens=2 delims==" %%a in ('findstr VITE_API_BASE_URL .env 2^>nul') do set BACKEND_URL=%%a
if "%BACKEND_URL%"=="" set BACKEND_URL=http://localhost:8000

REM Use PowerShell to check backend (more reliable than curl on Windows)
powershell -Command "try { $response = Invoke-WebRequest -Uri '%BACKEND_URL%' -TimeoutSec 5 -UseBasicParsing; Write-Host '[OK] Backend server is running: %BACKEND_URL%' } catch { Write-Host '[WARNING] Backend server not accessible: %BACKEND_URL%'; Write-Host 'Please start the backend server first.'; Write-Host 'Run: cd ..\Zonos && start_backend.bat' }" 2>nul

echo.
echo [INFO] Starting frontend development server...
echo Access URL: http://localhost:5173
echo Press Ctrl+C to stop the server
echo ================================================

REM Start Vite development server
npm run dev

pause
