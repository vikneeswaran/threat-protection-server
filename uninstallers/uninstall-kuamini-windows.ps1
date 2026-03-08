param([switch]$Silent, [switch]$Force=$false, [switch]$Backup=$true)

# Enhanced Kuamini Security Client Complete Uninstaller
# Handles: valid installation, incomplete installation, no installation, corrupted installation
# Special handling for Python DLL errors and locked files
# Includes endpoint deregistration from console

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Color definitions
$colors = @{
    "Error"   = "Red"
    "Success" = "Green"
    "Warning" = "Yellow"
    "Info"    = "Cyan"
    "Debug"   = "Gray"
}

function Write-Log {
    param([string]$Msg, [string]$Type = "Info")
    if (-not $Silent) {
        $color = if ($colors.ContainsKey($Type)) { $colors[$Type] } else { "White" }
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "[$time] $Msg" -ForegroundColor $color
    }
}

function Read-ConfigFile {
    param([string]$Path)
    if (Test-Path $Path) {
        try {
            $rawBytes = [System.IO.File]::ReadAllBytes($Path)
            if ($rawBytes.Length -gt 2 -and $rawBytes[0] -eq 0xEF -and $rawBytes[1] -eq 0xBB -and $rawBytes[2] -eq 0xBF) {
                # Remove BOM - compatible with PowerShell 5.1
                $rawBytes = $rawBytes[3..($rawBytes.Length-1)]
            }
            $text = [System.Text.Encoding]::UTF8.GetString($rawBytes)
            return $text | ConvertFrom-Json
        } catch {
            Write-Log "  Could not parse config file at $Path : $_" "Warning"
            return $null
        }
    }
    return $null
}

function Invoke-EndpointDeregister {
    param([string]$EndpointId, [string]$AgentId, [string]$ApiBase)
    
    if (-not $ApiBase) {
        $ApiBase = "https://kuaminisystems.com/api/agent"
    }
    
    if (-not $EndpointId -and -not $AgentId) {
        Write-Log "  No endpoint_id or agent_id found, skipping deregistration" "Warning"
        return $null
    }
    
    try {
        $url = "$ApiBase/deregister"
        $payload = @{
            endpoint_id = $EndpointId
            agent_id = $AgentId
        } | ConvertTo-Json
        
        Write-Log "  Attempting to deregister endpoint..." "Info"
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
        
        if ($response) {
            Write-Log "    Deregistration successful" "Success"
            return $response
        }
    } catch {
        Write-Log "    Deregistration failed (endpoint may already be removed or unreachable): $_" "Warning"
    }
    
    return $null
}

# Admin check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Log "ERROR: Requires Administrator privileges" "Error"
    pause
    exit 1
}

Write-Log "====== Kuamini Security Client - Enhanced Uninstaller ======" "Info"
Write-Log "This script will remove all traces of Kuamini Security Client" "Info"
Write-Log "" "Info"

$backupPath = ""

# Phase 0: Create Backup
if ($Backup) {
    Write-Log "Phase 0: Creating backup..." "Info"
    $backupPath = "$env:TEMP\KuaminiRegistryBackup_$(Get-Date -Format 'yyyyMMdd_HHmmss').reg"
    try {
        reg export "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $backupPath /y 2>&1 | Out-Null
        Write-Log "  Backup created at: $backupPath" "Success"
    } catch {
        Write-Log "  Warning: Could not create backup" "Warning"
    }
}

# Phase 1: Kill Processes
Write-Log "Phase 1: Terminating processes..." "Info"
$killAttempts = 0

