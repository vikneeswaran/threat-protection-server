# Kuamini Security Client Uninstaller for Windows
param([switch]$Silent, [switch]$SkipDeregister)
$ErrorActionPreference = "Continue"
function Write-Step { param($msg) if (-not $Silent) { Write-Host ">> $msg" -ForegroundColor Cyan } }
function Write-Success { param($msg) if (-not $Silent) { Write-Host "  [OK] $msg" -ForegroundColor Green } }
function Write-Warning { param($msg) if (-not $Silent) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow } }
function Write-Info { param($msg) if (-not $Silent) { Write-Host "  [INFO] $msg" -ForegroundColor Gray } }
if (-not $Silent) { Write-Host "`n====================================================`n   Kuamini Security Client - Complete Uninstaller`n====================================================`n" -ForegroundColor Cyan }
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Warning "Requires Administrator"; pause; exit 1 }
Write-Step "Finding agent configuration..."
$AGENT_ID = ""; $ACCOUNT_ID = ""; $API_BASE = "https://kuaminisystems.com/api/agent"
foreach ($configPath in @("$env:USERPROFILE\.kuamini\config.json", "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json", "$env:APPDATA\Kuamini\config.json")) {
    if (Test-Path $configPath) { try { $config = Get-Content $configPath -Raw | ConvertFrom-Json; if ($config.agent_id) { $AGENT_ID = $config.agent_id; Write-Success "Agent ID: $AGENT_ID"; break } } catch { } }
}
if (-not $SkipDeregister -and $AGENT_ID) {
    Write-Step "Deregistering from console..."
    try { Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post -Body (@{agent_id=$AGENT_ID;account_id=$ACCOUNT_ID}|ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10 | Out-Null; Write-Success "Deregistered" } catch { Write-Warning "Deregister failed" }
}
Write-Step "Checking for MSI installation..."
foreach ($keyPath in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
    Get-ItemProperty $keyPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Kuamini*" } | ForEach-Object {
        Write-Info "Found: $($_.DisplayName)"
        if ($_.UninstallString -match '\{([A-F0-9-]+)\}') {
            Start-Process "msiexec.exe" -ArgumentList "/x $($Matches[1]) /qn /norestart" -Wait -NoNewWindow | Out-Null
            Write-Success "MSI uninstalled"
        }
    }
}
Write-Step "Stopping processes..."
Get-Process | Where-Object { $_.ProcessName -like "*Kuamini*" } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
Write-Step "Removing startup entries..."
foreach ($key in @(@{Path="HKCU:\Software\Microsoft\Windows\CurrentVersion\Run";Name="KuaminiSecurityClient"},@{Path="HKLM:\Software\Microsoft\Windows\CurrentVersion\Run";Name="KuaminiSecurityClient"})) {
    if (Test-Path $key.Path) { Remove-ItemProperty -Path $key.Path -Name $key.Name -Force -ErrorAction SilentlyContinue }
}
@("KuaminiSecurityClient","KuaminiAgentTray","KuaminiAgent","KuaminiSecurityClientSetup") | ForEach-Object { Unregister-ScheduledTask -TaskName $_ -Confirm:$false -ErrorAction SilentlyContinue }
Write-Step "Removing files..."
$failedPaths = @()
foreach ($path in @("$env:ProgramFiles\KuaminiSecurityClient","${env:ProgramFiles(x86)}\KuaminiSecurityClient","$env:LOCALAPPDATA\KuaminiSecurityClient","$env:USERPROFILE\.kuamini","$env:ProgramData\Kuamini")) {
    if (Test-Path $path) {
        try { Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Attributes = 'Normal' }; Remove-Item $path -Recurse -Force -ErrorAction Stop; Write-Success "Removed: $path" }
        catch { try { $temp = Join-Path $env:TEMP "kuamini-empty"; if (-not (Test-Path $temp)) { New-Item -ItemType Directory $temp -Force | Out-Null }; robocopy $temp $path /MIR /NFL /NDL /NJH /NJS | Out-Null; Remove-Item $path -Recurse -Force; Write-Success "Removed: $path" } catch { Write-Warning "Could not remove: $path"; $failedPaths += $path } }
    }
}
Write-Step "Removing registry..."
@("HKCU:\Software\Kuamini","HKLM:\Software\Kuamini","HKLM:\Software\WOW6432Node\Kuamini") | ForEach-Object { if (Test-Path $_) { Remove-Item $_ -Recurse -Force -ErrorAction SilentlyContinue } }
Write-Step "Restarting Explorer..."
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep 2; Start-Process explorer.exe
if (-not $Silent) { Write-Host "`n====================================================`n" -ForegroundColor Cyan; if ($failedPaths.Count -eq 0) { Write-Success "Uninstall complete!" } else { Write-Warning "Completed with issues: $($failedPaths -join ', ')"; Write-Host "  Try restarting and running again" -ForegroundColor Gray }; pause }
