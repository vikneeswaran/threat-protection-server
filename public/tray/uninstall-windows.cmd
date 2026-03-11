@echo off
setlocal
set SCRIPT_DIR=%~dp0
set UNINSTALLER=%SCRIPT_DIR%uninstall-kuamini-windows.ps1

echo Kuamini Security Client - Windows Uninstaller
echo.

if not exist "%UNINSTALLER%" (
  echo ERROR: uninstall-kuamini-windows.ps1 not found.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%UNINSTALLER%' -ErrorAction SilentlyContinue; & '%UNINSTALLER%' %*"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Uninstaller exited with error code %ERRORLEVEL%.
  echo.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo Uninstall completed.
echo.
pause
endlocal