# First, disable the autostart to prevent the app from restarting itself
Write-Log "  Disabling autostart entries..." "Debug"
$runKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
)
foreach ($regPath in $runKeys) {
    if (Test-Path $regPath) {
        @("KuaminiSecurityClient", "KuaminiAgentTray", "kuamini*") | ForEach-Object {
            try {
                Remove-ItemProperty $regPath -Name $_ -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
}

for ($attempt = 1; $attempt -le 3; $attempt++) {
    Write-Log "  Attempt $attempt of 3..." "Debug"
    
    Get-Process 2>$null | Where-Object { $_.Name -like "*Kuamini*" -or $_.Name -like "*KuaminiSecurityClient*" } | ForEach-Object {
        try {
            Write-Log "    Killing: $($_.Name) (PID: $($_.Id))" "Debug"
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $killAttempts++
        } catch {}
    }
    
    taskkill /F /IM "KuaminiSecurityClient.exe" /T 2>$null | Out-Null
    taskkill /F /IM "KuaminiAgentTray.exe" /T 2>$null | Out-Null
    taskkill /F /IM "python314.exe" /T 2>$null | Out-Null
    
    Start-Sleep -Milliseconds 500
}

Write-Log "  Terminated $killAttempts process instance(s)" "Success"
Write-Log "" "Info"

# Phase 1.5: Deregister endpoint from console
Write-Log "Phase 1.5: Deregistering endpoint from console..." "Info"

$configPaths = @(
    "C:\Program Files (x86)\Kuamini Security Client\config.json",
    "C:\Program Files\Kuamini Security Client\config.json",
    "$env:APPDATA\Kuamini\config.json",
    "$env:LOCALAPPDATA\Kuamini\config.json",
    "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json",
    "$env:USERPROFILE\.kuamini\config.json"
)

$deregisterAttempted = $false
foreach ($configPath in $configPaths) {
    if (Test-Path $configPath) {
        Write-Log "  Found config at: $configPath" "Debug"
        $config = Read-ConfigFile $configPath
        
        if ($config) {
            $endpointId = $config.endpoint_id
            $agentId = $config.agent_id
            $apiBase = $config.api_base
            
            if ($endpointId -or $agentId) {
                if ($endpointId) {
                    Write-Log "  Found endpoint_id: $($endpointId.Substring(0, [Math]::Min(8, $endpointId.Length)))..." "Debug"
                }
                if ($agentId) {
                    Write-Log "  Found agent_id: $($agentId.Substring(0, [Math]::Min(8, $agentId.Length)))..." "Debug"
                }
                
                $deregResult = Invoke-EndpointDeregister -EndpointId $endpointId -AgentId $agentId -ApiBase $apiBase
                
                if ($deregResult) {
                    Write-Log "  Endpoint successfully deregistered from console" "Success"
                    
                    # Check if there are cleanup commands in the response
                    if ($deregResult.cleanup_commands) {
                        Write-Log "  Executing cleanup commands from console..." "Info"
                        foreach ($cmd in $deregResult.cleanup_commands) {
                            try {
                                Write-Log "    Executing: $cmd" "Debug"
                                Invoke-Expression $cmd -ErrorAction SilentlyContinue
                            } catch {
                                Write-Log "    Failed to execute command: $_" "Warning"
                            }
                        }
                    }
                }
                
                $deregisterAttempted = $true
                break
            }
        }
    }
}

if (-not $deregisterAttempted) {
    Write-Log "  No endpoint configuration found for deregistration" "Warning"
}
Write-Log "" "Info"

# Phase 2: Handle Python DLL Issues
Write-Log "Phase 2: Handling corrupted Python installation..." "Info"

$pythonPaths = @(
    "C:\Program Files (x86)\Kuamini Security Client\_internal",
    "C:\Program Files\Kuamini Security Client\_internal",
    "$env:APPDATA\Kuamini\_internal",
    "$env:LOCALAPPDATA\Kuamini\_internal",
    "$env:LOCALAPPDATA\KuaminiSecurityClient\_internal"
)

$dllRemoved = 0
foreach ($pyPath in $pythonPaths) {
    if (Test-Path $pyPath) {
        Write-Log "  Found Python directory: $pyPath" "Warning"
        try {
            Remove-Item $pyPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Log "    Removed" "Success"
            $dllRemoved++
        } catch {
            Write-Log "    Could not remove (will retry later): $_" "Warning"
        }
    }
}

Write-Log "" "Info"

# Phase 3: Uninstall MSI Packages
Write-Log "Phase 3: Uninstalling MSI packages..." "Info"

$msiRemoved = 0
$regHives = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)

foreach ($hive in $regHives) {
    if (Test-Path $hive) {
        $items = @(Get-ItemProperty "$hive\*" -ErrorAction SilentlyContinue)
        foreach ($item in $items) {
            if ($null -ne $item -and $null -ne $item.DisplayName) {
                if ($item.DisplayName -like "*Kuamini*" -or $item.DisplayName -like "*KuaminiSecurityClient*") {
                    if ($item.UninstallString) {
                        Write-Log "  Uninstalling: $($item.DisplayName)" "Info"
                        if ($item.UninstallString -match '\{([A-F0-9-]+)\}') {
                            $guid = $Matches[1]
                            try {
                                Start-Process msiexec.exe -ArgumentList "/x $guid /qn /norestart" -Wait -NoNewWindow -ErrorAction SilentlyContinue
                                Write-Log "    MSI uninstalled" "Success"
                                $msiRemoved++
                            } catch {
                                Write-Log "    MSI uninstall failed" "Warning"
                            }
                        }
                    }
                }
            }
        }
    }
}

if ($msiRemoved -gt 0) {
    Write-Log "  Removed $msiRemoved MSI package(s)" "Success"
} else {
    Write-Log "  No MSI packages found" "Info"
}
Write-Log "" "Info"

# Phase 4: Remove Scheduled Tasks
Write-Log "Phase 4: Removing scheduled tasks..." "Info"

$taskNames = @(
    "KuaminiSecurityClient",
    "KuaminiAgentTray",
    "KuaminiAgent",
    "KuaminiSecurityClientSetup"
)

$tasksRemoved = 0
foreach ($taskName in $taskNames) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            Write-Log "  Removing: $taskName" "Info"
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
            $tasksRemoved++
        }
    } catch {}
}

if ($tasksRemoved -gt 0) {
    Write-Log "  Removed $tasksRemoved scheduled task(s)" "Success"
} else {
    Write-Log "  No scheduled tasks found" "Info"
}
Write-Log "" "Info"

# Phase 5: Clean Startup Entries
Write-Log "Phase 5: Removing startup entries..." "Info"

$startupPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
)

$startupRemoved = 0
$startupNames = @("KuaminiSecurityClient", "KuaminiAgentTray", "KuaminiAgent", "kuamini*")

