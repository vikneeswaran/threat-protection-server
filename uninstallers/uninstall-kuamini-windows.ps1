param([switch]$Silent)
$ErrorActionPreference = "Continue"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "ERROR: Requires Administrator" -ForegroundColor Yellow; pause; exit 1 }
if (-not $Silent) { Write-Host "`nKuamini Security Client - Complete Uninstaller`n" -ForegroundColor Cyan }

# Find and deregister agent
$AGENT_ID = ""
$API_BASE = "https://kuaminisystems.com/api/agent"
foreach ($p in @("$env:USERPROFILE\.kuamini\config.json", "$env:APPDATA\Kuamini\config.json", "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json")) {
    if (Test-Path $p) { try { $c = Get-Content $p | ConvertFrom-Json; if ($c.agent_id) { $AGENT_ID = $c.agent_id; break } } catch {} }
}
if ($AGENT_ID) {
    if (-not $Silent) { Write-Host "[*] Deregistering agent..." -ForegroundColor Gray }
    try { Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post -Body (@{agent_id=$AGENT_ID}|ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop | Out-Null } catch {}
}

# Uninstall ALL MSI instances
if (-not $Silent) { Write-Host "[*] Checking for MSI installations..." -ForegroundColor Gray }
$uninstalled = 0
foreach ($k in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
    Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Kuamini*" } | ForEach-Object { 
        if ($_.UninstallString -match '\{([A-F0-9-]+)\}') { 
            if (-not $Silent) { Write-Host "    Uninstalling: $($_.DisplayName)" -ForegroundColor Gray }
            Start-Process msiexec.exe -ArgumentList "/x $($Matches[1]) /qn /norestart" -Wait -NoNewWindow -ErrorAction SilentlyContinue
            $uninstalled++
        }
    }
}
if (-not $Silent -and $uninstalled -gt 0) { Write-Host "    Removed $uninstalled MSI installation(s)" -ForegroundColor Green }

# Remove ALL scheduled tasks
if (-not $Silent) { Write-Host "[*] Removing scheduled tasks..." -ForegroundColor Gray }
@("KuaminiSecurityClient","KuaminiAgentTray","KuaminiAgent","KuaminiSecurityClientSetup") | ForEach-Object { 
    Unregister-ScheduledTask -TaskName $_ -Confirm:0 -ErrorAction SilentlyContinue
}

