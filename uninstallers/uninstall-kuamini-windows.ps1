param([switch]$Silent)
$ErrorActionPreference = "Continue"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "ERROR: Requires Administrator" -ForegroundColor Yellow; pause; exit 1 }
if (-not $Silent) { Write-Host "`nKuamini Security Client Uninstaller`n" -ForegroundColor Cyan }
$AGENT_ID = ""
$API_BASE = "https://kuaminisystems.com/api/agent"
foreach ($p in @("$env:USERPROFILE\.kuamini\config.json", "$env:APPDATA\Kuamini\config.json", "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json")) {
    if (Test-Path $p) { try { $c = Get-Content $p | ConvertFrom-Json; if ($c.agent_id) { $AGENT_ID = $c.agent_id; break } } catch {} }
}
if ($AGENT_ID) {
    try { Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post -Body (@{agent_id=$AGENT_ID}|ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop | Out-Null } catch {}
}
foreach ($k in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
    Get-ItemProperty $k | Where-Object { $_.DisplayName -like "*Kuamini*" } | ForEach-Object { if ($_.UninstallString -match '\{([A-F0-9-]+)\}') { Start-Process msiexec.exe -ArgumentList "/x $($Matches[1]) /qn" -Wait -NoNewWindow -ErrorAction SilentlyContinue } }
}
Unregister-ScheduledTask -TaskName "KuaminiSecurityClient" -Confirm:0 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "KuaminiAgentTray" -Confirm:0 -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.Name -like "*Kuamini*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1
Remove-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "HKLM:\Software\Kuamini" -Recurse -Force -ErrorAction SilentlyContinue
foreach ($path in @("$env:ProgramFiles\Kuamini", "$env:ProgramFiles\KuaminiSecurityClient", "${env:ProgramFiles(x86)}\Kuamini", "${env:ProgramFiles(x86)}\KuaminiSecurityClient", "$env:APPDATA\Kuamini", "$env:LOCALAPPDATA\Kuamini", "$env:USERPROFILE\.kuamini", "$env:ProgramData\Kuamini")) {
    if (Test-Path $path) { Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Attributes = "Normal" }; Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue }
}
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Start-Process explorer.exe
if (-not $Silent) { Write-Host "Uninstall complete`n" -ForegroundColor Green; pause }