foreach ($regPath in $startupPaths) {
    if (Test-Path $regPath) {
        foreach ($name in $startupNames) {
            try {
                $prop = Get-ItemProperty $regPath -Name $name -ErrorAction SilentlyContinue
                if ($prop) {
                    Write-Log "  Removing: $regPath\$name" "Debug"
                    Remove-ItemProperty $regPath -Name $name -Force -ErrorAction SilentlyContinue
                    $startupRemoved++
                }
            } catch {}
        }
    }
}

Write-Log "  Removed $startupRemoved startup entries" "Success"
Write-Log "" "Info"

# Phase 6: Clean Registry
Write-Log "Phase 6: Cleaning Windows registry..." "Info"

$regPaths = @(
    "HKCU:\Software\Kuamini",
    "HKCU:\Software\KuaminiSecurityClient",
    "HKLM:\Software\Kuamini",
    "HKLM:\Software\KuaminiSecurityClient",
    "HKLM:\Software\WOW6432Node\Kuamini",
    "HKLM:\Software\WOW6432Node\KuaminiSecurityClient"
)

$regRemoved = 0
foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        try {
            Write-Log "  Removing: $regPath" "Debug"
            Remove-Item $regPath -Recurse -Force -ErrorAction SilentlyContinue
            $regRemoved++
        } catch {}
    }
}

# Clean Uninstall registry
$uninstallHives = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)

foreach ($hive in $uninstallHives) {
    if (Test-Path $hive) {
        $children = Get-ChildItem $hive -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            try {
                $props = Get-ItemProperty $child.PSPath -ErrorAction SilentlyContinue
                if ($props -and $props.DisplayName -like "*Kuamini*") {
                    Remove-Item $child.PSPath -Force -Recurse -ErrorAction SilentlyContinue
                    $regRemoved++
                }
            } catch {}
        }
    }
}

Write-Log "  Removed $regRemoved registry entries" "Success"
Write-Log "" "Info"

# Phase 7: Remove Files and Folders
Write-Log "Phase 7: Removing installation files..." "Info"

$installPaths = @(
    "C:\Program Files\Kuamini",
    "C:\Program Files\Kuamini Security Client",
    "C:\Program Files\KuaminiSecurityClient",
    "C:\Program Files (x86)\Kuamini",
    "C:\Program Files (x86)\Kuamini Security Client",
    "C:\Program Files (x86)\KuaminiSecurityClient",
    "$env:APPDATA\Kuamini",
    "$env:APPDATA\KuaminiSecurityClient",
    "$env:LOCALAPPDATA\Kuamini",
    "$env:LOCALAPPDATA\KuaminiSecurityClient",
    "$env:USERPROFILE\.kuamini",
    "C:\ProgramData\Kuamini",
    "C:\ProgramData\Kuamini Security Client",
    "C:\ProgramData\KuaminiSecurityClient"
)

$filesRemoved = 0
$failedPaths = @()

foreach ($path in $installPaths) {
    if (Test-Path $path) {
        Write-Log "  Processing: $path" "Debug"
        $removed = $false
        
        # Phase 7.1: Reset file attributes and try direct removal
        if (-not $removed) {
            try {
                Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                    try {
                        $_.Attributes = "Normal"
                    } catch {}
                }
                Remove-Item $path -Recurse -Force -ErrorAction Stop
                Write-Log "    Removed" "Success"
                $filesRemoved++
                $removed = $true
            } catch {
                Write-Log "    Direct removal failed, trying alternative methods..." "Warning"
            }
        }
        
        # Phase 7.2: Try robocopy mirror method
        if (-not $removed -and (Test-Path $path)) {
            try {
                $emptyDir = Join-Path $env:TEMP "kuamini_empty_$(Get-Random)"
                New-Item -ItemType Directory $emptyDir -Force -ErrorAction SilentlyContinue | Out-Null
                robocopy $emptyDir $path /MIR /NFL /NDL /NJH /NJS /NP /R:0 /W:0 2>&1 | Out-Null
                Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 200
                
                if (-not (Test-Path $path)) {
                    Write-Log "    Removed via robocopy" "Success"
                    $filesRemoved++
                    $removed = $true
                } else {
                    Write-Log "    Robocopy partial success, removing remaining folder" "Debug"
                    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
                    if (-not (Test-Path $path)) {
                        $filesRemoved++
                        $removed = $true
                    }
                }
            } catch {
                Write-Log "    Robocopy method failed: $_" "Debug"
            }
        }
        
        # Phase 7.3: Try move to temp for later deletion
        if (-not $removed -and (Test-Path $path)) {
            try {
                $tempPath = Join-Path $env:TEMP "kuamini_delete_$(Get-Random)"
                if (Test-Path $tempPath) {
                    Remove-Item $tempPath -Recurse -Force -ErrorAction SilentlyContinue
                }
                Move-Item $path $tempPath -Force -ErrorAction SilentlyContinue
                
                if (-not (Test-Path $path)) {
                    Write-Log "    Scheduled for deletion on reboot" "Warning"
                    $filesRemoved++
                    $removed = $true
                    
                    # Try to delete on next reboot using Registry
                    try {
                        $regPath = "HKLM:\System\CurrentControlSet\Control\Session Manager"
                        New-Item $regPath -Force -ErrorAction SilentlyContinue | Out-Null
                        New-ItemProperty $regPath -Name PendingFileRenameOperations -Value @("$tempPath", "") -Force -ErrorAction SilentlyContinue | Out-Null
                    } catch {}
                } else {
                    Write-Log "    Move failed, file may be locked" "Debug"
                }
            } catch {
                Write-Log "    Move to temp failed: $_" "Debug"
            }
        }
        
        # Final check
        if (-not (Test-Path $path)) {
            # Folder successfully removed
            $removed = $true
        } elseif (-not $removed) {
            $failedPaths += $path
            Write-Log "    Could not remove (may require reboot): $path" "Error"
        }
    }
}

