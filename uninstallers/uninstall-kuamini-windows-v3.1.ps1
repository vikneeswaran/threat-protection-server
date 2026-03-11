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

if (-not $Silent) { Write-Host "    ✓ Processes terminated" -ForegroundColor Green }

# ============================================================================
# STEP 4: UNINSTALL MSI INSTANCES
# ============================================================================

if (-not $Silent) { Write-Host "[*] Uninstalling MSI packages..." -ForegroundColor Gray }

$uninstalled = 0
$msiGUIDs = @()

# Find all Kuamini MSI entries in registry
foreach ($regPath in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)) {
    Get-ItemProperty $regPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Kuamini*" } | ForEach-Object {
        if ($_.UninstallString -match '\{([A-F0-9-]+)\}') {
            $guid = $Matches[1]
            $msiGUIDs += $guid
            
            if (-not $Silent) { Write-Host "    Uninstalling: $($_.DisplayName)" -ForegroundColor Gray }
            
            # Run MSI uninstall
            Start-Process -FilePath "msiexec.exe" `
                -ArgumentList "/x $guid /qn /norestart /l*vx `"$env:TEMP\kuamini_uninstall.log`"" `
                -Wait -NoNewWindow -ErrorAction SilentlyContinue
            
            $uninstalled++
            Start-Sleep -Milliseconds 500
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
            Write-Host "      ✓ Removed directly" -ForegroundColor Green
            $removedCount++
            continue
        }
        catch {
            Write-Host "      ⚠ Direct removal failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
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
            Write-Host "      ✓ Removed after taking ownership" -ForegroundColor Green
            $removedCount++
            continue
        }
        catch {
            Write-Host "      ⚠ Takeown strategy failed" -ForegroundColor DarkYellow
        }
    }
    
    # STRATEGY 3: Move to temp and delete
    if (Test-Path $path) {
        try {
            Write-Host "      Attempting to move to temp..." -ForegroundColor Gray
            
            $tempPath = Join-Path $env:TEMP ("kuamini_delete_" + (Get-Random))
            Move-Item $path $tempPath -Force -ErrorAction Stop
            
            Remove-Item $tempPath -Recurse -Force -ErrorAction Stop
            
            Write-Host "      ✓ Removed via temp directory" -ForegroundColor Green
            $removedCount++
            continue
        }
        catch {
            Write-Host "      ⚠ Move strategy failed" -ForegroundColor DarkYellow
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
            
            Write-Host "      ✓ Scheduled for next reboot" -ForegroundColor Yellow
            $failedPaths += $path
            continue
        }
        catch {}
    }
    
    # All strategies failed
    if (Test-Path $path) {
        Write-Host "      ✗ Could not remove" -ForegroundColor Red
        $failedPaths += $path
    }
}

if (-not $Silent) {
    Write-Host "    Summary: Removed $removedCount folder(s)" -ForegroundColor Green
}

# ============================================================================
# STEP 9: CLEAR SYSTEM TRAY
# ============================================================================

if (-not $Silent) { Write-Host "[*] Clearing system tray icons..." -ForegroundColor Gray }

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue | Out-Null
Start-Sleep -Seconds 1
Start-Process explorer.exe -ErrorAction SilentlyContinue | Out-Null

if (-not $Silent) { Write-Host "    ✓ Explorer restarted" -ForegroundColor Green }

# ============================================================================
# STEP 10: CLEAN CONTROL PANEL CACHE
# ============================================================================

if (-not $Silent) { Write-Host "[*] Cleaning Control Panel cache..." -ForegroundColor Gray }

@(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
) | ForEach-Object {
    if (Test-Path $_) {
        Get-ChildItem $_ -ErrorAction SilentlyContinue | ForEach-Object {
            $displayName = (Get-ItemProperty $_.PSPath -Name DisplayName -ErrorAction SilentlyContinue).DisplayName
            
            # Check if DisplayName contains "Kuamini" or "Security"
            if ($displayName -like "*Kuamini*" -or $displayName -like "*Security*Client*") {
                Remove-Item $_.PSPath -Force -Recurse -ErrorAction SilentlyContinue | Out-Null
            }
        }
    }
}

