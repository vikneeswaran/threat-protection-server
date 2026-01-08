# Kuamini Security Client Uninstaller for Windows
# Removes all traces and deregisters from console

Write-Host "🗑️  Kuamini Security Client Uninstaller" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  This script requires Administrator privileges" -ForegroundColor Yellow
    Write-Host "   Right-click and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# API base URL (default to production)
$API_BASE = if ($env:API_BASE) { $env:API_BASE } else { "https://kuaminisystems.com/api/agent" }

# Read agent_id from config if it exists
$AGENT_ID = ""
$CONFIG_FILE = "$env:APPDATA\Kuamini\config.json"
if (Test-Path $CONFIG_FILE) {
    Write-Host "📋 Found config file, reading agent_id..." -ForegroundColor Gray
    try {
        $config = Get-Content $CONFIG_FILE | ConvertFrom-Json
        $AGENT_ID = $config.agent_id
        if ($AGENT_ID) {
            Write-Host "✓ Agent ID: $AGENT_ID" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not read agent_id from config" -ForegroundColor Yellow
    }
}

# Deregister from console
if ($AGENT_ID) {
    Write-Host ""
    Write-Host "📡 Deregistering from console..." -ForegroundColor Gray
    try {
        $body = @{ agent_id = $AGENT_ID } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        Write-Host "✓ Successfully deregistered from console" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Deregister failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "   (Continuing with local cleanup...)" -ForegroundColor Gray
    }
} else {
    Write-Host "ℹ️  No agent_id found, skipping deregister" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🛑 Stopping agent..." -ForegroundColor Gray

# Stop and remove scheduled task (both old and new names)
Unregister-ScheduledTask -TaskName "KuaminiSecurityClient" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "KuaminiAgentTray" -Confirm:$false -ErrorAction SilentlyContinue

# Kill any running processes
Get-Process | Where-Object {$_.Name -like "*Kuamini*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "🗑️  Removing files..." -ForegroundColor Gray

# Remove program files (both old and new names)
Remove-Item -Recurse -Force "$env:ProgramFiles\Kuamini\SecurityClient" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:ProgramFiles\Kuamini\AgentTray" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:ProgramFiles\Kuamini" -ErrorAction SilentlyContinue

# Remove AppData (both old and new names)
Remove-Item -Recurse -Force "$env:APPDATA\Kuamini" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Kuamini" -ErrorAction SilentlyContinue

# Remove ProgramData (both old and new names)  
Remove-Item -Recurse -Force "$env:ProgramData\Kuamini" -ErrorAction SilentlyContinue

# Remove registry entries (both old and new names)
Remove-Item -Path "HKCU:\Software\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\Software\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Kuamini Security Client has been completely removed" -ForegroundColor Green
Write-Host "   All configuration, logs, and caches have been deleted" -ForegroundColor Green
Write-Host ""
pause