Write-Log "  Removed $filesRemoved directory(ies)" "Success"
Write-Log "" "Info"

# Phase 8: Remove Shortcuts
Write-Log "Phase 8: Removing shortcuts..." "Info"

$shortcutPaths = @(
    "$env:PUBLIC\Desktop\*.lnk",
    "$env:USERPROFILE\Desktop\*.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\*.lnk",
    "C:\ProgramData\Microsoft\Windows\Start Menu\*.lnk"
)

$shortcutsRemoved = 0
foreach ($pattern in $shortcutPaths) {
    $shortcuts = Get-Item $pattern -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Kuamini*" }
    foreach ($shortcut in $shortcuts) {
        try {
            Remove-Item $shortcut.FullName -Force -ErrorAction SilentlyContinue
            $shortcutsRemoved++
        } catch {}
    }
}

Write-Log "  Removed $shortcutsRemoved shortcut(s)" "Success"
Write-Log "" "Info"

# Phase 9: Clean Temporary Files
Write-Log "Phase 9: Cleaning temporary files..." "Info"

$tempPatterns = @(
    "$env:TEMP\Kuamini*",
    "$env:TEMP\kuamini*",
    "$env:TEMP\*KuaminiSecurityClient*"
)

$tempRemoved = 0
foreach ($pattern in $tempPatterns) {
    $items = Get-Item $pattern -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        try {
            Remove-Item $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
            $tempRemoved++
        } catch {}
    }
}

Write-Log "  Cleaned $tempRemoved temporary item(s)" "Success"
Write-Log "" "Info"

# Phase 10: Restart Explorer
Write-Log "Phase 10: Refreshing system..." "Info"

try {
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-Process explorer.exe
    Write-Log "  System explorer restarted" "Success"
} catch {}

Write-Log "" "Info"

# Final Verification
Write-Log "====== Final Verification ======" "Info"

$remainingProcs = Get-Process | Where-Object { $_.Name -like "*Kuamini*" } -ErrorAction SilentlyContinue
$remainingMSI = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Kuamini*" }

# Also check for stale autostart entries
$staleAutostart = $false
foreach ($regPath in @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Run", "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run")) {
    if (Test-Path $regPath) {
        $props = Get-ItemProperty $regPath -ErrorAction SilentlyContinue
        if ($props."KuaminiSecurityClient" -or $props."KuaminiAgentTray") {
            Write-Log "  Found stale autostart entry, removing..." "Warning"
            Remove-ItemProperty $regPath -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty $regPath -Name "KuaminiAgentTray" -Force -ErrorAction SilentlyContinue
            $staleAutostart = $true
        }
    }
}

if (-not $remainingProcs -and -not $remainingMSI -and $failedPaths.Count -eq 0 -and -not $staleAutostart) {
    Write-Log "✓✓✓ UNINSTALLATION SUCCESSFUL ✓✓✓" "Success"
    Write-Log "All traces of Kuamini Security Client have been removed!" "Success"
    Write-Log "The system is clean and ready to use." "Success"
} else {
    Write-Log "⚠⚠⚠ UNINSTALLATION NEEDS ATTENTION ⚠⚠⚠" "Warning"
    if ($remainingProcs) {
        $count = @($remainingProcs).Count
        Write-Log "  • $count process(es) still running" "Warning"
    }
    if ($remainingMSI) {
        Write-Log "  • MSI installation entry remains" "Warning"
    }
    if ($staleAutostart) {
        Write-Log "  • Stale autostart entries found and removed" "Warning"
    }
    if ($failedPaths.Count -gt 0) {
        Write-Log "  • Could not remove $($failedPaths.Count) folder(s)" "Warning"
        foreach ($p in $failedPaths) {
            Write-Log "    $p" "Debug"
        }
    }
    Write-Log "" "Info"
    Write-Log "A system REBOOT is recommended to complete cleanup!" "Warning"
    
    if (-not $Silent) {
        $rebootChoice = Read-Host "Restart now? (Y/N)"
        if ($rebootChoice -eq 'Y' -or $rebootChoice -eq 'y') {
            Write-Log "Restarting in 30 seconds..." "Warning"
            shutdown /r /t 30 /c "Kuamini removal requires reboot"
        }
    }
}

Write-Log "" "Info"
if ($backupPath) {
    Write-Log "Backup location: $backupPath" "Info"
}
Write-Log "" "Info"

if (-not $Silent) { pause }

