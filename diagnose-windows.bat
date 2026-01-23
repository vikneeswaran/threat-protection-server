@echo off
REM Kuamini Security Client - Windows Diagnostic Script
REM Run this to diagnose installation and runtime issues

setlocal enabledelayedexpansion

echo.
echo ========================================
echo Kuamini Security Client Diagnostics
echo ========================================
echo.

echo === Configuration Files ===
if exist "%USERPROFILE%\.kuamini\config.json" (
    echo [OK] Config file found: %USERPROFILE%\.kuamini\config.json
    echo.
    echo Contents:
    type "%USERPROFILE%\.kuamini\config.json"
    echo.
) else (
    echo [FAIL] Config file NOT found: %USERPROFILE%\.kuamini\config.json
    echo Create this file with your registration_token
    echo.
)

echo === Log Files ===
if exist "%LOCALAPPDATA%\KuaminiSecurityClient\agent.log" (
    echo [OK] Log file found: %LOCALAPPDATA%\KuaminiSecurityClient\agent.log
    echo.
    echo Last 30 lines of log:
    powershell -Command "Get-Content '%LOCALAPPDATA%\KuaminiSecurityClient\agent.log' -Tail 30"
    echo.
) else (
    echo [FAIL] Log file NOT found: %LOCALAPPDATA%\KuaminiSecurityClient\agent.log
    echo Agent may not have run yet
    echo.
)

echo === Process Status ===
tasklist /FI "IMAGENAME eq KuaminiSecurityClient.exe" | find /I "KuaminiSecurityClient" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] KuaminiSecurityClient.exe is running
    echo.
    tasklist /FI "IMAGENAME eq KuaminiSecurityClient.exe"
) else (
    echo [FAIL] KuaminiSecurityClient.exe is NOT running
    echo Try restarting the system or reinstalling the application
)
echo.

echo === Network Connectivity ===
ping -n 1 kuaminisystems.com >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Can reach kuaminisystems.com
) else (
    echo [FAIL] Cannot reach kuaminisystems.com - check network/firewall
)
echo.

echo === Installed Version ===
where KuaminiSecurityClient.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Application found at:
    where KuaminiSecurityClient.exe
) else (
    echo [FAIL] Application not found in PATH
    if exist "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe" (
        echo [INFO] Found at: C:\Program Files\Kuamini Security Client\
    )
)
echo.

echo === Registry AutoStart ===
reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "KuaminiSecurityClient" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] AutoStart registry entry found
    reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "KuaminiSecurityClient"
) else (
    echo [FAIL] AutoStart registry entry NOT found
)
echo.

echo === Recommendations ===
echo 1. Check the log file for specific error messages
echo 2. Ensure registration_token is correct in config.json
echo 3. Verify network connectivity to kuaminisystems.com
echo 4. If process isn't running, restart your computer
echo 5. Check Windows Event Viewer for application errors
echo.

pause
