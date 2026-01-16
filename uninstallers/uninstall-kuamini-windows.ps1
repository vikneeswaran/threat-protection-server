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

# Read agent_id from config if it exists (check multiple locations)
$AGENT_ID = ""
$CONFIG_LOCATIONS = @(
    "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json",
    "$env:APPDATA\Kuamini\config.json",
    "$env:USERPROFILE\.kuamini\config.json"
)

foreach ($CONFIG_FILE in $CONFIG_LOCATIONS) {
    if (Test-Path $CONFIG_FILE) {
        Write-Host "📋 Found config file at: $CONFIG_FILE" -ForegroundColor Gray
        try {
            $config = Get-Content $CONFIG_FILE | ConvertFrom-Json
            $AGENT_ID = $config.agent_id
            if ($AGENT_ID) {
                Write-Host "✓ Agent ID: $AGENT_ID" -ForegroundColor Green
                break
            }
        } catch {
            Write-Host "⚠️  Could not read agent_id from config" -ForegroundColor Yellow
        }
    }
}

# Deregister from console
if ($AGENT_ID) {
    Write-Host ""
    Write-Host "📡 Deregistering from console..." -ForegroundColor Gray
    try {
        $body = @{ agent_id = $AGENT_ID } | ConvertTo-Json
        $null = Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
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

# Try to uninstall via MSI first (if installed via MSI)
Write-Host "   Checking for MSI installation..." -ForegroundColor Gray
$uninstallKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$kuaminiApp = Get-ItemProperty $uninstallKeys -ErrorAction SilentlyContinue | 
    Where-Object { $_.DisplayName -like "*Kuamini*Security*Client*" } |
    Select-Object -First 1

if ($kuaminiApp) {
    Write-Host "✓ Found MSI installation: $($kuaminiApp.DisplayName)" -ForegroundColor Green
    Write-Host "   Attempting to uninstall via MSI..." -ForegroundColor Gray
    
    $uninstallString = $kuaminiApp.UninstallString
    if ($uninstallString -match 'MsiExec.exe /[IX](\{[A-F0-9-]+\})') {
        $productCode = $Matches[1]
        Write-Host "   Product Code: $productCode" -ForegroundColor Gray
        
        try {
            # Silent uninstall with no reboot
            Start-Process "msiexec.exe" -ArgumentList "/x $productCode /qn /norestart" -Wait -NoNewWindow
            Write-Host "✓ MSI uninstall completed" -ForegroundColor Green
            Start-Sleep -Seconds 3
        } catch {
            Write-Host "⚠️  MSI uninstall failed: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "   Continuing with manual cleanup..." -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   No MSI installation found, proceeding with manual cleanup" -ForegroundColor Gray
}

# Remove from startup registry
Write-Host "   Removing startup entries..." -ForegroundColor Gray
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiAgentTray" -ErrorAction SilentlyContinue

# Stop and remove scheduled task (both old and new names)
Unregister-ScheduledTask -TaskName "KuaminiSecurityClient" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "KuaminiAgentTray" -Confirm:$false -ErrorAction SilentlyContinue

# Kill any running processes (more aggressively)
Write-Host "   Terminating running processes..." -ForegroundColor Gray

# First try graceful termination
Get-Process | Where-Object {$_.Name -like "*Kuamini*"} | Stop-Process -ErrorAction SilentlyContinue

# Wait for graceful shutdown
Start-Sleep -Seconds 2

# Force kill any remaining processes
Get-Process | Where-Object {$_.Name -like "*Kuamini*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Also try by exact process names
Stop-Process -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "KuaminiAgentTray" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "KuaminiAgent" -Force -ErrorAction SilentlyContinue

# Kill any Python processes running Kuamini scripts
Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*kuamini*" -or $_.CommandLine -like "*Kuamini*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait to ensure processes are fully terminated
Start-Sleep -Seconds 1

Write-Host "🗑️  Removing files..." -ForegroundColor Gray

# Remove program files (all possible installation locations)
$installPaths = @(
    "$env:ProgramFiles\KuaminiSecurityClient",
    "$env:ProgramFiles\Kuamini\SecurityClient",
    "$env:ProgramFiles\Kuamini\AgentTray",
    "$env:ProgramFiles\Kuamini",
    "${env:ProgramFiles(x86)}\KuaminiSecurityClient",
    "${env:ProgramFiles(x86)}\Kuamini"
)

foreach ($path in $installPaths) {
    if (Test-Path $path) {
        Write-Host "   Removing: $path" -ForegroundColor Gray
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    }
}

# Remove AppData and config (all possible locations)
$dataPaths = @(
    "$env:LOCALAPPDATA\KuaminiSecurityClient",
    "$env:LOCALAPPDATA\Kuamini",
    "$env:APPDATA\Kuamini",
    "$env:USERPROFILE\.kuamini",
    "$env:ProgramData\Kuamini"
)

foreach ($path in $dataPaths) {
    if (Test-Path $path) {
        Write-Host "   Removing: $path" -ForegroundColor Gray
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    }
}

# Remove registry entries (both old and new names)
Remove-Item -Path "HKCU:\Software\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\Software\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue

# Final cleanup: Restart Windows Explorer to clear tray icons
Write-Host ""
Write-Host "🔄 Clearing system tray icons..." -ForegroundColor Gray

# Stop Windows Explorer (which hosts the notification area/tray)
Write-Host "   Restarting Windows Explorer..." -ForegroundColor Gray
taskkill /F /IM explorer.exe 2>$null | Out-Null

# Wait for it to fully terminate
Start-Sleep -Seconds 2

# Restart Windows Explorer
Start-Process explorer.exe

# Wait for Explorer to fully restart and register tray changes
Start-Sleep -Seconds 3

# Check if any processes are still running
$remaining = Get-Process | Where-Object {$_.Name -like "*Kuamini*"} -ErrorAction SilentlyContinue

Write-Host ""
if ($remaining) {
    Write-Host "⚠️  Warning: Some processes may still be running:" -ForegroundColor Yellow
    $remaining | Format-Table Name, Id, Path -AutoSize
    Write-Host ""
    Write-Host "Please try:" -ForegroundColor Yellow
    Write-Host "  1. Log out and back in" -ForegroundColor Gray
    Write-Host "  2. Or restart your computer" -ForegroundColor Gray
} else {
    Write-Host "✅ Kuamini Security Client has been completely removed" -ForegroundColor Green
    Write-Host "   ✓ All files and configurations deleted" -ForegroundColor Green
    Write-Host "   ✓ All processes terminated" -ForegroundColor Green
    Write-Host "   ✓ System tray icons cleared" -ForegroundColor Green
    Write-Host ""
    Write-Host "The uninstallation is complete! Your system is clean." -ForegroundColor Green
}
Write-Host ""
pause