# SIG # Begin signature block
# MIIltgYJKoZIhvcNAQcCoIIlpzCCJaMCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCDHioNPhxX7XxEf
# aqAraCNsm6oeUSt3Vt7ek7N72H1k96CCCrkwggMwMIICtqADAgECAhA3dENPnrQO
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
# OvQd+n62UkGaIXgoWiycinPrAzn4tNMWwTslwiX7mSiO0d8xghpTMIIaTwIBATBs
# MFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLjAsBgNV
# BAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYCEQDi7iMp
# wUlypg+Lsc82RvD6MA0GCWCGSAFlAwQCAQUAoHwwEAYKKwYBBAGCNwIBDDECMAAw
# GQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisG
# AQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIKHL7pxkl93Xczp6M88gnUPDx11bDIC3
# MH4UCitdlXusMAsGByqGSM49AgEFAARnMGUCMHTLradlc8o7PbkSAQzkFGtCrAPw
# x6SaOkuQLwKUZw8EhxpZGj3/msZp2i7TRVgu7AIxANlTCtXpvLQGMX78K6i74unc
# k/ka6A0EyBacZj84eYu0GTFQekmD24mfqC5zFFkODaGCGNcwghjTBgorBgEEAYI3
# AwMBMYIYwzCCGL8GCSqGSIb3DQEHAqCCGLAwghisAgEDMQ8wDQYJYIZIAWUDBAIC
# BQAwgfcGCyqGSIb3DQEJEAEEoIHnBIHkMIHhAgEBBgorBgEEAbIxAgEBMDEwDQYJ
# YIZIAWUDBAIBBQAEIIQ7Ivl3gEZpzmGDrNpIO7OYZEvk/5W2WBfYqQigYh4DAhRO
# HiANJSGs2WxiKQpiJW1hrwFBARgPMjAyNjAzMDgwNjUzNDVaoHakdDByMQswCQYD
# VQQGEwJHQjEXMBUGA1UECBMOV2VzdCBZb3Jrc2hpcmUxGDAWBgNVBAoTD1NlY3Rp
# Z28gTGltaXRlZDEwMC4GA1UEAxMnU2VjdGlnbyBQdWJsaWMgVGltZSBTdGFtcGlu
# ZyBTaWduZXIgUjM2oIITBDCCBmIwggTKoAMCAQICEQCkKTtuHt3XpzQIh616Trck
# MA0GCSqGSIb3DQEBDAUAMFUxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdv
# IExpbWl0ZWQxLDAqBgNVBAMTI1NlY3RpZ28gUHVibGljIFRpbWUgU3RhbXBpbmcg
# Q0EgUjM2MB4XDTI1MDMyNzAwMDAwMFoXDTM2MDMyMTIzNTk1OVowcjELMAkGA1UE
# BhMCR0IxFzAVBgNVBAgTDldlc3QgWW9ya3NoaXJlMRgwFgYDVQQKEw9TZWN0aWdv
# IExpbWl0ZWQxMDAuBgNVBAMTJ1NlY3RpZ28gUHVibGljIFRpbWUgU3RhbXBpbmcg
# U2lnbmVyIFIzNjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANOElfRu
# pFN48j0QS3gSBzzclIFTZ2Gsn7BjsmBF659/kpA2Ey7NXK3MP6JdrMBNU8wdmkf+
# SSIyjX++UAYWtg3Y/uDRDyg8RxHeHRJ+0U1jHEyH5uPdk1ttiPC3x/gOxIc9P7Gn
# 3OgW7DQc4x07exZ4DX4XyaGDq5LoEmk/BdCM1IelVMKB3WA6YpZ/XYdJ9JueOXeQ
# ObSQ/dohQCGyh0FhmwkDWKZaqQBWrBwZ++zqlt+z/QYTgEnZo6dyIo2IhXXANFkC
# HutL8765NBxvolXMFWY8/reTnFxk3MajgM5NX6wzWdWsPJxYRhLxtJLSUJJ5yWRN
# w+NBqH1ezvFs4GgJ2ZqFJ+Dwqbx9+rw+F2gBdgo4j7CVomP49sS7CbqsdybbiOGp
# B9DJhs5QVMpYV73TVV3IwLiBHBECrTgUfZVOMF0KSEq2zk/LsfvehswavE3W4aBX
# JmGjgWSpcDz+6TqeTM8f1DIcgQPdz0IYgnT3yFTgiDbFGOFNt6eCidxdR6j9x+kp
# cN5RwApy4pRhE10YOV/xafBvKpRuWPjOPWRBlKdm53kS2aMh08spx7xSEqXn4QQl
# dCnUWRz3Lki+TgBlpwYwJUbR77DAayNwAANE7taBrz2v+MnnogMrvvct0iwvfIA1
# W8kp155Lo44SIfqGmrbJP6Mn+Udr3MR2oWozAgMBAAGjggGOMIIBijAfBgNVHSME
# GDAWgBRfWO1MMXqiYUKNUoC6s2GXGaIymzAdBgNVHQ4EFgQUiGGMoSo3ZIEoYKGb
# MdCM/SwCzk8wDgYDVR0PAQH/BAQDAgbAMAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/
# BAwwCgYIKwYBBQUHAwgwSgYDVR0gBEMwQTA1BgwrBgEEAbIxAQIBAwgwJTAjBggr
# BgEFBQcCARYXaHR0cHM6Ly9zZWN0aWdvLmNvbS9DUFMwCAYGZ4EMAQQCMEoGA1Ud
# HwRDMEEwP6A9oDuGOWh0dHA6Ly9jcmwuc2VjdGlnby5jb20vU2VjdGlnb1B1Ymxp
# Y1RpbWVTdGFtcGluZ0NBUjM2LmNybDB6BggrBgEFBQcBAQRuMGwwRQYIKwYBBQUH
# MAKGOWh0dHA6Ly9jcnQuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY1RpbWVTdGFt
# cGluZ0NBUjM2LmNydDAjBggrBgEFBQcwAYYXaHR0cDovL29jc3Auc2VjdGlnby5j
# b20wDQYJKoZIhvcNAQEMBQADggGBAAKBPqSGclEh+WWpLj1SiuHlm8xLE0SThI2y
# Luq+75s11y6SceBchpnKpxWaGtXc8dya1Aq3RuW//y3wMThsvT4fSba2AoSWlR67
# rA4fTYGMIhgzocsids0ct/pHaocLVJSwnTYxY2pE0hPoZAvRebctbsTqENmZHyOV
# jOFlwN2R3DRweFeNs4uyZN5LRJ5EnVYlcTOq3bl1tI5poru9WaQRWQ4eynXp7Pj0
# Fz4DKr86HYECRJMWiDjeV0QqAcQMFsIjJtrYTw7mU81qf4FBc4u4swphLeKRNyn9
# DDrd3HIMJ+CpdhSHEGleeZ5I79YDg3B3A/fmVY2GaMik1Vm+FajEMv4/EN2mmHf4
# zkOuhYZNzVm4NrWJeY4UAriLBOeVYODdA1GxFr1ycbcUEGlUecc4RCPgYySs4d00
# NNuicR4a9n7idJlevAJbha/arIYMEuUqTeRRbWkhJwMKmb9yEvppRudKyu1t6l21
# sIuIZqcpVH8oLWCxHS0LpDRF9Y4jijCCBhQwggP8oAMCAQICEHojrtpTaZYPkcg+
# XPTH4z8wDQYJKoZIhvcNAQEMBQAwVzELMAkGA1UEBhMCR0IxGDAWBgNVBAoTD1Nl
# Y3RpZ28gTGltaXRlZDEuMCwGA1UEAxMlU2VjdGlnbyBQdWJsaWMgVGltZSBTdGFt
# cGluZyBSb290IFI0NjAeFw0yMTAzMjIwMDAwMDBaFw0zNjAzMjEyMzU5NTlaMFUx
# CzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLDAqBgNVBAMT
# I1NlY3RpZ28gUHVibGljIFRpbWUgU3RhbXBpbmcgQ0EgUjM2MIIBojANBgkqhkiG
# 9w0BAQEFAAOCAY8AMIIBigKCAYEAzZjYQ0GrboIr7PYzfiY05ImM0+8iEoBUPu8m
# r4wOgYPjoiIz5vzf7d5wu8GFK1JWN5hciN9rdqOhbdxLcSVwnOTJmUGfAMQm4eXO
# ls3iQwfapEFWuOsYmBKXPNSpwZAFoLGl5y1EaGGc5LByM8wjcbSF52/Z42YaJRsP
# XY545E3QAPN2mxDh0OLozhiGgYT1xtjXVfEzYBVmfQaI5QL35cTTAjsJAp85R+KA
# sOfuL9Z7LFnjdcuPkZWjssMETFIueH69rxbFOUD64G+rUo7xFIdRAuDNvWBsv0iG
# DPGaR2nZlY24tz5fISYk1sPY4gir99aXAGnoo0vX3Okew4MsiyBn5ZnUDMKzUcQr
# pVavGacrIkmDYu/bcOUR1mVBIZ0X7P4bKf38JF7Mp7tY3LFF/h7hvBS2tgTYXlD7
# TnIMPrxyXCfB5yQq3FFoXRXM3/DvqQ4shoVWF/mwwz9xoRku05iphp22fTfjKRIV
# pm4gFT24JKspEpM8mFa9eTgKWWCvAgMBAAGjggFcMIIBWDAfBgNVHSMEGDAWgBT2
# d2rdP/0BE/8WoWyCAi/QCj0UJTAdBgNVHQ4EFgQUX1jtTDF6omFCjVKAurNhlxmi
# MpswDgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwEwYDVR0lBAww
# CgYIKwYBBQUHAwgwEQYDVR0gBAowCDAGBgRVHSAAMEwGA1UdHwRFMEMwQaA/oD2G
# O2h0dHA6Ly9jcmwuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY1RpbWVTdGFtcGlu
# Z1Jvb3RSNDYuY3JsMHwGCCsGAQUFBwEBBHAwbjBHBggrBgEFBQcwAoY7aHR0cDov
# L2NydC5zZWN0aWdvLmNvbS9TZWN0aWdvUHVibGljVGltZVN0YW1waW5nUm9vdFI0
# Ni5wN2MwIwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28uY29tMA0GCSqG
# SIb3DQEBDAUAA4ICAQAS13sgrQ41WAyegR0lWP1MLWd0r8diJiH2VVRpxqFGhnZb
# aF+IQ7JATGceTWOS+kgnMAzGYRzpm8jIcjlSQ8JtcqymKhgx1s6cFZBSfvfeoyig
# F8iCGlH+SVSo3HHr98NepjSFJTU5KSRKK+3nVSWYkSVQgJlgGh3MPcz9IWN4I/n1
# qfDGzqHCPWZ+/Mb5vVyhgaeqxLPbBIqv6cM74Nvyo1xNsllECJJrOvsrJQkajVz4
# xJwZ8blAdX5umzwFfk7K/0K3fpjgiXpqNOpXaJ+KSRW0HdE0FSDC7+ZKJJSJx78m
# n+rwEyT+A3z7Ss0gT5CpTrcmhUwIw9jbvnYuYRKxFVWjKklW3z83epDVzoWJttxF
# pujdrNmRwh1YZVIB2guAAjEQoF42H0BA7WBCueHVMDyV1e4nM9K4As7PVSNvQ8LI
# 1WRaTuGSFUd9y8F8jw22BZC6mJoB40d7SlZIYfaildlgpgbgtu6SDsek2L8qomG5
# 7Yp5qTqof0DwJ4Q4HsShvRl/59T4IJBovRwmqWafH0cIPEX7cEttS5+tXrgRtMjj
# TOp6A9l0D6xcKZtxnLqiTH9KPCy6xZEi0UDcMTww5Fl4VvoGbMG2oonuX3f1tsoH
# LaO/Fwkj3xVr3lDkmeUqivebQTvGkx5hGuJaSVQ+x60xJ/Y29RBr8Tm9XJ59AjCC
# BoIwggRqoAMCAQICEDbCsL18Gzrno7PdNsvJdWgwDQYJKoZIhvcNAQEMBQAwgYgx
# CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpOZXcgSmVyc2V5MRQwEgYDVQQHEwtKZXJz
# ZXkgQ2l0eTEeMBwGA1UEChMVVGhlIFVTRVJUUlVTVCBOZXR3b3JrMS4wLAYDVQQD
# EyVVU0VSVHJ1c3QgUlNBIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MB4XDTIxMDMy
# MjAwMDAwMFoXDTM4MDExODIzNTk1OVowVzELMAkGA1UEBhMCR0IxGDAWBgNVBAoT
# D1NlY3RpZ28gTGltaXRlZDEuMCwGA1UEAxMlU2VjdGlnbyBQdWJsaWMgVGltZSBT
# dGFtcGluZyBSb290IFI0NjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# AIid2LlFZ50d3ei5JoGaVFTAfEkFm8xaFQ/ZlBBEtEFAgXcUmanU5HYsyAhTXiDQ
# kiUvpVdYqZ1uYoZEMgtHES1l1Cc6HaqZzEbOOp6YiTx63ywTon434aXVydmhx7Dx
# 4IBrAou7hNGsKioIBPy5GMN7KmgYmuu4f92sKKjbxqohUSfjk1mJlAjthgF7Hjx4
# vvyVDQGsd5KarLW5d73E3ThobSkob2SL48LpUR/O627pDchxll+bTSv1gASn/hp6
# IuHJorEu6EopoB1CNFp/+HpTXeNARXUmdRMKbnXWflq+/g36NJXB35ZvxQw6zid6
# 1qmrlD/IbKJA6COw/8lFSPQwBP1ityZdwuCysCKZ9ZjczMqbUcLFyq6KdOpuzVDR
# 3ZUwxDKL1wCAxgL2Mpz7eZbrb/JWXiOcNzDpQsmwGQ6Stw8tTCqPumhLRPb7YkzM
# 8/6NnWH3T9ClmcGSF22LEyJYNWCHrQqYubNeKolzqUbCqhSqmr/UdUeb49zYHr7A
# LL8bAJyPDmubNqMtuaobKASBqP84uhqcRY/pjnYd+V5/dcu9ieERjiRKKsxCG1t6
# tG9oj7liwPddXEcYGOUiWLm742st50jGwTzxbMpepmOP1mLnJskvZaN5e45NuzAH
# teORlsSuDt5t4BBRCJL+5EZnnw0ezntk9R8QJyAkL6/bAgMBAAGjggEWMIIBEjAf
# BgNVHSMEGDAWgBRTeb9aqitKz1SA4dibwJ3ysgNmyzAdBgNVHQ4EFgQU9ndq3T/9
# ARP/FqFsggIv0Ao9FCUwDgYDVR0PAQH/BAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8w
# EwYDVR0lBAwwCgYIKwYBBQUHAwgwEQYDVR0gBAowCDAGBgRVHSAAMFAGA1UdHwRJ
# MEcwRaBDoEGGP2h0dHA6Ly9jcmwudXNlcnRydXN0LmNvbS9VU0VSVHJ1c3RSU0FD
# ZXJ0aWZpY2F0aW9uQXV0aG9yaXR5LmNybDA1BggrBgEFBQcBAQQpMCcwJQYIKwYB
# BQUHMAGGGWh0dHA6Ly9vY3NwLnVzZXJ0cnVzdC5jb20wDQYJKoZIhvcNAQEMBQAD
# ggIBAA6+ZUHtaES45aHF1BGH5Lc7JYzrftrIF5Ht2PFDxKKFOct/awAEWgHQMVHo
# l9ZLSyd/pYMbaC0IZ+XBW9xhdkkmUV/KbUOiL7g98M/yzRyqUOZ1/IY7Ay0YbMni
# IibJrPcgFp73WDnRDKtVutShPSZQZAdtFwXnuiWl8eFARK3PmLqEm9UsVX+55DbV
# Iz33Mbhba0HUTEYv3yJ1fwKGxPBsP/MgTECimh7eXomvMm0/GPxX2uhwCcs/YLxD
# nBdVVlxvDjHjO1cuwbOpkiJGHmLXXVNbsdXUC2xBrq9fLrfe8IBsA4hopwsCj8hT
# uwKXJlSTrZcPRVSccP5i9U28gZ7OMzoJGlxZ5384OKm0r568Mo9TYrqzKeKZgFo0
# fj2/0iHbj55hc20jfxvK3mQi+H7xpbzxZOFGm/yVQkpo+ffv5gdhp+hv1GDsvJOt
# JinJmgGbBFZIThbqI+MHvAmMmkfb3fTxmSkop2mSJL1Y2x/955S29Gu0gSJIkc3z
# 30vU/iXrMpWx2tS7UVfVP+5tKuzGtgkP7d/doqDrLF1u6Ci3TpjAZdeLLlRQZm86
# 7eVeXED58LXd1Dk6UvaAhvmWYXoiLz4JA5gPBcz7J311uahxCweNxE+xxxR3kT0W
# KzASo5G/PyDez6NHdIUKBeE3jDPs2ACc6CkJ1Sji4PKWVT0/MYIEkjCCBI4CAQEw
# ajBVMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMSwwKgYD
# VQQDEyNTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5nIENBIFIzNgIRAKQpO24e
# 3denNAiHrXpOtyQwDQYJYIZIAWUDBAICBQCgggH5MBoGCSqGSIb3DQEJAzENBgsq
# hkiG9w0BCRABBDAcBgkqhkiG9w0BCQUxDxcNMjYwMzA4MDY1MzQ1WjA/BgkqhkiG
# 9w0BCQQxMgQwWQ8mA0/WTyyiNjZvBIneRK5+QNCBSsSI7RuKrDSDB6pPs5JImcdo
# kA1CcntamHxjMIIBegYLKoZIhvcNAQkQAgwxggFpMIIBZTCCAWEwFgQUOMkUgRBE
# tNxmPpPUdEuBQYaptbEwgYcEFMauVOR4hvF8PVUSSIxpw0p6+cLdMG8wW6RZMFcx
# CzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQxLjAsBgNVBAMT
# JVNlY3RpZ28gUHVibGljIFRpbWUgU3RhbXBpbmcgUm9vdCBSNDYCEHojrtpTaZYP
# kcg+XPTH4z8wgbwEFIU9Yy2TgoJhfNCQNcSR3pLBQtrHMIGjMIGOpIGLMIGIMQsw
# CQYDVQQGEwJVUzETMBEGA1UECBMKTmV3IEplcnNleTEUMBIGA1UEBxMLSmVyc2V5
# IENpdHkxHjAcBgNVBAoTFVRoZSBVU0VSVFJVU1QgTmV0d29yazEuMCwGA1UEAxMl
# VVNFUlRydXN0IFJTQSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eQIQNsKwvXwbOuej
# s902y8l1aDANBgkqhkiG9w0BAQEFAASCAgCmLrNxNwvpU6HzOhxgle+EtS4sVjxm
# qAf/SLnHhXhYd6VCsWQhxVbH7vbeRW1oSEuMh52mFJzeNEu5IBGI/l5tj1cAFPdH
# WrVdRFW/TwklytUXOEpSbWwKcXVsZz01S22Hv9R0vNqcK+VfIyl73DtENIGUhMCb
# DXMr7DSHQpgozfWkO937yJ1WaYK4Y0R4/olCvsR3G5/kW96qIIbpzmZX1NJhYMo9
# FhBzYwZRn8c6TEigdvrO+s8HJcQoc3TomWoTf5LWgogEQftRIYaZKDPXOy3nCUm6
# lQFMWb8u3TynoAQzwsvHyc5qC9helZBLHZaplF4lkabF16uvQd4i8nfkFX/qGMrY
# E7eAGEnY1GpmBLViZ9xrOA1DCcmRKkCtUNXtuJrt0JsFpaHgXzCEptbe4ukV+rfx
# B2dJqK0o4xd/gT/R3k+ZWGqDczxe0/Avcd0wX4rePEfiqNtWgkaB7cBLbe9aiRaH
# llauohkbDXs/boZBeQPCwmF5/a8Ukjb6+nQ2HPOwibrjMyNWSzHGalvdFW0Mf8jq
# 8lhnjvVwUBqMZYrbkGwE2EYa5P5sYPtJBeEC5/+wbvekQYu8wFSOEja80KkATTeb
# +UE7ex/4cPf0PuTvDH7HDXLDEwizBpz+PUB7kLvHKepWb8sE95YWTSw2dHas2avx
# SxU/OHjYd9coQw==
# SIG # End signature block
