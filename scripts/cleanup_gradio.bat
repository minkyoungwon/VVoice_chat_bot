@echo off
echo =====================================
echo  Gradio 관련 파일 정리
echo =====================================
echo.

cd /d "%~dp0\..\Zonos"

echo Gradio 관련 파일들을 정리합니다...
echo.

REM Gradio 관련 파일들 백업 후 삭제
if exist "gradio_interface.py" (
    echo gradio_interface.py 파일 정리 중...
    if not exist "backup" mkdir backup
    move "gradio_interface.py" "backup\gradio_interface.py.bak"
    echo ✓ gradio_interface.py 백업 완료
)

if exist "2、run_gradio.bat" (
    echo 2、run_gradio.bat 파일 정리 중...
    if not exist "backup" mkdir backup
    move "2、run_gradio.bat" "backup\2、run_gradio.bat.bak"
    echo ✓ 2、run_gradio.bat 백업 완료
)

if exist "2、run_gradio.ps1" (
    echo 2、run_gradio.ps1 파일 정리 중...
    if not exist "backup" mkdir backup
    move "2、run_gradio.ps1" "backup\2、run_gradio.ps1.bak"
    echo ✓ 2、run_gradio.ps1 백업 완료
)

echo.
echo =====================================
echo  Gradio 파일 정리 완료!
echo =====================================
echo.
echo 백업된 파일들은 backup 폴더에 저장되었습니다.
echo 문제가 없다면 나중에 backup 폴더를 삭제하셔도 됩니다.
echo.

pause
