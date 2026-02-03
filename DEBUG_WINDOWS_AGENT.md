# Windows Agent Debug Guide

## Installation Status Check
Run these commands to diagnose the current situation:

### 1. Check if Agent Process is Running
```powershell
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
```
**Expected:** Process should be listed. If nothing shows, the agent isn't running.

### 2. Check Installation Directory
```powershell
Get-ChildItem "C:\Program Files (x86)\Kuamini Security Client\" -Recurse | Select-Object FullName | Format-List
```
**Expected:** Should show files including KuaminiSecurityClient.exe and config.json

### 3. Check Configuration File
```powershell
if (Test-Path "C:\Program Files (x86)\Kuamini Security Client\config.json") {
  Get-Content "C:\Program Files (x86)\Kuamini Security Client\config.json" | ConvertFrom-Json | Format-List
} else {
  Write-Host "config.json not found"
}
```
**Expected:** Should display account_id, agent_id, registration_token, and other settings

### 4. Check for Log Files
```powershell
# Find the most recent log file
$logDir = "$env:LOCALAPPDATA\KuaminiSecurityClient"
if (Test-Path $logDir) {
  Get-ChildItem $logDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | Format-List FullName, LastWriteTime, Length
  
  # Show last 50 lines of most recent log
  $latestLog = Get-ChildItem $logDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latestLog) {
    Write-Host "`nLatest log file contents (last 50 lines):`n"
    Get-Content $latestLog.FullName -Tail 50
  }
} else {
  Write-Host "Log directory not found at $logDir"
}
```
**Expected:** Should show log files with recent timestamps and agent activity

### 5. Check Windows Services
```powershell
Get-Service -DisplayName "*Kuamini*" -ErrorAction SilentlyContinue | Format-List DisplayName, Status, StartType
```
**Expected:** If a service is registered, should show status and startup type

### 6. Check Windows Firewall Rules
```powershell
Get-NetFirewallRule -DisplayName "*Kuamini*" -ErrorAction SilentlyContinue | Format-List DisplayName, Enabled, Direction
```
**Expected:** May or may not exist depending on agent design

### 7. Try Running Agent Manually
```powershell
# First, kill any existing process
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue | Stop-Process -Force

# Run agent directly to see output
& "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
```
**Watch for:** Any error messages, exceptions, or warnings that appear in the terminal

After running, check if:
- Process started without errors
- Tray icon appears
- Check logs again for new entries

### 8. Check Token Registration File
```powershell
# Check if registration token was passed and stored
$appDir = "C:\Program Files (x86)\Kuamini Security Client"
$tokenFile = "$appDir\registration.token"
$tokenFile2 = "$appDir\registration_token.txt"

if (Test-Path $tokenFile) {
  Write-Host "Found registration.token"
  Get-Content $tokenFile
}
if (Test-Path $tokenFile2) {
  Write-Host "Found registration_token.txt"
  Get-Content $tokenFile2
}
if (-not (Test-Path $tokenFile) -and -not (Test-Path $tokenFile2)) {
  Write-Host "No registration token files found"
}
```
**Expected:** Should show the registration token if installation passed it

### 9. Check Event Viewer for Errors
```powershell
# Get Application events from last 24 hours
Get-EventLog -LogName Application -After (Get-Date).AddHours(-24) -Source "*Kuamini*" -ErrorAction SilentlyContinue | Format-List TimeGenerated, EntryType, Message

# Alternative: Get latest errors from System log
Get-EventLog -LogName System -After (Get-Date).AddHours(-24) -ErrorAction SilentlyContinue | Where-Object { $_.Message -like "*Kuamini*" } | Format-List TimeGenerated, EntryType, Message
```
**Expected:** May show errors if the service crashed or had issues

### 10. Check If Old Installation Artifacts Remain
```powershell
# Check if old installation paths exist
@(
  "C:\Program Files\Kuamini Security Client",
  "$env:LOCALAPPDATA\Kuamini",
  "$env:ProgramData\Kuamini"
) | ForEach-Object {
  if (Test-Path $_) {
    Write-Host "Found legacy path: $_"
    Get-ChildItem $_ -Recurse | Select-Object FullName
  }
}
```
**Expected:** May or may not exist. If they do, they might be interfering

