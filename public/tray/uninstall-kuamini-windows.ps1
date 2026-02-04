#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client - Advanced Uninstaller v3.1
Removes agent completely, including stubborn folders with locked files.

.DESCRIPTION
This script:
1. Deregisters agent from console
2. Uninstalls all MSI instances
3. Removes all processes, tasks, and registry entries
4. Uses multiple strategies to remove locked folders
5. Takes ownership if needed using takeown utility
6. Schedules reboot deletion if necessary

.PARAMETER Silent
Suppress output messages.

.NOTES
Requires Windows 10+ and Administrator privileges.
#>

param([switch]$Silent)

$ErrorActionPreference = "Continue"

# Verify admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Requires Administrator privileges" -ForegroundColor Red
    pause
    exit 1
}

if (-not $Silent) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Kuamini Security Client - Advanced Uninstaller v3.1" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================================
# STEP 1: FIND AGENT ID
# ============================================================================

$AGENT_ID = ""
$API_BASE = "https://kuaminisystems.com/api/agent"

foreach ($p in @(
    "$env:USERPROFILE\.kuamini\config.json",
    "$env:APPDATA\Kuamini\config.json",
    "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"
)) {
    if (Test-Path $p) {
        try {
            $c = Get-Content $p | ConvertFrom-Json
            if ($c.agent_id) {
                $AGENT_ID = $c.agent_id
                break
            }
        }
        catch {}
    }
}

# ============================================================================
# STEP 2: DEREGISTER FROM CONSOLE
# ============================================================================

if ($AGENT_ID) {
    if (-not $Silent) { Write-Host "[*] Deregistering agent from console..." -ForegroundColor Gray }
    try {
        Invoke-RestMethod -Uri "$API_BASE/deregister" -Method Post `
            -Body (@{agent_id = $AGENT_ID} | ConvertTo-Json) `
            -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop | Out-Null
        if (-not $Silent) { Write-Host "    [OK] Agent deregistered" -ForegroundColor Green }
    }
    catch {
        if (-not $Silent) { Write-Host "    [WARN] Could not deregister (may already be gone)" -ForegroundColor Yellow }
    }
}

# ============================================================================
# STEP 3: AGGRESSIVE PROCESS TERMINATION
# ============================================================================

if (-not $Silent) { Write-Host "[*] Stopping all Kuamini processes..." -ForegroundColor Gray }

# Kill processes multiple times (some may reload)
for ($i = 0; $i -lt 4; $i++) {
    Get-Process | Where-Object { $_.Name -like "*Kuamini*" } | Stop-Process -Force -ErrorAction SilentlyContinue | Out-Null
    taskkill /F /IM KuaminiSecurityClient.exe 2>$null | Out-Null
    taskkill /F /IM KuaminiAgentTray.exe 2>$null | Out-Null
    taskkill /F /IM KuaminiAgent.exe 2>$null | Out-Null
    taskkill /F /T /IM KuaminiSecurityClient.exe 2>$null | Out-Null
    Start-Sleep -Milliseconds 300
}

if (-not $Silent) { Write-Host "    [OK] Processes terminated" -ForegroundColor Green }

# ============================================================================
# STEP 4: UNINSTALL MSI INSTANCES
# ============================================================================

if (-not $Silent) { Write-Host "[*] Uninstalling MSI packages..." -ForegroundColor Gray }

$uninstalled = 0
$msiGUIDs = @()

# Find all Kuamini MSI entries by searching DisplayName property (not registry key name)
foreach ($regPath in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)) {
    if (-not (Test-Path $regPath)) { continue }
    
    Get-ChildItem $regPath -ErrorAction SilentlyContinue | ForEach-Object {
        $displayName = (Get-ItemProperty $_.PSPath -Name DisplayName -ErrorAction SilentlyContinue).DisplayName
        
        # Check if DisplayName contains "Kuamini" or "SecurityClient"
        if ($displayName -like "*Kuamini*" -or $displayName -like "*Security*Client*") {
            # Extract GUID from registry path
            $guid = $_.PSChildName
            
            if (-not $Silent) { 
                Write-Host "    Uninstalling: $displayName (GUID: $guid)" -ForegroundColor Gray 
            }
            
            # Run MSI uninstall
            try {
                Start-Process -FilePath "msiexec.exe" `
                    -ArgumentList "/x $guid /qn /norestart /l*vx `"$env:TEMP\kuamini_uninstall.log`"" `
                    -Wait -NoNewWindow -ErrorAction Stop
                
                $uninstalled++
                Start-Sleep -Milliseconds 500
            }
            catch {
                if (-not $Silent) { 
                    Write-Host "      [WARN] Failed to uninstall: $($_.Exception.Message)" -ForegroundColor Yellow 
                }
            }
        }
    }
}

if ($uninstalled -gt 0 -and -not $Silent) {
    Write-Host "    [OK] Removed $uninstalled MSI installation(s)" -ForegroundColor Green
}

# ============================================================================
# STEP 5: REMOVE SCHEDULED TASKS
# ============================================================================

if (-not $Silent) { Write-Host "[*] Removing scheduled tasks..." -ForegroundColor Gray }

