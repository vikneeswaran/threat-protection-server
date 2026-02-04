@echo off
setlocal
set SCRIPT_DIR=%~dp0

echo Kuamini Security Client - Windows Installer
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1" %*

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
