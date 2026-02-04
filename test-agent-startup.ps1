#Requires -Version 5.1
<#
.SYNOPSIS
Test agent startup and identify startup failures
#>

Write-Host "`n====== TESTING AGENT STARTUP ======`n" -ForegroundColor Cyan

# Find the executable
$exePaths = @(
    "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe",
    "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
)

$exePath = $null
foreach ($path in $exePaths) {
    if (Test-Path $path) {
        Write-Host "Found executable: $path" -ForegroundColor Green
        $exePath = $path
        break
    }
}

if (-not $exePath) {
    Write-Host "[ERROR] Executable not found" -ForegroundColor Red
    exit 1
}

# Check config exists
$configFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Config file not found at $configFile" -ForegroundColor Red
    exit 1
}

Write-Host "Config file exists: $configFile`n" -ForegroundColor Green

# Stop any existing process
Write-Host "[STEP 1] Stopping any existing agent processes" -ForegroundColor Yellow
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Attempt to start
Write-Host "[STEP 2] Starting agent process" -ForegroundColor Yellow
Write-Host "  Command: & `'$exePath`'" -ForegroundColor Gray

try {
    $process = Start-Process -FilePath $exePath -PassThru -NoNewWindow -ErrorAction Stop
    Write-Host "  Process started: YES" -ForegroundColor Green
    Write-Host "  Process ID: $($process.Id)" -ForegroundColor Gray
    
    # Wait a moment for process to settle
    Start-Sleep -Seconds 2
}
catch {
    Write-Host "  Process start failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check if process is still running
Write-Host "`n[STEP 3] Checking if agent process is still running" -ForegroundColor Yellow
$running = Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "  Process running: YES" -ForegroundColor Green
    Write-Host "  Process details:" -ForegroundColor Gray
    $running | Select-Object Id, ProcessName, Handles, WorkingSet | Format-Table -AutoSize | ForEach-Object { Write-Host "    $_" }
}
else {
    Write-Host "  Process running: NO - AGENT CRASHED OR EXITED!" -ForegroundColor Red
}

# Check for agent log
Write-Host "`n[STEP 4] Checking for agent log file" -ForegroundColor Yellow
$logFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
if (Test-Path $logFile) {
    Write-Host "  Log file exists: YES" -ForegroundColor Green
    Write-Host "  Recent log content:" -ForegroundColor Gray
    Get-Content $logFile -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
}
else {
    Write-Host "  Log file exists: NO" -ForegroundColor Yellow
    Write-Host "  (Agent may not have started or logs not enabled)" -ForegroundColor Gray
}

# Check for Python errors
Write-Host "`n[STEP 5] Checking for Python issues" -ForegroundColor Yellow

# Try to run the exe with Python to see if there are import errors
Write-Host "  Attempting to detect Python/dependency issues..." -ForegroundColor Gray

# Check if PyInstaller executable can even load
$exeDir = Split-Path -Parent $exePath
$dllFiles = Get-ChildItem "$exeDir\*.dll" -ErrorAction SilentlyContinue
if ($dllFiles) {
    Write-Host "  DLL files found in install directory: $($dllFiles.Count)" -ForegroundColor Green
}
else {
    Write-Host "  WARNING: No DLL files found in install directory" -ForegroundColor Yellow
}

# Try to get process details
if ($running) {
    Write-Host "`n[STEP 6] Getting process memory and handle details" -ForegroundColor Yellow
    $running | Get-Process | ForEach-Object {
        Write-Host "  Memory: $([Math]::Round($_.WorkingSet / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "  Handles: $($_.Handles)" -ForegroundColor Gray
        Write-Host "  Threads: $($_.Threads.Count)" -ForegroundColor Gray
    }
}

# Final status
Write-Host "`n====== STATUS ======`n" -ForegroundColor Cyan

if ($running) {
    Write-Host "RESULT: Agent is running" -ForegroundColor Green
    Write-Host "`nYour agent startup is working! Issues are likely:" -ForegroundColor Yellow
    Write-Host "  1. Agent can't register (check network/API)" -ForegroundColor Gray
    Write-Host "  2. Agent registers but no systray (check pystray)" -ForegroundColor Gray
    Write-Host "  3. Check console for registration status" -ForegroundColor Gray
}
else {
    Write-Host "RESULT: Agent failed to start or crashed" -ForegroundColor Red
    Write-Host "`nDEBUGGING STEPS:" -ForegroundColor Yellow
    Write-Host "  1. Open Command Prompt as Administrator" -ForegroundColor Gray
    Write-Host "  2. Run: $exePath" -ForegroundColor Gray
    Write-Host "  3. Watch for error messages" -ForegroundColor Gray
    Write-Host "  4. Check startup logs at: $logFile" -ForegroundColor Gray
}

Write-Host "`n"
