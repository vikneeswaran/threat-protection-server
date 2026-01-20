# Kuamini Security Client Uninstaller for Windows
# Removes all traces and deregisters from console
# Version: 2.0

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script requires Administrator privileges" -ForegroundColor Yellow
    Write-Host "        Right-click and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
Write-Host "Kuamini Security Client Uninstaller" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
# API base URL
$API_BASE = "https://kuaminisystems.com/api/agent"
$AGENT_ID = ""

# Read agent_id from config if it exists
Write-Host "[INFO] Finding agent configuration..." -ForegroundColor Gray
$configPaths = @("$env:USERPROFILE\.kuamini\config.json", "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json", "$env:APPDATA\Kuamini\config.json")
foreach ($configPath in $configPaths) {
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($config.agent_id) {
                $AGENT_ID = $config.agent_id
                Write-Host "[OK] Agent ID: $AGENT_ID" -ForegroundColor Green
                break
            }
        }
        catch { }
    }
}

# Deregister from console
if ($AGENT_ID) {
    Write-Host "[INFO] Deregistering from console..." -ForegroundColor Gray
    try {
        $body = @{agent_id=$AGENT_ID} | ConvertTo-Json
        Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
        Write-Host "[OK] Deregistered from console" -ForegroundColor Green
    }
    catch {
        Write-Host "[WARN] Deregister failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Write-Host ""
Write-Host "[INFO] Checking for MSI installation..." -ForegroundColor Gray
foreach ($keyPath in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
    Get-ItemProperty $keyPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Kuamini*" } | ForEach-Object {
        Write-Host "[INFO] Found: $($_.DisplayName)" -ForegroundColor Gray
        if ($_.UninstallString -match '\{([A-F0-9-]+)\}') {
            Start-Process "msiexec.exe" -ArgumentList "/x $($Matches[1]) /qn /norestart" -Wait -NoNewWindow -ErrorAction SilentlyContinue
            Write-Host "[OK] MSI uninstalled" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "[INFO] Stopping processes..." -ForegroundColor Gray
Get-Process | Where-Object { $_.ProcessName -like "*Kuamini*" } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Write-Host "[INFO] Removing startup entries..." -ForegroundColor Gray
foreach ($key in @(@{Path="HKCU:\Software\Microsoft\Windows\CurrentVersion\Run";Name="KuaminiSecurityClient"},@{Path="HKLM:\Software\Microsoft\Windows\CurrentVersion\Run";Name="KuaminiSecurityClient"})) {
    if (Test-Path $key.Path) { Remove-ItemProperty -Path $key.Path -Name $key.Name -Force -ErrorAction SilentlyContinue }
}

Write-Host "[INFO] Removing scheduled tasks..." -ForegroundColor Gray
@("KuaminiSecurityClient","KuaminiAgentTray","KuaminiAgent","KuaminiSecurityClientSetup") | ForEach-Object { 
    Unregister-ScheduledTask -TaskName $_ -Confirm:$false -ErrorAction SilentlyContinue 
}

Write-Host ""
Write-Host "[INFO] Removing installation files..." -ForegroundColor Gray
$failedPaths = @()
foreach ($path in @("$env:ProgramFiles\KuaminiSecurityClient","${env:ProgramFiles(x86)}\KuaminiSecurityClient","$env:LOCALAPPDATA\KuaminiSecurityClient","$env:USERPROFILE\.kuamini","$env:ProgramData\Kuamini")) {
    if (Test-Path $path) {
        try {
            Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Attributes = 'Normal' }
            Remove-Item $path -Recurse -Force -ErrorAction Stop
            Write-Host "[OK] Removed: $path" -ForegroundColor Green
        }
        catch {
            Write-Host "[WARN] Could not remove: $path" -ForegroundColor Yellow
            $failedPaths += $path
        }
    }
}

Write-Host ""
Write-Host "[INFO] Removing registry entries..." -ForegroundColor Gray
@("HKCU:\Software\Kuamini","HKLM:\Software\Kuamini","HKLM:\Software\WOW6432Node\Kuamini") | ForEach-Object { 
    if (Test-Path $_) { Remove-Item $_ -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
Write-Host "[INFO] Restarting Windows Explorer..." -ForegroundColor Gray
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process explorer.exe

Write-Host ""
if ($failedPaths.Count -eq 0) {
    Write-Host "[OK] Uninstall complete! System is clean." -ForegroundColor Green
} else {
    Write-Host "[WARN] Completed with some issues:" -ForegroundColor Yellow
    foreach ($p in $failedPaths) { Write-Host "      - $p" -ForegroundColor Gray }
    Write-Host "      Try restarting and running again" -ForegroundColor Gray
}
Write-Host ""
pause
