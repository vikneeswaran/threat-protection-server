@echo off
setlocal
set SCRIPT_DIR=%~dp0
set HELPER=%SCRIPT_DIR%install-helper.ps1

echo Kuamini Security Client - Windows Installer
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%HELPER%' -ErrorAction SilentlyContinue; & '%HELPER%' %*"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Installer exited with error code %ERRORLEVEL%.
  echo.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo Installation completed.
echo.
pause
endlocal
