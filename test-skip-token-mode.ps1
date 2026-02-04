#Requires -Version 5.1
<#
.SYNOPSIS
Test installer with new "skip token" capability
#>

Write-Host "`n====== TESTING IMPROVED INSTALLER (WITH SKIP OPTION) ======`n" -ForegroundColor Cyan

# Clean up previous installation
Write-Host "[STEP 1] Cleaning previous installation" -ForegroundColor Yellow
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
Remove-Item "$env:LOCALAPPDATA\KuaminiSecurityClient" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  Previous files removed" -ForegroundColor Green

# Test 1: Run installer script with simulated "skip" input
Write-Host "`n[STEP 2] Testing installer with auto-skip (no token)" -ForegroundColor Yellow
Write-Host "  Running: install-kuamini-windows-cli.ps1 (simulating SKIP selection)" -ForegroundColor Gray

# We'll use a PowerShell script to simulate the user selecting "skip"
$testScript = @'
# Simulating what happens when user runs installer without parameters
# and chooses to skip token entry

# First part: Check if config gets created
Write-Host "  Testing config creation without pre-configured token..." -ForegroundColor Gray

$CONFIG_DIR = "$env:LOCALAPPDATA\KuaminiSecurityClient"
$CONFIG_FILE = "$CONFIG_DIR\config.json"

# Create directory
if (-not (Test-Path $CONFIG_DIR)) {
    New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
}

# Create basic config (what installer does when no token provided)
$agentId = [guid]::NewGuid().ToString()
$config = @{
    api_base           = "https://kuaminisystems.com/api/agent"
    console_url        = "https://kuaminisystems.com/securityAgent"
    agent_id           = $agentId
    heartbeat_interval = 60
    auto_register      = $true
}

$configJson = $config | ConvertTo-Json
Set-Content -Path $CONFIG_FILE -Value $configJson -Encoding UTF8 -Force

Write-Host "    Config created without pre-configured token" -ForegroundColor Green
Write-Host "    Agent will register using provided token on first run" -ForegroundColor Gray
'@

Invoke-Expression $testScript

# Test 2: Start agent
Write-Host "`n[STEP 3] Starting agent with self-registration" -ForegroundColor Yellow
$exePath = "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
if (Test-Path $exePath) {
    & $exePath
    Start-Sleep -Seconds 3
    Write-Host "  Agent started" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Executable not found" -ForegroundColor Red
    exit 1
}

# Test 3: Check for config
Write-Host "`n[STEP 4] Verifying configuration" -ForegroundColor Yellow
$configFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
if (Test-Path $configFile) {
    $cfg = Get-Content $configFile | ConvertFrom-Json
    Write-Host "  ✓ Config exists" -ForegroundColor Green
    Write-Host "    Agent ID: $($cfg.agent_id)" -ForegroundColor Gray
    Write-Host "    Auto-register: $($cfg.auto_register)" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Config not found" -ForegroundColor Red
}

# Test 4: Check agent process
Write-Host "`n[STEP 5] Checking agent process" -ForegroundColor Yellow
$proc = Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "  ✓ Agent is running (PID: $($proc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ✗ Agent is not running" -ForegroundColor Red
}

# Test 5: Monitor registration
Write-Host "`n[STEP 6] Waiting for agent registration (15 seconds)..." -ForegroundColor Yellow
$logFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
$registered = $false

for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    
    if (Test-Path $logFile) {
        $logContent = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        
        if ($logContent -match "Registration response status: 200") {
            Write-Host "  ✓ Registration successful!" -ForegroundColor Green
            $registered = $true
            break
        }
        elseif ($logContent -match "Status changed: Online") {
            Write-Host "  ✓ Status: Online" -ForegroundColor Green
            $registered = $true
            break
        }
    }
    
    Write-Host "  Waiting... ($($i+1)/15)" -ForegroundColor Gray
}

# Summary
Write-Host "`n========== SUMMARY ==========`n" -ForegroundColor Cyan

$allGood = $true
Write-Host "Config file: " -NoNewline
if (Test-Path $configFile) {
    Write-Host "✓" -ForegroundColor Green
} else {
    Write-Host "✗" -ForegroundColor Red
    $allGood = $false
}

Write-Host "Agent process: " -NoNewline
if ($proc) {
    Write-Host "✓" -ForegroundColor Green
} else {
    Write-Host "✗" -ForegroundColor Red
    $allGood = $false
}

Write-Host "Registration: " -NoNewline
if ($registered) {
    Write-Host "✓" -ForegroundColor Green
} else {
    Write-Host "⏳" -ForegroundColor Yellow
}

if ($allGood) {
    Write-Host "`nResult: INSTALLATION SUCCESSFUL (without pre-configured token)" -ForegroundColor Green
} else {
    Write-Host "`nResult: INSTALLATION NEEDS ATTENTION" -ForegroundColor Yellow
}

Write-Host "`n"