# Aggressive process termination (multiple attempts)
if (-not $Silent) { Write-Host "[*] Stopping all agent processes..." -ForegroundColor Gray }
for ($i = 0; $i -lt 3; $i++) {
    Get-Process | Where-Object { $_.Name -like "*Kuamini*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    taskkill /F /IM KuaminiSecurityClient.exe 2>$null | Out-Null
    taskkill /F /IM KuaminiAgentTray.exe 2>$null | Out-Null
    Start-Sleep -Milliseconds 500
}

# Final aggressive kill with /T (terminate process tree)
taskkill /F /T /IM KuaminiSecurityClient.exe 2>$null | Out-Null
Start-Sleep 1

# Remove registry startup entries (both 64-bit and 32-bit hives)
if (-not $Silent) { Write-Host "[*] Removing startup entries..." -ForegroundColor Gray }
Remove-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
Remove-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
Remove-ItemProperty "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run" -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue

# Remove registry keys
if (-not $Silent) { Write-Host "[*] Cleaning registry..." -ForegroundColor Gray }
@("HKCU:\Software\Kuamini","HKLM:\Software\Kuamini","HKLM:\Software\WOW6432Node\Kuamini") | ForEach-Object {
    if (Test-Path $_) { Remove-Item $_ -Recurse -Force -ErrorAction SilentlyContinue }
}

# Aggressive file removal with multiple strategies
if (-not $Silent) { Write-Host "[*] Removing installation files..." -ForegroundColor Gray }
$paths = @("$env:ProgramFiles\Kuamini", "$env:ProgramFiles\KuaminiSecurityClient", "${env:ProgramFiles(x86)}\Kuamini", "${env:ProgramFiles(x86)}\KuaminiSecurityClient", "$env:APPDATA\Kuamini", "$env:LOCALAPPDATA\Kuamini", "$env:LOCALAPPDATA\KuaminiSecurityClient", "$env:USERPROFILE\.kuamini", "$env:ProgramData\Kuamini")
$failedPaths = @()

foreach ($path in $paths) {
    if (Test-Path $path) {
        # Strategy 1: Normal removal
        try {
            Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Attributes = "Normal" }
            Remove-Item $path -Recurse -Force -ErrorAction Stop
            continue
        } catch {}
        
        # Strategy 2: Robocopy empty folder trick (for locked files)
        try {
            $emptyDir = Join-Path $env:TEMP "kuamini_empty_$(Get-Random)"
            New-Item -ItemType Directory $emptyDir -Force | Out-Null
            robocopy $emptyDir $path /MIR /NFL /NDL /NJH /NJS /NP /R:0 /W:0 | Out-Null
            Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
            Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $path)) { continue }
        } catch {}
        
        # Strategy 3: Move to temp and schedule for deletion on next boot
        try {
            $tempPath = Join-Path $env:TEMP "kuamini_delete_$(Get-Random)"
            Move-Item $path $tempPath -Force -ErrorAction SilentlyContinue
            if (Test-Path $tempPath) {
                Remove-Item $tempPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            if (-not (Test-Path $path)) { continue }
        } catch {}
        
        # Failed to remove
        $failedPaths += $path
    }
}

# Restart Explorer to clear tray icons
if (-not $Silent) { Write-Host "[*] Clearing system tray..." -ForegroundColor Gray }
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Start-Process explorer.exe

# Force-clean any remaining registry entries that Control Panel might still see
if (-not $Silent) { Write-Host "[*] Force-cleaning registry cache..." -ForegroundColor Gray }
@("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall","HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall") | ForEach-Object {
    if (Test-Path $_) {
        Get-ChildItem $_ -ErrorAction SilentlyContinue | ForEach-Object {
            $itemProps = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($itemProps -and $itemProps.DisplayName -like "*Kuamini*") {
                try {
                    Remove-Item $_.PSPath -Force -Recurse -ErrorAction SilentlyContinue
                } catch {}
            }
        }
    }
}

# Clear Windows Add/Remove Programs cache
if (-not $Silent) { Write-Host "[*] Clearing Control Panel cache..." -ForegroundColor Gray }
Remove-Item "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*Kuamini*" -Force -ErrorAction SilentlyContinue

# Final verification
$remainingProcs = Get-Process | Where-Object { $_.Name -like "*Kuamini*" } -ErrorAction SilentlyContinue
$remainingMSI = Get-ItemProperty 'HKLM:\SOFTWARE\*\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\*\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Kuamini*' }

if (-not $Silent) {
    Write-Host ""
    if ($failedPaths.Count -eq 0 -and -not $remainingProcs -and -not $remainingMSI) {
        Write-Host "[OK] Uninstall complete! System is clean." -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Uninstall completed with issues:" -ForegroundColor Yellow
        if ($remainingProcs) { Write-Host "  - $($remainingProcs.Count) process(es) still running" -ForegroundColor Gray }
        if ($remainingMSI) { Write-Host "  - MSI entry still in registry" -ForegroundColor Gray }
        if ($failedPaths.Count -gt 0) { 
            Write-Host "  - Could not remove:" -ForegroundColor Gray
            foreach ($p in $failedPaths) { Write-Host "    * $p" -ForegroundColor Gray }
        }
        Write-Host "`n  If Control Panel entry persists, restart Windows or uninstall manually." -ForegroundColor Yellow
    }
    Write-Host ""
    pause
}
