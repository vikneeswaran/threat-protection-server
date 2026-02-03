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
