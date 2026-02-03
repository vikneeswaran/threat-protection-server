@echo off
REM Kuamini Security Client - Windows Installer (Batch Wrapper)
REM 
REM Usage:
REM   install-kuamini.bat <token>
REM 
REM Example:
REM   install-kuamini.bat "your-registration-token-here"
REM 
REM Or copy this one-liner and paste it in PowerShell (as Administrator):
REM   powershell -NoProfile -ExecutionPolicy Bypass -File "install-kuamini-windows-cli.ps1" -Token "your-token"

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  Kuamini Security Client - Windows Installer               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if token was provided
if "%1"=="" (
    echo ERROR: No registration token provided
    echo.
    echo Usage: install-kuamini.bat "your-registration-token"
    echo.
    echo To get your registration token:
    echo 1. Log in to https://kuaminisystems.com/securityAgent
    echo 2. Go to Installers page
    echo 3. Copy your registration token
    echo 4. Run this script again with the token
    echo.
    pause
    exit /b 1
)

REM Check for admin rights
openfiles >nul 2>&1
if errorlevel 1 (
    echo ERROR: Administrator rights required
    echo Please run Command Prompt as Administrator and try again
    pause
    exit /b 1
)

REM Get the directory of this batch file
set "SCRIPT_DIR=%~dp0"

REM Try to find the PowerShell installer script
set "PS_SCRIPT=%SCRIPT_DIR%install-kuamini-windows-cli.ps1"

if not exist "%PS_SCRIPT%" (
    REM If not in current directory, try common locations
    for %%I in (
        "%USERPROFILE%\Downloads\install-kuamini-windows-cli.ps1"
        "C:\Users\%USERNAME%\Downloads\install-kuamini-windows-cli.ps1"
    ) do (
        if exist "%%I" (
            set "PS_SCRIPT=%%I"
            goto found_script
        )
    )
    
    echo ERROR: install-kuamini-windows-cli.ps1 not found
    echo.
    echo Expected locations:
    echo   1. Same directory as this batch file: %SCRIPT_DIR%
    echo   2. Downloads folder: %USERPROFILE%\Downloads\
    echo.
    echo Please ensure both files are in the same directory
    pause
    exit /b 1
)

:found_script
echo Running installer script...
echo.

REM Run PowerShell script with the token
powershell -NoProfile -ExecutionPolicy Bypass -File "!PS_SCRIPT!" -Token "%1"

if errorlevel 1 (
    echo.
    echo Installation failed. Please check the error messages above.
    pause
    exit /b 1
) else (
    echo.
    echo Installation completed!
    pause
    exit /b 0
)
