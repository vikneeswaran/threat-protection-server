#Requires -Version 5.1
<#
.SYNOPSIS
Decode and validate the registration token
#>

Write-Host "`n====== TOKEN VALIDATION ======`n" -ForegroundColor Cyan

$token = "eyJhY2NvdW50SWQiOiJjOTNmNDcyNC0zNzI3LTRhYjEtYjgzYy1hMGE5NDJhYzkyMGUiLCJhY2NvdW50TmFtZSI6IlRlc3RDbyIsInRpbWVzdGFtcCI6MTc3MDIwODgzMDExNH0="

# Step 1: Decode token
Write-Host "[STEP 1] Decoding token" -ForegroundColor Yellow
Write-Host "  Token length: $($token.Length)" -ForegroundColor Gray

try {
    $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($token))
    Write-Host "  Decoded successfully" -ForegroundColor Green
    Write-Host "  Content: $decoded" -ForegroundColor Gray
    
    # Parse JSON
    $tokenObj = $decoded | ConvertFrom-Json
    Write-Host "`n[STEP 2] Token contents:" -ForegroundColor Yellow
    Write-Host "  accountId: $($tokenObj.accountId)" -ForegroundColor Gray
    Write-Host "  accountName: $($tokenObj.accountName)" -ForegroundColor Gray
    Write-Host "  timestamp: $($tokenObj.timestamp)" -ForegroundColor Gray
}
catch {
    Write-Host "  Decoding failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Test what the agent sees
Write-Host "`n[STEP 3] Checking what agent will see in config.json" -ForegroundColor Yellow

$configFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
if (Test-Path $configFile) {
    $config = Get-Content $configFile | ConvertFrom-Json
    Write-Host "  Config registration_token: $($config.registration_token)" -ForegroundColor Gray
    Write-Host "  Token matches: $(if ($config.registration_token -eq $token) { 'YES' } else { 'NO' })" -ForegroundColor Gray
    
    Write-Host "  Config account_id: $($config.account_id)" -ForegroundColor Gray
}

# Step 4: Check agent log for this specific token
Write-Host "`n[STEP 4] Checking agent log for token-related errors" -ForegroundColor Yellow

$logFile = "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
if (Test-Path $logFile) {
    Write-Host "  Looking for registration errors..." -ForegroundColor Gray
    $errorLines = @(Get-Content $logFile | Where-Object { $_ -match "Invalid token|decode account_id|Registration.*400|HTTP 400" })
    
    if ($errorLines.Count -gt 0) {
        Write-Host "  Found $($errorLines.Count) error lines:" -ForegroundColor Yellow
        $errorLines | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "  No recent token errors found" -ForegroundColor Green
    }
}

Write-Host "`n====== NEXT STEPS ======`n" -ForegroundColor Cyan
Write-Host "1. Update config.json with this token" -ForegroundColor Yellow
Write-Host "2. Restart the agent" -ForegroundColor Yellow
Write-Host "3. Check if registration succeeds" -ForegroundColor Yellow

Write-Host "`n"