@(
    "KuaminiSecurityClient",
    "KuaminiAgentTray",
    "KuaminiAgent",
    "KuaminiSecurityClientSetup"
) | ForEach-Object {
    Unregister-ScheduledTask -TaskName $_ -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
}

if (-not $Silent) { Write-Host "    [OK] Scheduled tasks removed" -ForegroundColor Green }

# ============================================================================
# STEP 6: REMOVE STARTUP ENTRIES
# ============================================================================

if (-not $Silent) { Write-Host "[*] Removing startup registry entries..." -ForegroundColor Gray }

@(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
) | ForEach-Object {
    Remove-ItemProperty $_ -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue | Out-Null
    Remove-ItemProperty $_ -Name "KuaminiAgentTray" -Force -ErrorAction SilentlyContinue | Out-Null
}

if (-not $Silent) { Write-Host "    [OK] Startup entries removed" -ForegroundColor Green }

# ============================================================================
# STEP 7: REMOVE REGISTRY KEYS
# ============================================================================

if (-not $Silent) { Write-Host "[*] Cleaning registry..." -ForegroundColor Gray }

@(
    "HKCU:\Software\Kuamini",
    "HKLM:\Software\Kuamini",
    "HKLM:\Software\WOW6432Node\Kuamini",
    "HKCU:\Software\KuaminiSecurityClient",
    "HKLM:\Software\KuaminiSecurityClient"
) | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item $_ -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
    }
}

if (-not $Silent) { Write-Host "    [OK] Registry cleaned" -ForegroundColor Green }

# ============================================================================
# STEP 8: REMOVE INSTALLATION FILES (AGGRESSIVE)
# ============================================================================

if (-not $Silent) { Write-Host "[*] Removing installation files..." -ForegroundColor Gray }

# All possible installation paths
$installPaths = @(
    "$env:ProgramFiles\Kuamini",
    "$env:ProgramFiles\KuaminiSecurityClient",
    "$env:ProgramFiles\Kuamini Security Client",
    "${env:ProgramFiles(x86)}\Kuamini",
    "${env:ProgramFiles(x86)}\KuaminiSecurityClient",
    "${env:ProgramFiles(x86)}\Kuamini Security Client",
    "$env:APPDATA\Kuamini",
    "$env:APPDATA\KuaminiSecurityClient",
    "$env:LOCALAPPDATA\Kuamini",
    "$env:LOCALAPPDATA\KuaminiSecurityClient",
    "$env:USERPROFILE\.kuamini",
    "$env:ProgramData\Kuamini",
    "$env:ProgramData\KuaminiSecurityClient"
)

$failedPaths = @()
$removedCount = 0

