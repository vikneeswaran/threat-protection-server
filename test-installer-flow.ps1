#Requires -Version 5.1
<#
.SYNOPSIS
Test installer flow with step-by-step logging
#>

param(
    [string]$Token = "test_token_for_testing"
)

Write-Host "`n====== TESTING INSTALLER FLOW ======`n" -ForegroundColor Cyan

# Configuration
$CONFIG_DIR = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
$CONFIG_FILE = Join-Path $CONFIG_DIR "config.json"
$CONSOLE_URL = "https://kuaminisystems.com/securityAgent"

# Step 1: Create config directory
Write-Host "[STEP 1] Creating config directory" -ForegroundColor Yellow
Write-Host "  Target: $CONFIG_DIR" -ForegroundColor Gray

try {
    if (-not (Test-Path $CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $CONFIG_DIR -Force -ErrorAction Stop | Out-Null
    }
    Write-Host "  Result: OK" -ForegroundColor Green
}
catch {
    Write-Host "  Result: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Generate agent ID
Write-Host "`n[STEP 2] Generating agent ID" -ForegroundColor Yellow
$agentId = [guid]::NewGuid().ToString()
Write-Host "  Agent ID: $agentId" -ForegroundColor Gray

# Step 3: Create config object
Write-Host "`n[STEP 3] Creating config object" -ForegroundColor Yellow

$config = @{
    api_base           = "https://kuaminisystems.com/api/agent"
    console_url        = $CONSOLE_URL
    agent_id           = $agentId
    account_id         = "dev"
    registration_token = $Token
    heartbeat_interval = 60
    auto_register      = $true
}

Write-Host "  Config keys: $(($config.Keys -join ', '))" -ForegroundColor Gray

# Step 4: Convert to JSON
Write-Host "`n[STEP 4] Converting to JSON" -ForegroundColor Yellow
try {
    $configJson = ConvertTo-Json $config -Depth 10 -ErrorAction Stop
    Write-Host "  JSON length: $($configJson.Length) bytes" -ForegroundColor Gray
    Write-Host "  Sample: $($configJson.Substring(0, [Math]::Min(100, $configJson.Length)))..." -ForegroundColor Gray
}
catch {
    Write-Host "  Result: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Write to file (CRITICAL STEP)
Write-Host "`n[STEP 5] Writing config to file (UTF8 encoding)" -ForegroundColor Yellow
Write-Host "  File path: $CONFIG_FILE" -ForegroundColor Gray

try {
    Set-Content -Path $CONFIG_FILE -Value $configJson -Encoding UTF8 -Force -ErrorAction Stop
    Write-Host "  Set-Content: OK" -ForegroundColor Green
}
catch {
    Write-Host "  Set-Content: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 6: Verify file exists
Write-Host "`n[STEP 6] Verifying file exists" -ForegroundColor Yellow
if (Test-Path $CONFIG_FILE) {
    Write-Host "  File exists: YES" -ForegroundColor Green
} else {
    Write-Host "  File exists: NO - THIS IS THE PROBLEM!" -ForegroundColor Red
    exit 1
}

# Step 7: Check file size
Write-Host "`n[STEP 7] Checking file size" -ForegroundColor Yellow
$fileSize = (Get-Item $CONFIG_FILE).Length
Write-Host "  File size: $fileSize bytes" -ForegroundColor Gray

if ($fileSize -eq 0) {
    Write-Host "  Result: FILE IS EMPTY!" -ForegroundColor Red
    exit 1
} elseif ($fileSize -lt 100) {
    Write-Host "  Result: WARNING - File is surprisingly small" -ForegroundColor Yellow
} else {
    Write-Host "  Result: OK" -ForegroundColor Green
}

# Step 8: Read and verify JSON parsing
Write-Host "`n[STEP 8] Reading file and parsing JSON" -ForegroundColor Yellow
try {
    $readBack = Get-Content $CONFIG_FILE -Raw -ErrorAction Stop
    Write-Host "  Read length: $($readBack.Length) bytes" -ForegroundColor Gray
    
    $parsed = $readBack | ConvertFrom-Json -ErrorAction Stop
    Write-Host "  JSON parsing: SUCCESS" -ForegroundColor Green
    Write-Host "  Agent ID from file: $($parsed.agent_id)" -ForegroundColor Gray
    Write-Host "  Token from file: $($parsed.registration_token)" -ForegroundColor Gray
}
catch {
    Write-Host "  Result: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 9: Check if executable exists
Write-Host "`n[STEP 9] Checking if agent executable exists" -ForegroundColor Yellow
$exePaths = @(
    "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe",
    "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
)

$exePath = $null
foreach ($path in $exePaths) {
    if (Test-Path $path) {
        Write-Host "  Found: $path" -ForegroundColor Green
        $exePath = $path
        break
    }
}

if (-not $exePath) {
    Write-Host "  Result: Executable not found (this is expected in test environment)" -ForegroundColor Yellow
}

# Step 10: Summary
Write-Host "`n====== SUMMARY ======`n" -ForegroundColor Cyan

Write-Host "Config file: $CONFIG_FILE" -ForegroundColor Gray
if (Test-Path $CONFIG_FILE) {
    Write-Host "Status: EXISTS and is readable" -ForegroundColor Green
    $size = (Get-Item $CONFIG_FILE).Length
    Write-Host "Size: $size bytes" -ForegroundColor Gray
    
    Write-Host "`nContent:" -ForegroundColor Yellow
    Get-Content $CONFIG_FILE | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    
    Write-Host "`nCONCLUSION: Config file creation works perfectly!`n" -ForegroundColor Green
    Write-Host "If installer is still failing, the issue is:" -ForegroundColor Yellow
    Write-Host "  1. Agent executable won't start (check permissions)" -ForegroundColor Gray
    Write-Host "  2. Agent starts but crashes (check agent.log)" -ForegroundColor Gray  
    Write-Host "  3. Agent runs but can't register (check API/network)" -ForegroundColor Gray
    Write-Host "  4. Registration succeeds but no systray (check pystray)" -ForegroundColor Gray
} else {
    Write-Host "Status: DOES NOT EXIST" -ForegroundColor Red
    Write-Host "This means Set-Content silently failed!" -ForegroundColor Red
}

Write-Host "`n"