if (-not $Silent) { Write-Host "    ✓ Cache cleaned" -ForegroundColor Green }

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
            Write-Host "  ⚠ Processes still running ($($remainingProcs.Count))" -ForegroundColor Yellow
            foreach ($proc in $remainingProcs) {
                Write-Host "    - $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Gray
            }
        }
        
        if ($remainingFolders.Count -gt 0) {
            Write-Host "  ⚠ Folders not removed ($($remainingFolders.Count))" -ForegroundColor Yellow
            foreach ($folder in $remainingFolders) {
                Write-Host "    - $folder" -ForegroundColor Gray
            }
            Write-Host ""
            Write-Host "  SOLUTION:" -ForegroundColor Cyan
            Write-Host "    1. Restart Windows to remove remaining files" -ForegroundColor Gray
            Write-Host "    2. Or manually delete with administrator privileges" -ForegroundColor Gray
        }
        
        if ($remainingMSI.Count -gt 0) {
            Write-Host "  ⚠ MSI entries in registry ($($remainingMSI.Count))" -ForegroundColor Yellow
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
# MIIjIgYJKoZIhvcNAQcCoIIjEzCCIw8CAQExCzAJBgUrDgMCGgUAMGkGCisGAQQB
# gjcCAQSgWzBZMDQGCisGAQQBgjcCAR4wJgIDAQAABBAfzDtgWUsITrck0sYpfvNR
# AgEAAgEAAgEAAgEAAgEAMCEwCQYFKw4DAhoFAAQUhc7MWt/nTSpEwWRiVo/FRg6I
# o2Oggh3zMIIDMDCCAragAwIBAgIQN3RDT560DiIfkjbKHy8nFzAKBggqhkjOPQQD
# AzBWMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMS0wKwYD
# VQQDEyRTZWN0aWdvIFB1YmxpYyBDb2RlIFNpZ25pbmcgUm9vdCBFNDYwHhcNMjEw
# MzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBXMQswCQYDVQQGEwJHQjEYMBYGA1UE
# ChMPU2VjdGlnbyBMaW1pdGVkMS4wLAYDVQQDEyVTZWN0aWdvIFB1YmxpYyBDb2Rl
# IFNpZ25pbmcgQ0EgRVYgRTM2MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3mMV
# 9nNViYoH4aSrPwFjpbbeXHw2pMbqezwDGb45uEZQr3qI9Hgt0k4R26o5upfXzJt0
# 3F8efu0rRNEs4yDDz6OCAWMwggFfMB8GA1UdIwQYMBaAFM99LKCQepgd3bZehcLg
# 2hVx0uVeMB0GA1UdDgQWBBQadKQ417m2DrNb+txerj+28HM9iDAOBgNVHQ8BAf8E
# BAMCAYYwEgYDVR0TAQH/BAgwBgEB/wIBADATBgNVHSUEDDAKBggrBgEFBQcDAzAa
# BgNVHSAEEzARMAYGBFUdIAAwBwYFZ4EMAQMwSwYDVR0fBEQwQjBAoD6gPIY6aHR0
# cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdvUHVibGljQ29kZVNpZ25pbmdSb290
# RTQ2LmNybDB7BggrBgEFBQcBAQRvMG0wRgYIKwYBBQUHMAKGOmh0dHA6Ly9jcnQu
# c2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY0NvZGVTaWduaW5nUm9vdEU0Ni5wN2Mw
# IwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28uY29tMAoGCCqGSM49BAMD
# A2gAMGUCMQCger3L4CYx2W7HyHzvLaAnNee9QVqOwOrBYZyyqXERLtZg1DscsdoY
# Z2gszEW3zaUCMAaLtcwdoV35ADpru29wChS7kFgXt599Ex27wmL++uJCJth6xYr3
# nyF2b2YJDAatOzCCA7swggNioAMCAQICEQDi7iMpwUlypg+Lsc82RvD6MAoGCCqG
# SM49BAMCMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQx
# LjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYw
# HhcNMjYwMzA0MDAwMDAwWhcNMjcwMjI3MjM1OTU5WjCBujEPMA0GA1UEBRMGMjA5
# MTAyMRMwEQYLKwYBBAGCNzwCAQMTAklOMR0wGwYDVQQPExRQcml2YXRlIE9yZ2Fu
# aXphdGlvbjELMAkGA1UEBhMCSU4xEjAQBgNVBAgMCUthcm5hdGFrYTEoMCYGA1UE
# CgwfS3VhbWluaSBTeXN0ZW1zIFByaXZhdGUgTGltaXRlZDEoMCYGA1UEAwwfS3Vh
# bWluaSBTeXN0ZW1zIFByaXZhdGUgTGltaXRlZDB2MBAGByqGSM49AgEGBSuBBAAi
# A2IABFczEyMT1UzZcI8xthpA6NSehi4DOxjKe+exKH8t9OHLzz6p/+bOqDiUsO6M
# /wFtgm9mrkk+jTw1U31yeFcIxsY7PJm51f5jmA9304BdoL8fqKETm5P45N0OpI1R
# 2e2+76OCAYwwggGIMB8GA1UdIwQYMBaAFBp0pDjXubYOs1v63F6uP7bwcz2IMB0G
# A1UdDgQWBBT2c3dZxgpW+QeBYsOmADelqfc0+TAOBgNVHQ8BAf8EBAMCB4AwDAYD
# VR0TAQH/BAIwADATBgNVHSUEDDAKBggrBgEFBQcDAzBJBgNVHSAEQjBAMDUGDCsG
# AQQBsjEBAgEGATAlMCMGCCsGAQUFBwIBFhdodHRwczovL3NlY3RpZ28uY29tL0NQ
# UzAHBgVngQwBAzBLBgNVHR8ERDBCMECgPqA8hjpodHRwOi8vY3JsLnNlY3RpZ28u
# Y29tL1NlY3RpZ29QdWJsaWNDb2RlU2lnbmluZ0NBRVZFMzYuY3JsMHsGCCsGAQUF
# BwEBBG8wbTBGBggrBgEFBQcwAoY6aHR0cDovL2NydC5zZWN0aWdvLmNvbS9TZWN0
# aWdvUHVibGljQ29kZVNpZ25pbmdDQUVWRTM2LmNydDAjBggrBgEFBQcwAYYXaHR0
# cDovL29jc3Auc2VjdGlnby5jb20wCgYIKoZIzj0EAwIDRwAwRAIgVPDck1CiYOPt
# dlo/JqT7cy/EN3+/TE1CX/E/vDIs9C0CIDL23jrwz4cRQMXepPry7pcGbqVa3Czp
# qqrhRHAL5uioMIIDwjCCAqqgAwIBAgIRANWzYAKJWaJ/hGXJ5rGNusswDQYJKoZI
# hvcNAQEMBQAwezELMAkGA1UEBhMCR0IxGzAZBgNVBAgMEkdyZWF0ZXIgTWFuY2hl
# c3RlcjEQMA4GA1UEBwwHU2FsZm9yZDEaMBgGA1UECgwRQ29tb2RvIENBIExpbWl0
# ZWQxITAfBgNVBAMMGEFBQSBDZXJ0aWZpY2F0ZSBTZXJ2aWNlczAeFw0yMzAyMjgw
# MDAwMDBaFw0yODEyMzEyMzU5NTlaMFYxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9T
# ZWN0aWdvIExpbWl0ZWQxLTArBgNVBAMTJFNlY3RpZ28gUHVibGljIENvZGUgU2ln
# bmluZyBSb290IEU0NjB2MBAGByqGSM49AgEGBSuBBAAiA2IABAgygQMfjzuib4FH
# jOV7ubrBabJbScAouRRYbyQzzlCbc9k7wWg5nHphzlzSIkdEq4CFqeWVrKquZliG
# Vqe4g4PMtNEOqVH4S2c5f4y5tjloNI8ZSrqOIetCuKxWnQncB6OCARIwggEOMB8G
# A1UdIwQYMBaAFKARCiM+lvEH7OKvKe+CpX/QMKS0MB0GA1UdDgQWBBTPfSygkHqY
# Hd22XoXC4NoVcdLlXjAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAT
# BgNVHSUEDDAKBggrBgEFBQcDAzAbBgNVHSAEFDASMAYGBFUdIAAwCAYGZ4EMAQQB
# MEMGA1UdHwQ8MDowOKA2oDSGMmh0dHA6Ly9jcmwuY29tb2RvY2EuY29tL0FBQUNl
# cnRpZmljYXRlU2VydmljZXMuY3JsMDQGCCsGAQUFBwEBBCgwJjAkBggrBgEFBQcw
# AYYYaHR0cDovL29jc3AuY29tb2RvY2EuY29tMA0GCSqGSIb3DQEBDAUAA4IBAQA3
# P95PqrMZSfh702kbeiCCoqPEYZFEp6eMi/N5jTpv58evyW2wD6VyKLfU+0DsadOR
# 5QLRsdU02tbzprhPwc6hJGIGm54YfQ+E6XiVyeDZq31799ITQ0PmTveZdPdwfxxR
# oLUW7vaMmpErxQTMt/+j9XUAC74+Jo8bI2TNKyWwMg7msc80yWN9zgkWH7gRuKZG
# SWw02lj4XMCKE86mKDjiDEvZYzGG0hh/InEgV9O8WOTPxi7XOX5mGaC44I8WZFbx
# VtpwBt71wlcmqNP58ahN7/VTJZgKiuhcvjqcAzr0Hfp+tlJBmiF4KFosnIpz6wM5
# +LTTFsE7JcIl+5kojtHfMIIFjTCCBHWgAwIBAgIQDpsYjvnQLefv21DiCEAYWjAN
# BgkqhkiG9w0BAQwFADBlMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQg
# SW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQuY29tMSQwIgYDVQQDExtEaWdpQ2Vy
# dCBBc3N1cmVkIElEIFJvb3QgQ0EwHhcNMjIwODAxMDAwMDAwWhcNMzExMTA5MjM1
# OTU5WjBiMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYD
# VQQLExB3d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVk
# IFJvb3QgRzQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC/5pBzaN67
# 5F1KPDAiMGkz7MKnJS7JIT3yithZwuEppz1Yq3aaza57G4QNxDAf8xukOBbrVsaX
# bR2rsnnyyhHS5F/WBTxSD1Ifxp4VpX6+n6lXFllVcq9ok3DCsrp1mWpzMpTREEQQ
# Lt+C8weE5nQ7bXHiLQwb7iDVySAdYyktzuxeTsiT+CFhmzTrBcZe7FsavOvJz82s
# NEBfsXpm7nfISKhmV1efVFiODCu3T6cw2Vbuyntd463JT17lNecxy9qTXtyOj4Da
# tpGYQJB5w3jHtrHEtWoYOAMQjdjUN6QuBX2I9YI+EJFwq1WCQTLX2wRzKm6RAXwh
# TNS8rhsDdV14Ztk6MUSaM0C/CNdaSaTC5qmgZ92kJ7yhTzm1EVgX9yRcRo9k98Fp
# iHaYdj1ZXUJ2h4mXaXpI8OCiEhtmmnTK3kse5w5jrubU75KSOp493ADkRSWJtppE
# GSt+wJS00mFt6zPZxd9LBADMfRyVw4/3IbKyEbe7f/LVjHAsQWCqsWMYRJUadmJ+
# 9oCw++hkpjPRiQfhvbfmQ6QYuKZ3AeEPlAwhHbJUKSWJbOUOUlFHdL4mrLZBdd56
# rF+NP8m800ERElvlEFDrMcXKchYiCd98THU/Y+whX8QgUWtvsauGi0/C1kVfnSD8
# oR7FwI+isX4KJpn15GkvmB0t9dmpsh3lGwIDAQABo4IBOjCCATYwDwYDVR0TAQH/
# BAUwAwEB/zAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5nP+e6mK4cD08wHwYDVR0jBBgw
# FoAUReuir/SSy4IxLVGLp6chnfNtyA8wDgYDVR0PAQH/BAQDAgGGMHkGCCsGAQUF
# BwEBBG0wazAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMEMG
# CCsGAQUFBzAChjdodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRB
# c3N1cmVkSURSb290Q0EuY3J0MEUGA1UdHwQ+MDwwOqA4oDaGNGh0dHA6Ly9jcmwz
# LmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEFzc3VyZWRJRFJvb3RDQS5jcmwwEQYDVR0g
# BAowCDAGBgRVHSAAMA0GCSqGSIb3DQEBDAUAA4IBAQBwoL9DXFXnOF+go3QbPbYW
# 1/e/Vwe9mqyhhyzshV6pGrsi+IcaaVQi7aSId229GhT0E0p6Ly23OO/0/4C5+KH3
# 8nLeJLxSA8hO0Cre+i1Wz/n096wwepqLsl7Uz9FDRJtDIeuWcqFItJnLnU+nBgMT
# dydE1Od/6Fmo8L8vC6bp8jQ87PcDx4eo0kxAGTVGamlUsLihVo7spNU96LHc/RzY
# 9HdaXFSMb++hUD38dglohJ9vytsgjTVgHAIDyyCwrFigDkBjxZgiwbJZ9VVrzyer
# bHbObyMt9H5xaiNrIv8SuFQtJ37YOtnwtoeW/VvRXKwYw02fc7cBqZ9Xql4o4rmU
# MIIGtDCCBJygAwIBAgIQDcesVwX/IZkuQEMiDDpJhjANBgkqhkiG9w0BAQsFADBi
# MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
# d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3Qg
# RzQwHhcNMjUwNTA3MDAwMDAwWhcNMzgwMTE0MjM1OTU5WjBpMQswCQYDVQQGEwJV
# UzEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xQTA/BgNVBAMTOERpZ2lDZXJ0IFRy
# dXN0ZWQgRzQgVGltZVN0YW1waW5nIFJTQTQwOTYgU0hBMjU2IDIwMjUgQ0ExMIIC
# IjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtHgx0wqYQXK+PEbAHKx126NG
# aHS0URedTa2NDZS1mZaDLFTtQ2oRjzUXMmxCqvkbsDpz4aH+qbxeLho8I6jY3xL1
# IusLopuW2qftJYJaDNs1+JH7Z+QdSKWM06qchUP+AbdJgMQB3h2DZ0Mal5kYp77j
# YMVQXSZH++0trj6Ao+xh/AS7sQRuQL37QXbDhAktVJMQbzIBHYJBYgzWIjk8eDrY
# hXDEpKk7RdoX0M980EpLtlrNyHw0Xm+nt5pnYJU3Gmq6bNMI1I7Gb5IBZK4ivbVC
# iZv7PNBYqHEpNVWC2ZQ8BbfnFRQVESYOszFI2Wv82wnJRfN20VRS3hpLgIR4hjzL
# 0hpoYGk81coWJ+KdPvMvaB0WkE/2qHxJ0ucS638ZxqU14lDnki7CcoKCz6eum5A1
# 9WZQHkqUJfdkDjHkccpL6uoG8pbF0LJAQQZxst7VvwDDjAmSFTUms+wV/FbWBqi7
# fTJnjq3hj0XbQcd8hjj/q8d6ylgxCZSKi17yVp2NL+cnT6Toy+rN+nM8M7LnLqCr
# O2JP3oW//1sfuZDKiDEb1AQ8es9Xr/u6bDTnYCTKIsDq1BtmXUqEG1NqzJKS4kOm
# xkYp2WyODi7vQTCBZtVFJfVZ3j7OgWmnhFr4yUozZtqgPrHRVHhGNKlYzyjlroPx
# ul+bgIspzOwbtmsgY1MCAwEAAaOCAV0wggFZMBIGA1UdEwEB/wQIMAYBAf8CAQAw
# HQYDVR0OBBYEFO9vU0rp5AZ8esrikFb2L9RJ7MtOMB8GA1UdIwQYMBaAFOzX44LS
# cV1kTN8uZz/nupiuHA9PMA4GA1UdDwEB/wQEAwIBhjATBgNVHSUEDDAKBggrBgEF
# BQcDCDB3BggrBgEFBQcBAQRrMGkwJAYIKwYBBQUHMAGGGGh0dHA6Ly9vY3NwLmRp
# Z2ljZXJ0LmNvbTBBBggrBgEFBQcwAoY1aHR0cDovL2NhY2VydHMuZGlnaWNlcnQu
# Y29tL0RpZ2lDZXJ0VHJ1c3RlZFJvb3RHNC5jcnQwQwYDVR0fBDwwOjA4oDagNIYy
# aHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0RpZ2lDZXJ0VHJ1c3RlZFJvb3RHNC5j
# cmwwIAYDVR0gBBkwFzAIBgZngQwBBAIwCwYJYIZIAYb9bAcBMA0GCSqGSIb3DQEB
# CwUAA4ICAQAXzvsWgBz+Bz0RdnEwvb4LyLU0pn/N0IfFiBowf0/Dm1wGc/Do7oVM
# Y2mhXZXjDNJQa8j00DNqhCT3t+s8G0iP5kvN2n7Jd2E4/iEIUBO41P5F448rSYJ5
# 9Ib61eoalhnd6ywFLerycvZTAz40y8S4F3/a+Z1jEMK/DMm/axFSgoR8n6c3nuZB
# 9BfBwAQYK9FHaoq2e26MHvVY9gCDA/JYsq7pGdogP8HRtrYfctSLANEBfHU16r3J
# 05qX3kId+ZOczgj5kjatVB+NdADVZKON/gnZruMvNYY2o1f4MXRJDMdTSlOLh0HC
# n2cQLwQCqjFbqrXuvTPSegOOzr4EWj7PtspIHBldNE2K9i697cvaiIo2p61Ed2p8
# xMJb82Yosn0z4y25xUbI7GIN/TpVfHIqQ6Ku/qjTY6hc3hsXMrS+U0yy+GWqAXam
# 4ToWd2UQ1KYT70kZjE4YtL8Pbzg0c1ugMZyZZd/BdHLiRu7hAWE6bTEm4XYRkA6T
# l4KSFLFk43esaUeqGkH/wyW4N7OigizwJWeukcyIPbAvjSabnf7+Pu0VrFgoiovR
# Diyx3zEdmcif/sYQsfch28bZeUz2rtY/9TCA6TD8dC3JE3rYkrhLULy7Dc90G6e8
# BlqmyIjlgp2+VqsS9/wQD7yFylIz0scmbKvFoW2jNrbM1pD2T7m3XDCCBu0wggTV
# oAMCAQICEAqA7xhLjfEFgtHEdqeVdGgwDQYJKoZIhvcNAQELBQAwaTELMAkGA1UE
# BhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0LCBJbmMuMUEwPwYDVQQDEzhEaWdpQ2Vy
# dCBUcnVzdGVkIEc0IFRpbWVTdGFtcGluZyBSU0E0MDk2IFNIQTI1NiAyMDI1IENB
# MTAeFw0yNTA2MDQwMDAwMDBaFw0zNjA5MDMyMzU5NTlaMGMxCzAJBgNVBAYTAlVT
# MRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjE7MDkGA1UEAxMyRGlnaUNlcnQgU0hB
# MjU2IFJTQTQwOTYgVGltZXN0YW1wIFJlc3BvbmRlciAyMDI1IDEwggIiMA0GCSqG
# SIb3DQEBAQUAA4ICDwAwggIKAoICAQDQRqwtEsae0OquYFazK1e6b1H/hnAKAd/K
# N8wZQjBjMqiZ3xTWcfsLwOvRxUwXcGx8AUjni6bz52fGTfr6PHRNv6T7zsf1Y/E3
# IU8kgNkeECqVQ+3bzWYesFtkepErvUSbf+EIYLkrLKd6qJnuzK8Vcn0DvbDMemQF
# oxQ2Dsw4vEjoT1FpS54dNApZfKY61HAldytxNM89PZXUP/5wWWURK+IfxiOg8W9l
# KMqzdIo7VA1R0V3Zp3DjjANwqAf4lEkTlCDQ0/fKJLKLkzGBTpx6EYevvOi7XOc4
# zyh1uSqgr6UnbksIcFJqLbkIXIPbcNmA98Oskkkrvt6lPAw/p4oDSRZreiwB7x9y
# krjS6GS3NR39iTTFS+ENTqW8m6THuOmHHjQNC3zbJ6nJ6SXiLSvw4Smz8U07hqF+
# 8CTXaETkVWz0dVVZw7knh1WZXOLHgDvundrAtuvz0D3T+dYaNcwafsVCGZKUhQPL
# 1naFKBy1p6llN3QgshRta6Eq4B40h5avMcpi54wm0i2ePZD5pPIssoszQyF4//3D
# oK2O65Uck5Wggn8O2klETsJ7u8xEehGifgJYi+6I03UuT1j7FnrqVrOzaQoVJOee
# StPeldYRNMmSF3voIgMFtNGh86w3ISHNm0IaadCKCkUe2LnwJKa8TIlwCUNVwppw
# n4D3/Pt5pwIDAQABo4IBlTCCAZEwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQU5Dv8
# 8jHt/f3X85FxYxlQQ89hjOgwHwYDVR0jBBgwFoAU729TSunkBnx6yuKQVvYv1Ens
# y04wDgYDVR0PAQH/BAQDAgeAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMIGVBggr
# BgEFBQcBAQSBiDCBhTAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQu
# Y29tMF0GCCsGAQUFBzAChlFodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGln
# aUNlcnRUcnVzdGVkRzRUaW1lU3RhbXBpbmdSU0E0MDk2U0hBMjU2MjAyNUNBMS5j
# cnQwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0Rp
# Z2lDZXJ0VHJ1c3RlZEc0VGltZVN0YW1waW5nUlNBNDA5NlNIQTI1NjIwMjVDQTEu
# Y3JsMCAGA1UdIAQZMBcwCAYGZ4EMAQQCMAsGCWCGSAGG/WwHATANBgkqhkiG9w0B
# AQsFAAOCAgEAZSqt8RwnBLmuYEHs0QhEnmNAciH45PYiT9s1i6UKtW+FERp8FgXR
# GQ/YAavXzWjZhY+hIfP2JkQ38U+wtJPBVBajYfrbIYG+Dui4I4PCvHpQuPqFgqp1
# PzC/ZRX4pvP/ciZmUnthfAEP1HShTrY+2DE5qjzvZs7JIIgt0GCFD9ktx0LxxtRQ
# 7vllKluHWiKk6FxRPyUPxAAYH2Vy1lNM4kzekd8oEARzFAWgeW3az2xejEWLNN4e
# KGxDJ8WDl/FQUSntbjZ80FU3i54tpx5F/0Kr15zW/mJAxZMVBrTE2oi0fcI8VMbt
# oRAmaaslNXdCG1+lqvP4FbrQ6IwSBXkZagHLhFU9HCrG/syTRLLhAezu/3Lr00Gr
# JzPQFnCEH1Y58678IgmfORBPC1JKkYaEt2OdDh4GmO0/5cHelAK2/gTlQJINqDr6
# JfwyYHXSd+V08X1JUPvB4ILfJdmL+66Gp3CSBXG6IwXMZUXBhtCyIaehr0XkBoDI
# GMUG1dUtwq1qmcwbdUfcSYCn+OwncVUXf53VJUNOaMWMts0VlRYxe5nK+At+DI96
# HAlXHAL5SlfYxJ7La54i71McVWRP66bW+yERNpbJCjyCYG2j+bdpxo/1Cy4uPcU3
# AWVPGrbn5PhDBf3Froguzzhk++ami+r3Qrx5bIbY3TVzgiFI7Gq3zWcxggSZMIIE
# lQIBATBsMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQx
# LjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYC
# EQDi7iMpwUlypg+Lsc82RvD6MAkGBSsOAwIaBQCgeDAYBgorBgEEAYI3AgEMMQow
# CKACgAChAoAAMBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisGAQQBgjcC
# AQsxDjAMBgorBgEEAYI3AgEVMCMGCSqGSIb3DQEJBDEWBBSiZGUTJt1aFJES7QWa
# 5/JD9LuzyTALBgcqhkjOPQIBBQAEZjBkAjBkZPD4PmFQPXAVOmb/3UnhVLHG/MeM
# lhW+KdHbpRD81UVxnYxVTrtARlkdMzpc2P0CMHxs58WshjMfjNdPgwjPCOG5PnMT
# FL16ve1Guwwz2ZDYxDYhhe+fn/kX8n1MvKdZBKGCAyYwggMiBgkqhkiG9w0BCQYx
# ggMTMIIDDwIBATB9MGkxCzAJBgNVBAYTAlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwg
# SW5jLjFBMD8GA1UEAxM4RGlnaUNlcnQgVHJ1c3RlZCBHNCBUaW1lU3RhbXBpbmcg
# UlNBNDA5NiBTSEEyNTYgMjAyNSBDQTECEAqA7xhLjfEFgtHEdqeVdGgwDQYJYIZI
# AWUDBAIBBQCgaTAYBgkqhkiG9w0BCQMxCwYJKoZIhvcNAQcBMBwGCSqGSIb3DQEJ
# BTEPFw0yNjAzMTExMzAyNDhaMC8GCSqGSIb3DQEJBDEiBCDUalGe5dzGvQoh5JZP
# pMKYn9IAazGsPZvHON8alFGvwDANBgkqhkiG9w0BAQEFAASCAgB5hTO7a7KiFLEL
# cBLxMfc2nywG2A2opyZIiNYQ8CYea8W8b6IoGE3FsRvSiyrbl8/cqU0KoPH5zCH7
# rz54lOOwnNMEwfjF2cClSUeWAJ8sfWUCxWPZrofKjYeA82a2p6zq3vD+GouhANrW
# LihLpZ/lrbbvz4raw0abhWNbRllB/paYP0/xVEzo0ciw4Inc9KgSAL0kRYafZMDQ
# umwb/Q6R1jmCxEMHQFNjGapoz5BNsa2JFotThF9BQsdK9X++upIgg9wVzadY2skx
# vlLpO9yQSACF8vLF81QjUDbQimkkZov2gwnIsn49wRIHTokoJLDdaFRFwpj4pg6u
# YGt0lYTtY/GgkON+ykn/cCzStUFy7dP32glUxuCA5a/fWW8YseQgIEJsKWc5b5Kw
# ji8ccTKcyAQeZv6x28oZ6QeNBAT8tqGjJpFAM9llndUtNliQDPUvlnvGC3MiO8vw
# 1SyVMEQ7nmLk2JStQVnnChu+C7QP8on4Xb4teuKykdxBXYItUO9bc5Cj7TSHSQfn
# CH6YuoPCu83rvQWo6vQHvzc8Ap9UGKy0SWMlzK79Z2+0hMWWgQVLknb1mzFLz1+V
# 4EGnO2pOk8uiMOZolinmTq+CPzn2RmoYXHhdW8yzoJ02HZPR/UGANb1mXMhE9ZuU
# 17NDqw+lb5XzQMS7szwHxDamkpTaXA==
# SIG # End signature block
