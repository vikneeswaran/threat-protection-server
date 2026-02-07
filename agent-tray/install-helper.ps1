#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client Installer - Helper Script

This script extracts the registration token and passes it to the MSI installer.
Run this script from the extracted ZIP folder containing:
- KuaminiSecurityClient-1.0.5.msi
- registration.token

.EXAMPLE
.\install-helper.ps1
#>

param(
    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# ============================================================================
# VALIDATE ENVIRONMENT
# ============================================================================

Write-Host "Kuamini Security Client Installer"  -ForegroundColor Green

# Check for required files
$msiPath = Join-Path $scriptPath "KuaminiSecurityClient-1.0.5.msi"
$tokenPath = Join-Path $scriptPath "registration.token"

if (!(Test-Path $msiPath)) {
    Write-Host "ERROR: MSI file not found in current directory" -ForegroundColor Red
    Write-Host "Expected: $msiPath" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $tokenPath)) {
    Write-Host "ERROR: registration.token file not found in current directory" -ForegroundColor Red
    Write-Host "Expected: $tokenPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found MSI: $(Split-Path -Leaf $msiPath)" -ForegroundColor Cyan
Write-Host "Found token: $(Split-Path -Leaf $tokenPath)" -ForegroundColor Cyan

# ============================================================================
# READ TOKEN
# ============================================================================

Write-Host "Reading registration token..." -ForegroundColor Yellow
$token = Get-Content $tokenPath -Raw
if (-not $token) {
    Write-Host "ERROR: registration.token is empty" -ForegroundColor Red
    exit 1
}

Write-Host "Token loaded (length: $($token.Length) bytes)" -ForegroundColor Cyan

# ============================================================================
# INSTALL MSI WITH TOKEN
# ============================================================================

Write-Host "Installing Kuamini Security Client..." -ForegroundColor Yellow
Write-Host ""

$tempLogFile = Join-Path $env:TEMP "kuamini-install-$(Get-Random).log"

try {
    # Create config directory early
    $configDir = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    
    # Write token to installation config directory (backup location)
    $backupTokenPath = Join-Path $configDir "registration.token"
    Set-Content -Path $backupTokenPath -Value $token -Encoding UTF8 -NoNewline
    Write-Host "Token written to: $backupTokenPath" -ForegroundColor Cyan
    
    # Run MSI with token passed as property
    $processSplat = @{
        FilePath = "msiexec.exe"
        ArgumentList = @(
            "/i", $msiPath,
            "REGISTRATIONTOKEN=`"$token`"",
            "/L*V", $tempLogFile,
            "/passive"
        )
        Wait = $true
        NoNewWindow = $false
    }
    
    $process = Start-Process @processSplat -PassThru
    $exitCode = $process.ExitCode
    
    if ($exitCode -ne 0) {
        Write-Host "MSI installation failed with exit code: $exitCode" -ForegroundColor Red
        Write-Host "Log file: $tempLogFile" -ForegroundColor Yellow
        Get-Content $tempLogFile -Tail 50 | Write-Host
        exit $exitCode
    }
    
    Write-Host "MSI installation completed successfully" -ForegroundColor Green
    
    # ============================================================================
    # VERIFY INSTALLATION
    # ============================================================================
    
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Yellow
    
    Start-Sleep -Seconds 5
    
    $installPath = "C:\Program Files\Kuamini Security Client"
    if (!(Test-Path $installPath)) {
        Write-Host "ERROR: Installation path not found: $installPath" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Installation directory exists" -ForegroundColor Cyan
    
    # Check for registration.token
    $installedTokenPath = Join-Path $installPath "registration.token"
    if (Test-Path $installedTokenPath) {
        Write-Host "Token file created in install directory" -ForegroundColor Cyan
    } else {
        Write-Host "Note: Token file not in install directory, checking backup location" -ForegroundColor Yellow
        if (Test-Path $backupTokenPath) {
            Write-Host "Token found in config directory - agent will use this" -ForegroundColor Cyan
        }
    }
    
    # Check for config
    $configPath = Join-Path $configDir "config.json"
    if (Test-Path $configPath) {
        Write-Host "Config file exists" -ForegroundColor Cyan
        $config = Get-Content $configPath | ConvertFrom-Json
        Write-Host "Account ID: $($config.account_id)" -ForegroundColor Cyan
    } else {
        Write-Host "Config not yet created (agent will create it on first run)" -ForegroundColor Cyan
    }
    
    # Check if process is running
    $process = Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Agent process is running (PID: $($process.Id))" -ForegroundColor Green
    } else {
        Write-Host "Agent process not yet started (will start automatically)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Installation completed successfully!" -ForegroundColor Green
    Write-Host "The Kuamini Security Client will start automatically." -ForegroundColor Cyan
    Write-Host "Look for the tray icon in the Windows system tray." -ForegroundColor Cyan
    
    if (!(Test-Path "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe")) {
        Write-Host ""
        Write-Host "WARNING: Executable not found. Checking logs:" -ForegroundColor Yellow
        Get-Content $tempLogFile -Tail 30 | Write-Host
    }
    
    # Clean up log
    Remove-Item $tempLogFile -Force -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full error: $_" -ForegroundColor Red
    if (Test-Path $tempLogFile) {
        Get-Content $tempLogFile -Tail 50 | Write-Host
    }
    exit 1
}

