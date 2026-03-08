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

# SIG # Begin signature block
# MIIltwYJKoZIhvcNAQcCoIIlqDCCJaQCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBJJamV/zCwqF0A
# xfxN+USeBdw5H4wyXEqM21xhRhTgQKCCCrkwggMwMIICtqADAgECAhA3dENPnrQO
# Ih+SNsofLycXMAoGCCqGSM49BAMDMFYxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9T
# ZWN0aWdvIExpbWl0ZWQxLTArBgNVBAMTJFNlY3RpZ28gUHVibGljIENvZGUgU2ln
# bmluZyBSb290IEU0NjAeFw0yMTAzMjIwMDAwMDBaFw0zNjAzMjEyMzU5NTlaMFcx
# CzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMT
# JVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYwWTATBgcqhkjO
# PQIBBggqhkjOPQMBBwNCAATeYxX2c1WJigfhpKs/AWOltt5cfDakxup7PAMZvjm4
# RlCveoj0eC3SThHbqjm6l9fMm3TcXx5+7StE0SzjIMPPo4IBYzCCAV8wHwYDVR0j
# BBgwFoAUz30soJB6mB3dtl6FwuDaFXHS5V4wHQYDVR0OBBYEFBp0pDjXubYOs1v6
# 3F6uP7bwcz2IMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMBMG
# A1UdJQQMMAoGCCsGAQUFBwMDMBoGA1UdIAQTMBEwBgYEVR0gADAHBgVngQwBAzBL
# BgNVHR8ERDBCMECgPqA8hjpodHRwOi8vY3JsLnNlY3RpZ28uY29tL1NlY3RpZ29Q
# dWJsaWNDb2RlU2lnbmluZ1Jvb3RFNDYuY3JsMHsGCCsGAQUFBwEBBG8wbTBGBggr
# BgEFBQcwAoY6aHR0cDovL2NydC5zZWN0aWdvLmNvbS9TZWN0aWdvUHVibGljQ29k
# ZVNpZ25pbmdSb290RTQ2LnA3YzAjBggrBgEFBQcwAYYXaHR0cDovL29jc3Auc2Vj
# dGlnby5jb20wCgYIKoZIzj0EAwMDaAAwZQIxAKB6vcvgJjHZbsfIfO8toCc1571B
# Wo7A6sFhnLKpcREu1mDUOxyx2hhnaCzMRbfNpQIwBou1zB2hXfkAOmu7b3AKFLuQ
# WBe3n30THbvCYv764kIm2HrFivefIXZvZgkMBq07MIIDuzCCA2KgAwIBAgIRAOLu
# IynBSXKmD4uxzzZG8PowCgYIKoZIzj0EAwIwVzELMAkGA1UEBhMCR0IxGDAWBgNV
# BAoTD1NlY3RpZ28gTGltaXRlZDEuMCwGA1UEAxMlU2VjdGlnbyBQdWJsaWMgQ29k
# ZSBTaWduaW5nIENBIEVWIEUzNjAeFw0yNjAzMDQwMDAwMDBaFw0yNzAyMjcyMzU5
# NTlaMIG6MQ8wDQYDVQQFEwYyMDkxMDIxEzARBgsrBgEEAYI3PAIBAxMCSU4xHTAb
# BgNVBA8TFFByaXZhdGUgT3JnYW5pemF0aW9uMQswCQYDVQQGEwJJTjESMBAGA1UE
# CAwJS2FybmF0YWthMSgwJgYDVQQKDB9LdWFtaW5pIFN5c3RlbXMgUHJpdmF0ZSBM
# aW1pdGVkMSgwJgYDVQQDDB9LdWFtaW5pIFN5c3RlbXMgUHJpdmF0ZSBMaW1pdGVk
# MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEVzMTIxPVTNlwjzG2GkDo1J6GLgM7GMp7
# 57Eofy304cvPPqn/5s6oOJSw7oz/AW2Cb2auST6NPDVTfXJ4VwjGxjs8mbnV/mOY
# D3fTgF2gvx+ooRObk/jk3Q6kjVHZ7b7vo4IBjDCCAYgwHwYDVR0jBBgwFoAUGnSk
# ONe5tg6zW/rcXq4/tvBzPYgwHQYDVR0OBBYEFPZzd1nGClb5B4Fiw6YAN6Wp9zT5
# MA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMBMGA1UdJQQMMAoGCCsGAQUF
# BwMDMEkGA1UdIARCMEAwNQYMKwYBBAGyMQECAQYBMCUwIwYIKwYBBQUHAgEWF2h0
# dHBzOi8vc2VjdGlnby5jb20vQ1BTMAcGBWeBDAEDMEsGA1UdHwREMEIwQKA+oDyG
# Omh0dHA6Ly9jcmwuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY0NvZGVTaWduaW5n
# Q0FFVkUzNi5jcmwwewYIKwYBBQUHAQEEbzBtMEYGCCsGAQUFBzAChjpodHRwOi8v
# Y3J0LnNlY3RpZ28uY29tL1NlY3RpZ29QdWJsaWNDb2RlU2lnbmluZ0NBRVZFMzYu
# Y3J0MCMGCCsGAQUFBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTAKBggqhkjO
# PQQDAgNHADBEAiBU8NyTUKJg4+12Wj8mpPtzL8Q3f79MTUJf8T+8Miz0LQIgMvbe
# OvDPhxFAxd6k+vLulwZupVrcLOmqquFEcAvm6KgwggPCMIICqqADAgECAhEA1bNg
# AolZon+EZcnmsY26yzANBgkqhkiG9w0BAQwFADB7MQswCQYDVQQGEwJHQjEbMBkG
# A1UECAwSR3JlYXRlciBNYW5jaGVzdGVyMRAwDgYDVQQHDAdTYWxmb3JkMRowGAYD
# VQQKDBFDb21vZG8gQ0EgTGltaXRlZDEhMB8GA1UEAwwYQUFBIENlcnRpZmljYXRl
# IFNlcnZpY2VzMB4XDTIzMDIyODAwMDAwMFoXDTI4MTIzMTIzNTk1OVowVjELMAkG
# A1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDEtMCsGA1UEAxMkU2Vj
# dGlnbyBQdWJsaWMgQ29kZSBTaWduaW5nIFJvb3QgRTQ2MHYwEAYHKoZIzj0CAQYF
# K4EEACIDYgAECDKBAx+PO6JvgUeM5Xu5usFpsltJwCi5FFhvJDPOUJtz2TvBaDmc
# emHOXNIiR0SrgIWp5ZWsqq5mWIZWp7iDg8y00Q6pUfhLZzl/jLm2OWg0jxlKuo4h
# 60K4rFadCdwHo4IBEjCCAQ4wHwYDVR0jBBgwFoAUoBEKIz6W8Qfs4q8p74Klf9Aw
# pLQwHQYDVR0OBBYEFM99LKCQepgd3bZehcLg2hVx0uVeMA4GA1UdDwEB/wQEAwIB
# hjAPBgNVHRMBAf8EBTADAQH/MBMGA1UdJQQMMAoGCCsGAQUFBwMDMBsGA1UdIAQU
# MBIwBgYEVR0gADAIBgZngQwBBAEwQwYDVR0fBDwwOjA4oDagNIYyaHR0cDovL2Ny
# bC5jb21vZG9jYS5jb20vQUFBQ2VydGlmaWNhdGVTZXJ2aWNlcy5jcmwwNAYIKwYB
# BQUHAQEEKDAmMCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5jb21vZG9jYS5jb20w
# DQYJKoZIhvcNAQEMBQADggEBADc/3k+qsxlJ+HvTaRt6IIKio8RhkUSnp4yL83mN
# Om/nx6/JbbAPpXIot9T7QOxp05HlAtGx1TTa1vOmuE/BzqEkYgabnhh9D4TpeJXJ
# 4NmrfXv30hNDQ+ZO95l093B/HFGgtRbu9oyakSvFBMy3/6P1dQALvj4mjxsjZM0r
# JbAyDuaxzzTJY33OCRYfuBG4pkZJbDTaWPhcwIoTzqYoOOIMS9ljMYbSGH8icSBX
# 07xY5M/GLtc5fmYZoLjgjxZkVvFW2nAG3vXCVyao0/nxqE3v9VMlmAqK6Fy+OpwD
# OvQd+n62UkGaIXgoWiycinPrAzn4tNMWwTslwiX7mSiO0d8xghpUMIIaUAIBATBs
# MFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLjAsBgNV
# BAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYCEQDi7iMp
# wUlypg+Lsc82RvD6MA0GCWCGSAFlAwQCAQUAoHwwEAYKKwYBBAGCNwIBDDECMAAw
# GQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisG
# AQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIOhkoAj1hd2AtBw+GgfXt0G1pt3LTlB8
# Iiu7QII3aWa4MAsGByqGSM49AgEFAARnMGUCMQDxTLhzmMvbpm4R9VL7fgibHmvQ
# lM66vRTYF/IX63xfg44iFJduZgzeFqtaPi1NpaQCMBIrOfRmE7qL3NZ4bW+8EBUU
# jz7VbnZ6ch8JEO9G1P03FOP0cqz/8pavgm+32PQC46GCGNgwghjUBgorBgEEAYI3
# AwMBMYIYxDCCGMAGCSqGSIb3DQEHAqCCGLEwghitAgEDMQ8wDQYJYIZIAWUDBAIC
# BQAwgfgGCyqGSIb3DQEJEAEEoIHoBIHlMIHiAgEBBgorBgEEAbIxAgEBMDEwDQYJ
# YIZIAWUDBAIBBQAEIIIhYZIWdhiqNHytBtWMOd0Apz7Z1GSOWNiK6zOvOko3AhUA
# za+uvYIOILdZWqongb8HS1OmuQsYDzIwMjYwMzA4MDY1MzU4WqB2pHQwcjELMAkG
# A1UEBhMCR0IxFzAVBgNVBAgTDldlc3QgWW9ya3NoaXJlMRgwFgYDVQQKEw9TZWN0
# aWdvIExpbWl0ZWQxMDAuBgNVBAMTJ1NlY3RpZ28gUHVibGljIFRpbWUgU3RhbXBp
# bmcgU2lnbmVyIFIzNqCCEwQwggZiMIIEyqADAgECAhEApCk7bh7d16c0CIetek63
# JDANBgkqhkiG9w0BAQwFADBVMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGln
# byBMaW1pdGVkMSwwKgYDVQQDEyNTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5n
# IENBIFIzNjAeFw0yNTAzMjcwMDAwMDBaFw0zNjAzMjEyMzU5NTlaMHIxCzAJBgNV
# BAYTAkdCMRcwFQYDVQQIEw5XZXN0IFlvcmtzaGlyZTEYMBYGA1UEChMPU2VjdGln
# byBMaW1pdGVkMTAwLgYDVQQDEydTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5n
# IFNpZ25lciBSMzYwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDThJX0
# bqRTePI9EEt4Egc83JSBU2dhrJ+wY7JgReuff5KQNhMuzVytzD+iXazATVPMHZpH
# /kkiMo1/vlAGFrYN2P7g0Q8oPEcR3h0SftFNYxxMh+bj3ZNbbYjwt8f4DsSHPT+x
# p9zoFuw0HOMdO3sWeA1+F8mhg6uS6BJpPwXQjNSHpVTCgd1gOmKWf12HSfSbnjl3
# kDm0kP3aIUAhsodBYZsJA1imWqkAVqwcGfvs6pbfs/0GE4BJ2aOnciKNiIV1wDRZ
# Ah7rS/O+uTQcb6JVzBVmPP63k5xcZNzGo4DOTV+sM1nVrDycWEYS8bSS0lCSeclk
# TcPjQah9Xs7xbOBoCdmahSfg8Km8ffq8PhdoAXYKOI+wlaJj+PbEuwm6rHcm24jh
# qQfQyYbOUFTKWFe901VdyMC4gRwRAq04FH2VTjBdCkhKts5Py7H73obMGrxN1uGg
# VyZho4FkqXA8/uk6nkzPH9QyHIED3c9CGIJ098hU4Ig2xRjhTbengoncXUeo/cfp
# KXDeUcAKcuKUYRNdGDlf8WnwbyqUblj4zj1kQZSnZud5EtmjIdPLKce8UhKl5+EE
# JXQp1Fkc9y5Ivk4AZacGMCVG0e+wwGsjcAADRO7Wga89r/jJ56IDK773LdIsL3yA
# NVvJKdeeS6OOEiH6hpq2yT+jJ/lHa9zEdqFqMwIDAQABo4IBjjCCAYowHwYDVR0j
# BBgwFoAUX1jtTDF6omFCjVKAurNhlxmiMpswHQYDVR0OBBYEFIhhjKEqN2SBKGCh
# mzHQjP0sAs5PMA4GA1UdDwEB/wQEAwIGwDAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB
# /wQMMAoGCCsGAQUFBwMIMEoGA1UdIARDMEEwNQYMKwYBBAGyMQECAQMIMCUwIwYI
# KwYBBQUHAgEWF2h0dHBzOi8vc2VjdGlnby5jb20vQ1BTMAgGBmeBDAEEAjBKBgNV
# HR8EQzBBMD+gPaA7hjlodHRwOi8vY3JsLnNlY3RpZ28uY29tL1NlY3RpZ29QdWJs
# aWNUaW1lU3RhbXBpbmdDQVIzNi5jcmwwegYIKwYBBQUHAQEEbjBsMEUGCCsGAQUF
# BzAChjlodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3RpZ29QdWJsaWNUaW1lU3Rh
# bXBpbmdDQVIzNi5jcnQwIwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28u
# Y29tMA0GCSqGSIb3DQEBDAUAA4IBgQACgT6khnJRIfllqS49Uorh5ZvMSxNEk4SN
# si7qvu+bNdcuknHgXIaZyqcVmhrV3PHcmtQKt0blv/8t8DE4bL0+H0m2tgKElpUe
# u6wOH02BjCIYM6HLInbNHLf6R2qHC1SUsJ02MWNqRNIT6GQL0Xm3LW7E6hDZmR8j
# lYzhZcDdkdw0cHhXjbOLsmTeS0SeRJ1WJXEzqt25dbSOaaK7vVmkEVkOHsp16ez4
# 9Bc+Ayq/Oh2BAkSTFog43ldEKgHEDBbCIyba2E8O5lPNan+BQXOLuLMKYS3ikTcp
# /Qw63dxyDCfgqXYUhxBpXnmeSO/WA4NwdwP35lWNhmjIpNVZvhWoxDL+PxDdpph3
# +M5DroWGTc1ZuDa1iXmOFAK4iwTnlWDg3QNRsRa9cnG3FBBpVHnHOEQj4GMkrOHd
# NDTbonEeGvZ+4nSZXrwCW4Wv2qyGDBLlKk3kUW1pIScDCpm/chL6aUbnSsrtbepd
# tbCLiGanKVR/KC1gsR0tC6Q0RfWOI4owggYUMIID/KADAgECAhB6I67aU2mWD5HI
# Plz0x+M/MA0GCSqGSIb3DQEBDAUAMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9T
# ZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIFRpbWUgU3Rh
# bXBpbmcgUm9vdCBSNDYwHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBV
# MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMSwwKgYDVQQD
# EyNTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5nIENBIFIzNjCCAaIwDQYJKoZI
# hvcNAQEBBQADggGPADCCAYoCggGBAM2Y2ENBq26CK+z2M34mNOSJjNPvIhKAVD7v
# Jq+MDoGD46IiM+b83+3ecLvBhStSVjeYXIjfa3ajoW3cS3ElcJzkyZlBnwDEJuHl
# zpbN4kMH2qRBVrjrGJgSlzzUqcGQBaCxpectRGhhnOSwcjPMI3G0hedv2eNmGiUb
# D12OeORN0ADzdpsQ4dDi6M4YhoGE9cbY11XxM2AVZn0GiOUC9+XE0wI7CQKfOUfi
# gLDn7i/WeyxZ43XLj5GVo7LDBExSLnh+va8WxTlA+uBvq1KO8RSHUQLgzb1gbL9I
# hgzxmkdp2ZWNuLc+XyEmJNbD2OIIq/fWlwBp6KNL19zpHsODLIsgZ+WZ1AzCs1HE
# K6VWrxmnKyJJg2Lv23DlEdZlQSGdF+z+Gyn9/CRezKe7WNyxRf4e4bwUtrYE2F5Q
# +05yDD68clwnweckKtxRaF0VzN/w76kOLIaFVhf5sMM/caEZLtOYqYadtn034ykS
# FaZuIBU9uCSrKRKTPJhWvXk4CllgrwIDAQABo4IBXDCCAVgwHwYDVR0jBBgwFoAU
# 9ndq3T/9ARP/FqFsggIv0Ao9FCUwHQYDVR0OBBYEFF9Y7UwxeqJhQo1SgLqzYZcZ
# ojKbMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMBMGA1UdJQQM
# MAoGCCsGAQUFBwMIMBEGA1UdIAQKMAgwBgYEVR0gADBMBgNVHR8ERTBDMEGgP6A9
# hjtodHRwOi8vY3JsLnNlY3RpZ28uY29tL1NlY3RpZ29QdWJsaWNUaW1lU3RhbXBp
# bmdSb290UjQ2LmNybDB8BggrBgEFBQcBAQRwMG4wRwYIKwYBBQUHMAKGO2h0dHA6
# Ly9jcnQuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY1RpbWVTdGFtcGluZ1Jvb3RS
# NDYucDdjMCMGCCsGAQUFBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkq
# hkiG9w0BAQwFAAOCAgEAEtd7IK0ONVgMnoEdJVj9TC1ndK/HYiYh9lVUacahRoZ2
# W2hfiEOyQExnHk1jkvpIJzAMxmEc6ZvIyHI5UkPCbXKspioYMdbOnBWQUn733qMo
# oBfIghpR/klUqNxx6/fDXqY0hSU1OSkkSivt51UlmJElUICZYBodzD3M/SFjeCP5
# 9anwxs6hwj1mfvzG+b1coYGnqsSz2wSKr+nDO+Db8qNcTbJZRAiSazr7KyUJGo1c
# +MScGfG5QHV+bps8BX5Oyv9Ct36Y4Il6ajTqV2ifikkVtB3RNBUgwu/mSiSUice/
# Jp/q8BMk/gN8+0rNIE+QqU63JoVMCMPY2752LmESsRVVoypJVt8/N3qQ1c6Fibbc
# Rabo3azZkcIdWGVSAdoLgAIxEKBeNh9AQO1gQrnh1TA8ldXuJzPSuALOz1Ujb0PC
# yNVkWk7hkhVHfcvBfI8NtgWQupiaAeNHe0pWSGH2opXZYKYG4Lbukg7HpNi/KqJh
# ue2Keak6qH9A8CeEOB7Eob0Zf+fU+CCQaL0cJqlmnx9HCDxF+3BLbUufrV64EbTI
# 40zqegPZdA+sXCmbcZy6okx/SjwsusWRItFA3DE8MORZeFb6BmzBtqKJ7l939bbK
# By2jvxcJI98Va95Q5JnlKor3m0E7xpMeYRriWklUPsetMSf2NvUQa/E5vVyefQIw
# ggaCMIIEaqADAgECAhA2wrC9fBs656Oz3TbLyXVoMA0GCSqGSIb3DQEBDAUAMIGI
# MQswCQYDVQQGEwJVUzETMBEGA1UECBMKTmV3IEplcnNleTEUMBIGA1UEBxMLSmVy
# c2V5IENpdHkxHjAcBgNVBAoTFVRoZSBVU0VSVFJVU1QgTmV0d29yazEuMCwGA1UE
# AxMlVVNFUlRydXN0IFJTQSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTAeFw0yMTAz
# MjIwMDAwMDBaFw0zODAxMTgyMzU5NTlaMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQK
# Ew9TZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIFRpbWUg
# U3RhbXBpbmcgUm9vdCBSNDYwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoIC
# AQCIndi5RWedHd3ouSaBmlRUwHxJBZvMWhUP2ZQQRLRBQIF3FJmp1OR2LMgIU14g
# 0JIlL6VXWKmdbmKGRDILRxEtZdQnOh2qmcxGzjqemIk8et8sE6J+N+Gl1cnZocew
# 8eCAawKLu4TRrCoqCAT8uRjDeypoGJrruH/drCio28aqIVEn45NZiZQI7YYBex48
# eL78lQ0BrHeSmqy1uXe9xN04aG0pKG9ki+PC6VEfzutu6Q3IcZZfm00r9YAEp/4a
# eiLhyaKxLuhKKaAdQjRaf/h6U13jQEV1JnUTCm511n5avv4N+jSVwd+Wb8UMOs4n
# etapq5Q/yGyiQOgjsP/JRUj0MAT9YrcmXcLgsrAimfWY3MzKm1HCxcquinTqbs1Q
# 0d2VMMQyi9cAgMYC9jKc+3mW62/yVl4jnDcw6ULJsBkOkrcPLUwqj7poS0T2+2JM
# zPP+jZ1h90/QpZnBkhdtixMiWDVgh60KmLmzXiqJc6lGwqoUqpq/1HVHm+Pc2B6+
# wCy/GwCcjw5rmzajLbmqGygEgaj/OLoanEWP6Y52Hflef3XLvYnhEY4kSirMQhtb
# erRvaI+5YsD3XVxHGBjlIli5u+NrLedIxsE88WzKXqZjj9Zi5ybJL2WjeXuOTbsw
# B7XjkZbErg7ebeAQUQiS/uRGZ58NHs57ZPUfECcgJC+v2wIDAQABo4IBFjCCARIw
# HwYDVR0jBBgwFoAUU3m/WqorSs9UgOHYm8Cd8rIDZsswHQYDVR0OBBYEFPZ3at0/
# /QET/xahbIICL9AKPRQlMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/
# MBMGA1UdJQQMMAoGCCsGAQUFBwMIMBEGA1UdIAQKMAgwBgYEVR0gADBQBgNVHR8E
# STBHMEWgQ6BBhj9odHRwOi8vY3JsLnVzZXJ0cnVzdC5jb20vVVNFUlRydXN0UlNB
# Q2VydGlmaWNhdGlvbkF1dGhvcml0eS5jcmwwNQYIKwYBBQUHAQEEKTAnMCUGCCsG
# AQUFBzABhhlodHRwOi8vb2NzcC51c2VydHJ1c3QuY29tMA0GCSqGSIb3DQEBDAUA
# A4ICAQAOvmVB7WhEuOWhxdQRh+S3OyWM637ayBeR7djxQ8SihTnLf2sABFoB0DFR
# 6JfWS0snf6WDG2gtCGflwVvcYXZJJlFfym1Doi+4PfDP8s0cqlDmdfyGOwMtGGzJ
# 4iImyaz3IBae91g50QyrVbrUoT0mUGQHbRcF57olpfHhQEStz5i6hJvVLFV/ueQ2
# 1SM99zG4W2tB1ExGL98idX8ChsTwbD/zIExAopoe3l6JrzJtPxj8V9rocAnLP2C8
# Q5wXVVZcbw4x4ztXLsGzqZIiRh5i111TW7HV1AtsQa6vXy633vCAbAOIaKcLAo/I
# U7sClyZUk62XD0VUnHD+YvVNvIGezjM6CRpcWed/ODiptK+evDKPU2K6synimYBa
# NH49v9Ih24+eYXNtI38byt5kIvh+8aW88WThRpv8lUJKaPn37+YHYafob9Rg7LyT
# rSYpyZoBmwRWSE4W6iPjB7wJjJpH29308ZkpKKdpkiS9WNsf/eeUtvRrtIEiSJHN
# 899L1P4l6zKVsdrUu1FX1T/ubSrsxrYJD+3f3aKg6yxdbugot06YwGXXiy5UUGZv
# Ou3lXlxA+fC13dQ5OlL2gIb5lmF6Ii8+CQOYDwXM+yd9dbmocQsHjcRPsccUd5E9
# FiswEqORvz8g3s+jR3SFCgXhN4wz7NgAnOgpCdUo4uDyllU9PzGCBJIwggSOAgEB
# MGowVTELMAkGA1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDEsMCoG
# A1UEAxMjU2VjdGlnbyBQdWJsaWMgVGltZSBTdGFtcGluZyBDQSBSMzYCEQCkKTtu
# Ht3XpzQIh616TrckMA0GCWCGSAFlAwQCAgUAoIIB+TAaBgkqhkiG9w0BCQMxDQYL
# KoZIhvcNAQkQAQQwHAYJKoZIhvcNAQkFMQ8XDTI2MDMwODA2NTM1OFowPwYJKoZI
# hvcNAQkEMTIEMNxODqm3pPmNXJcozRbA7n6b5+AC/UvaMmpk+mSqwfYLaOBM8LUx
# lhczf80hR9QEZzCCAXoGCyqGSIb3DQEJEAIMMYIBaTCCAWUwggFhMBYEFDjJFIEQ
# RLTcZj6T1HRLgUGGqbWxMIGHBBTGrlTkeIbxfD1VEkiMacNKevnC3TBvMFukWTBX
# MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMS4wLAYDVQQD
# EyVTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5nIFJvb3QgUjQ2AhB6I67aU2mW
# D5HIPlz0x+M/MIG8BBSFPWMtk4KCYXzQkDXEkd6SwULaxzCBozCBjqSBizCBiDEL
# MAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNl
# eSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMT
# JVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkCEDbCsL18Gzrn
# o7PdNsvJdWgwDQYJKoZIhvcNAQEBBQAEggIAGs8e63at8lcdfbOzHHUmM5OmMrW/
# 49PCE+k97k/8FYD2K/OM+GmBiD0Lk+areyPIIruipkvpfFPJJQVkjNP4YPoszeLD
# ZAFS9/+oHJq5sPHvSwjFxkdlfkbif72VkP2zX8mZCXhGs69bQ8n//uHk6rdqdUr1
# 2TAqPGnerS7L5GiZpP5Iw/mdjI5V1KlCYSh6PdXTmR5duLorTbKN1m7op7mMb3iq
# CZwuyeeB6t/qjQItxg+LyB7WgQJpPvRI+W1EgqZFedJMqaPbss5W7JHSKbATk3ix
# NGVHKdU76a2UzElVtHo03NHeDsEFNFg6ejlsuGhx5AjVRK2CUzOJYfDdchlQBOdk
# Cl+bw+pW+4hBCJGNwuzfo24SaoOfH/26vTnXmzlWU4wR8AdK+uY4hxPfUQKszzEL
# NcEvAHHvUSU1tepzA6WhZoOlQfsR97Ul6reRNUSaIRwcBMgJrr+pgV6yjc8epA2K
# /F0Ia8neSQAWmJTOQFRU9FJOn61KbKmtp0u8oNYoLS++7ZmLw6MIhso/SVA9skce
# /67ktpBQhlUwdOHnWZRZFKyRzToS4dChYl41gHuEYNyejt/3QxnULDjKQ+bryD6g
# NgX7qZii3LTT3b4pqTX/gZPSrhd/jj2p5rleXf0GzBsx9PzKe3YuP62ftLP6HwVh
# +DHLHueXmnXC80c=
# SIG # End signature block
