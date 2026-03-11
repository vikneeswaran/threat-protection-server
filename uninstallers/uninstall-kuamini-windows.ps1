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
# MIIjJAYJKoZIhvcNAQcCoIIjFTCCIxECAQExCzAJBgUrDgMCGgUAMGkGCisGAQQB
# gjcCAQSgWzBZMDQGCisGAQQBgjcCAR4wJgIDAQAABBAfzDtgWUsITrck0sYpfvNR
# AgEAAgEAAgEAAgEAAgEAMCEwCQYFKw4DAhoFAAQUkypzY3YgQGtyKj07PI5WM5pu
# 2Zqggh3zMIIDMDCCAragAwIBAgIQN3RDT560DiIfkjbKHy8nFzAKBggqhkjOPQQD
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
# AWVPGrbn5PhDBf3Froguzzhk++ami+r3Qrx5bIbY3TVzgiFI7Gq3zWcxggSbMIIE
# lwIBATBsMFcxCzAJBgNVBAYTAkdCMRgwFgYDVQQKEw9TZWN0aWdvIExpbWl0ZWQx
# LjAsBgNVBAMTJVNlY3RpZ28gUHVibGljIENvZGUgU2lnbmluZyBDQSBFViBFMzYC
# EQDi7iMpwUlypg+Lsc82RvD6MAkGBSsOAwIaBQCgeDAYBgorBgEEAYI3AgEMMQow
# CKACgAChAoAAMBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisGAQQBgjcC
# AQsxDjAMBgorBgEEAYI3AgEVMCMGCSqGSIb3DQEJBDEWBBRiYJJ3KuTUY1Zoa6DH
# NGofxd4v9TALBgcqhkjOPQIBBQAEaDBmAjEA/9RA28je8eXAnythoyF52Ye4LZk5
# hmIQrisPsHR2NqovqwuySIGA/2ouJ/4jdQjMAjEA+y/hVYDHKVb5qjrjGnCxc0nK
# XlgpAnfSjt/W9sDvn2HE8/MipsbGWVdnbt2oQnIhoYIDJjCCAyIGCSqGSIb3DQEJ
# BjGCAxMwggMPAgEBMH0waTELMAkGA1UEBhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0
# LCBJbmMuMUEwPwYDVQQDEzhEaWdpQ2VydCBUcnVzdGVkIEc0IFRpbWVTdGFtcGlu
# ZyBSU0E0MDk2IFNIQTI1NiAyMDI1IENBMQIQCoDvGEuN8QWC0cR2p5V0aDANBglg
# hkgBZQMEAgEFAKBpMBgGCSqGSIb3DQEJAzELBgkqhkiG9w0BBwEwHAYJKoZIhvcN
# AQkFMQ8XDTI2MDMxMTEzMDIzN1owLwYJKoZIhvcNAQkEMSIEIJC6hGFEBHviWhex
# dSNOnpgqGlsm6nmlyM3BQd1w03mIMA0GCSqGSIb3DQEBAQUABIICAH0iTLUIZnMe
# GtloR6HfSGQCoKeUyCu58fpLrgXUKJO0lzNBQGaboAeAQ9l6QSzAbh1ZwZhVSvb+
# wcTy1VfPn6UEXbTb7yiUGIjBObkJa9D8RnmUXgJhy7LYbN2Sq7qENtPDUrCM90Rn
# EH01wZauDLcyeGa1KMvZ7Hs84mvflq+W4lrCDbqRg4MhUN9LYOjSlpqJ1z3siKDX
# whpkin+heSWQVLdbjwxGuV60xKkUpVFR2nWCKRFbr6VnqQIbf5w9ZgDbxbaqLESr
# xTbZms8NeRF5gfQQi7BIsVlxztICKt8NGeYKj0UyUMDHIWSOy8MeKtwiKSzzw5e1
# XQOC2J7URZt/mAV0G0AMLTc2NH0HbTnFbYQtnPp17R3Xg4ssJ/6HVBafY7V/LcAl
# 2CJZhOepxRIKWO9dEQZHdCwI/PcDf8QIGbZ+abX6BiSJKk+fCLqg/8B1R2QHGrr6
# 06P22azEQXG+eNDjJyC3lZjhreu13e4ciRZPnts+mYZzROHO/4/18tFHI5E5D7Fj
# 0KgAh0BanuDUfORu2VEldoZ8gGRO0J1AQO3UdEenBVcvaUZf5BWHnPcv5XwNoIDl
# 3X6ZhUuE8o7Apdvpkj3V/T/F2lMpr7ssYeF+B0fX7850c0qQoS+jYrX+FCvScyW8
# XkGWWW3UjLK9/lkSCzADGQX8Rxafzten
# SIG # End signature block
