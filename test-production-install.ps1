<#
.SYNOPSIS
Production installer test with real token
#>

param(
    [string]$Token = "eyJhY2NvdW50SWQiOiJjOTNmNDcyNC0zNzI3LTRhYjEtYjgzYy1hMGE5NDJhYzkyMGUiLCJhY2NvdW50TmFtZSI6IlRlc3RDbyIsInRpbWVzdGFtcCI6MTc3MDIwODgzMDExNH0="
)

Write-Host "`n====== PRODUCTION INSTALLER TEST ======`n" -ForegroundColor Cyan

# Configuration
$CONFIG_DIR = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
$CONFIG_FILE = Join-Path $CONFIG_DIR "config.json"
$API_BASE = "https://kuaminisystems.com/api/agent"
$CONSOLE_URL = "https://kuaminisystems.com/securityAgent"

# Step 1: Uninstall previous agent
Write-Host "[STEP 1] Uninstalling previous agent" -ForegroundColor Yellow
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
Remove-Item $CONFIG_FILE -Force -ErrorAction SilentlyContinue
Write-Host "  Previous agent removed" -ForegroundColor Green

# Step 2: Create clean config
Write-Host "`n[STEP 2] Creating new configuration with real token" -ForegroundColor Yellow
if (-not (Test-Path $CONFIG_DIR)) {
    New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
}

$agentId = [guid]::NewGuid().ToString()
$config = @{
    api_base           = $API_BASE
    console_url        = $CONSOLE_URL
    agent_id           = $agentId
    account_id         = "c93f4724-3727-4ab1-b83c-a0a942ac920e"
    registration_token = $Token
    heartbeat_interval = 60
    auto_register      = $true
}

$configJson = $config | ConvertTo-Json
Set-Content -Path $CONFIG_FILE -Value $configJson -Encoding UTF8 -Force
Write-Host "  Config created: $CONFIG_FILE" -ForegroundColor Green
Write-Host "  Agent ID: $agentId" -ForegroundColor Gray

# Step 3: Start agent
Write-Host "`n[STEP 3] Starting agent with new configuration" -ForegroundColor Yellow
$exePath = "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
if (Test-Path $exePath) {
    & $exePath
    Start-Sleep -Seconds 3
    Write-Host "  Agent started" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Executable not found at $exePath" -ForegroundColor Red
    exit 1
}

# Step 4: Monitor registration
Write-Host "`n[STEP 4] Monitoring registration (waiting up to 30 seconds)..." -ForegroundColor Yellow
$logFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
$timeout = 30
$elapsed = 0
$registered = $false

while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed += 1
    
    if (Test-Path $logFile) {
        $logContent = Get-Content $logFile -Raw
        
        if ($logContent -match "Registration response status: 200") {
            Write-Host "  ✓ Registration successful!" -ForegroundColor Green
            
            # Extract endpoint_id
            if ($logContent -match "endpoint_id") {
                Write-Host "  - Endpoint registered and persisted" -ForegroundColor Gray
            }
            $registered = $true
            break
        }
        elseif ($logContent -match "Registration response status: 400") {
            Write-Host "  ✗ Registration failed with 400 (Invalid token)" -ForegroundColor Red
            break
        }
        elseif ($logContent -match "Status changed: Online") {
            Write-Host "  ✓ Status: Online" -ForegroundColor Green
            $registered = $true
            break
        }
    }
    
    Write-Host "  Waiting... ($elapsed/$timeout seconds)" -ForegroundColor Gray
}

if (-not $registered) {
    Write-Host "  Timeout - registration not confirmed yet" -ForegroundColor Yellow
}

# Step 5: Verify process running
Write-Host "`n[STEP 5] Verifying agent process" -ForegroundColor Yellow
$proc = Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "  ✓ Agent is running (PID: $($proc.Id))" -ForegroundColor Green
    Write-Host "  Memory: $([Math]::Round($proc.WorkingSet / 1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Agent is not running" -ForegroundColor Red
}

# Step 6: Show summary
Write-Host "`n====== SUMMARY ======`n" -ForegroundColor Cyan

Write-Host "Config file: " -NoNewline
if (Test-Path $CONFIG_FILE) {
    Write-Host "✓ EXISTS" -ForegroundColor Green
} else {
    Write-Host "✗ NOT FOUND" -ForegroundColor Red
}

Write-Host "Agent process: " -NoNewline
if ($proc) {
    Write-Host "✓ RUNNING" -ForegroundColor Green
} else {
    Write-Host "✗ NOT RUNNING" -ForegroundColor Red
}

Write-Host "Registration: " -NoNewline
if ($registered) {
    Write-Host "✓ SUCCESSFUL" -ForegroundColor Green
} else {
    Write-Host "⏳ CHECKING..." -ForegroundColor Yellow
}

Write-Host "`n"
Write-Host "Last log entries:" -ForegroundColor Yellow
if (Test-Path $logFile) {
    Get-Content $logFile -Tail 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}

Write-Host "`n"