foreach ($path in $installPaths) {
    if (-not (Test-Path $path)) { continue }
    
    $pathName = Split-Path $path -Leaf
    
    # STRATEGY 1: Direct removal (normal case)
    if (Test-Path $path) {
        try {
            Write-Host "    Attempting to remove: $pathName" -ForegroundColor Gray
            
            # Reset file attributes to Normal
            Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                $_.Attributes = "Normal"
            }
            
            Remove-Item $path -Recurse -Force -ErrorAction Stop
            Write-Host "      [OK] Removed directly" -ForegroundColor Green
            $removedCount++
            continue
        }
        catch {
            Write-Host "      [WARN] Direct removal failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }
    
    # STRATEGY 2: Take ownership and grant permissions
    if (Test-Path $path) {
        try {
            Write-Host "      Attempting to take ownership..." -ForegroundColor Gray
            
            # Take ownership using takeown utility
            $takeownResult = & takeown /f $path /r /d Y 2>&1
            
            # Grant full permissions for current user
            $icaclsResult = & icacls $path /grant:r $([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value):F /t /c 2>&1
            
            # Try removal again
            Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                $_.Attributes = "Normal"
            }
            
            Remove-Item $path -Recurse -Force -ErrorAction Stop
            Write-Host "      [OK] Removed after taking ownership" -ForegroundColor Green
            $removedCount++
            continue
        }
        catch {
            Write-Host "      [WARN] Takeown strategy failed" -ForegroundColor DarkYellow
        }
    }
    
    # STRATEGY 3: Move to temp and delete
    if (Test-Path $path) {
        try {
            Write-Host "      Attempting to move to temp..." -ForegroundColor Gray
            
            $tempPath = Join-Path $env:TEMP ("kuamini_delete_" + (Get-Random))
            Move-Item $path $tempPath -Force -ErrorAction Stop
            
            Remove-Item $tempPath -Recurse -Force -ErrorAction Stop
            
            Write-Host "      [OK] Removed via temp directory" -ForegroundColor Green
            $removedCount++
            continue
        }
        catch {
            Write-Host "      [WARN] Move strategy failed" -ForegroundColor DarkYellow
        }
    }
    
    # STRATEGY 4: Use ProcessHacker/PendingFileRenameOperations
    if (Test-Path $path) {
        try {
            Write-Host "      Scheduling for next reboot..." -ForegroundColor Gray
            
            # Use cmd /c to schedule deletion on next reboot
            cmd /c @"
REM Schedule deletion on reboot
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager" /v PendingFileRenameOperations /t REG_MULTI_SZ /d "$path" /f >nul 2>&1
"@ | Out-Null
            
            Write-Host "      [WARN] Scheduled for next reboot" -ForegroundColor Yellow
            $failedPaths += $path
            continue
        }
        catch {}
    }
    
    # All strategies failed
    if (Test-Path $path) {
        Write-Host "      [FAIL] Could not remove" -ForegroundColor Red
        $failedPaths += $path
    }
}

if (-not $Silent) {
    Write-Host "    [OK] Summary: Removed $removedCount folder(s)" -ForegroundColor Green
}

# ============================================================================
# STEP 9: CLEAR SYSTEM TRAY
# ============================================================================

if (-not $Silent) { Write-Host "[*] Clearing system tray icons..." -ForegroundColor Gray }

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue | Out-Null
Start-Sleep -Seconds 1
Start-Process explorer.exe -ErrorAction SilentlyContinue | Out-Null

if (-not $Silent) { Write-Host "    [OK] Explorer restarted" -ForegroundColor Green }

# ============================================================================
# STEP 10: CLEAN CONTROL PANEL CACHE
# ============================================================================

if (-not $Silent) { Write-Host "[*] Cleaning Control Panel cache and registry..." -ForegroundColor Gray }

$removedEntries = 0

@(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
) | ForEach-Object {
    $path = $_
    if (-not (Test-Path $path)) { return }
    
    Get-ChildItem $path -ErrorAction SilentlyContinue | ForEach-Object {
        $displayName = (Get-ItemProperty $_.PSPath -Name DisplayName -ErrorAction SilentlyContinue).DisplayName
        
        # Check if DisplayName contains "Kuamini" or "Security"
        if ($displayName -like "*Kuamini*" -or $displayName -like "*Security*Client*") {
            try {
                Remove-Item $_.PSPath -Recurse -Force -ErrorAction Stop
                if (-not $Silent) { 
                    Write-Host "      [OK] Removed registry entry: $displayName" -ForegroundColor Green 
                }
                $removedEntries++
            }
            catch {
                if (-not $Silent) { 
                    Write-Host "      [WARN] Could not remove: $displayName" -ForegroundColor Yellow 
                }
            }
        }
    }
}

if ($removedEntries -gt 0 -and -not $Silent) {
    Write-Host "    [OK] Removed $removedEntries Control Panel entries" -ForegroundColor Green
}
else {
    if (-not $Silent) { Write-Host "    [OK] Registry cleaned" -ForegroundColor Green }
}

# ============================================================================
# STEP 11: FINAL VERIFICATION
# ============================================================================

if (-not $Silent) { Write-Host "[*] Verifying uninstall..." -ForegroundColor Gray }

$remainingProcs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Kuamini*" })
$remainingFolders = @()
foreach ($p in $installPaths) {
    if (Test-Path $p) { $remainingFolders += $p }
}
$remainingMSI = @(Get-ItemProperty 'HKLM:\SOFTWARE\*\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\*\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Kuamini*' })

# ============================================================================
# STEP 12: SUMMARY
# ============================================================================

if (-not $Silent) {
    Write-Host ""
    
    if ($remainingProcs.Count -eq 0 -and $remainingFolders.Count -eq 0 -and $remainingMSI.Count -eq 0) {
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "  [OK] UNINSTALL COMPLETE - System is clean" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "============================================================" -ForegroundColor Yellow
        Write-Host "  [WARN] UNINSTALL COMPLETED WITH ISSUES" -ForegroundColor Yellow
        Write-Host "============================================================" -ForegroundColor Yellow
        Write-Host ""
        
        if ($remainingProcs.Count -gt 0) {
            Write-Host "  [WARN] Processes still running ($($remainingProcs.Count))" -ForegroundColor Yellow
            foreach ($proc in $remainingProcs) {
                Write-Host "    - $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Gray
            }
        }
        
        if ($remainingFolders.Count -gt 0) {
            Write-Host "  [WARN] Folders not removed ($($remainingFolders.Count))" -ForegroundColor Yellow
            foreach ($folder in $remainingFolders) {
                Write-Host "    - $folder" -ForegroundColor Gray
            }
            Write-Host ""
            Write-Host "  SOLUTION:" -ForegroundColor Cyan
            Write-Host "    1. Restart Windows to remove remaining files" -ForegroundColor Gray
            Write-Host "    2. Or manually delete with administrator privileges" -ForegroundColor Gray
        }
        
        if ($remainingMSI.Count -gt 0) {
            Write-Host "  [WARN] MSI entries in registry ($($remainingMSI.Count))" -ForegroundColor Yellow
            foreach ($app in $remainingMSI) {
                Write-Host "    - $($app.DisplayName)" -ForegroundColor Gray
            }
            Write-Host ""
            Write-Host "  This is typically cached by Windows." -ForegroundColor Yellow
            Write-Host "  Control Panel should show removal on restart." -ForegroundColor Gray
        }
        
        Write-Host ""
    }
    
    pause
}

exit 0