### 11. Check Python Runtime Issues
```powershell
# Check if embedded Python can be executed
$pythonExe = "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
if (Test-Path $pythonExe) {
  # Try to get file properties
  (Get-Item $pythonExe).VersionInfo | Format-List ProductName, ProductVersion, FileVersion
  
  # Check if file is signed
  Get-AuthenticodeSignature $pythonExe | Format-List Status, SignerCertificate
}
```
**Expected:** Should show executable information

## Quick Diagnostic Script

Copy and run this all-in-one diagnostic:

```powershell
Write-Host "=== KUAMINI AGENT DIAGNOSTICS ===" -ForegroundColor Cyan

# 1. Process status
$proc = Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
if ($proc) {
  Write-Host "✓ Agent process RUNNING (PID: $($proc.Id))" -ForegroundColor Green
} else {
  Write-Host "✗ Agent process NOT RUNNING" -ForegroundColor Red
}

# 2. Installation folder
$instDir = "C:\Program Files (x86)\Kuamini Security Client"
if (Test-Path $instDir) {
  $files = @(Get-ChildItem $instDir -ErrorAction SilentlyContinue).Count
  Write-Host "✓ Installation directory found ($files files)" -ForegroundColor Green
  
  if (Test-Path "$instDir\config.json") {
    Write-Host "  ✓ config.json exists" -ForegroundColor Green
  } else {
    Write-Host "  ✗ config.json MISSING" -ForegroundColor Red
  }
  
  if (Test-Path "$instDir\KuaminiSecurityClient.exe") {
    Write-Host "  ✓ Executable exists" -ForegroundColor Green
  } else {
    Write-Host "  ✗ Executable MISSING" -ForegroundColor Red
  }
} else {
  Write-Host "✗ Installation directory NOT FOUND" -ForegroundColor Red
}

# 3. Log directory
$logDir = "$env:LOCALAPPDATA\KuaminiSecurityClient"
if (Test-Path $logDir) {
  $logCount = @(Get-ChildItem $logDir -Filter "*.log" -ErrorAction SilentlyContinue).Count
  $latestLog = Get-ChildItem $logDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  
  if ($latestLog) {
    $lastModified = (Get-Date) - $latestLog.LastWriteTime
    Write-Host "✓ Log directory found ($logCount logs, latest: $($lastModified.TotalMinutes.ToString('F1')) minutes ago)" -ForegroundColor Green
    Write-Host "  Latest log: $($latestLog.Name)"
    Write-Host ""
    Write-Host "  Last 30 lines:" -ForegroundColor Yellow
    Get-Content $latestLog.FullName -Tail 30 | ForEach-Object { Write-Host "  $_" }
  } else {
    Write-Host "✓ Log directory exists but NO logs found" -ForegroundColor Yellow
  }
} else {
  Write-Host "✗ Log directory NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== END DIAGNOSTICS ===" -ForegroundColor Cyan
```

## Debugging Steps

1. **Run the Quick Diagnostic Script above first** - This will give us an overview
2. **If agent process is not running:** Run command #7 (manual execution) and share any error messages
3. **If config.json is missing:** The installer didn't embed the token properly
4. **If logs exist but recent:** Share the latest log file contents (last 100 lines)
5. **If logs don't exist:** The agent never started at all

## What We're Looking For

Based on the symptoms (folder created but no tray icon, no registration):

- **Agent not starting:** Check logs or run manually to see errors
- **Agent starting but crashing:** Check log for exceptions  
- **Agent running but tray icon not showing:** May be a GUI framework issue
- **Agent running but not registering:** Check if token was passed and log for registration errors

Run the diagnostic script and share:
1. Output of the quick diagnostic
2. If applicable, the manual run output (command #7)
3. Any error messages you see

This will help identify exactly where the issue is.
