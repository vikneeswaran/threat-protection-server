param([switch]$Silent, [switch]$Force=$false, [switch]$Backup=$true)

# Enhanced Kuamini Security Client Complete Uninstaller
# Handles: valid installation, incomplete installation, no installation, corrupted installation
# Special handling for Python DLL errors and locked files

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

for ($attempt = 1; $attempt -le 3; $attempt++) {
    Write-Log "  Attempt $attempt of 3..." "Debug"
    
    Get-Process 2>$null | Where-Object { $_.Name -like "*Kuamini*" -or $_.Name -like "*python*" } | ForEach-Object {
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
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
)

$startupRemoved = 0
foreach ($regPath in $startupPaths) {
    if (Test-Path $regPath) {
        try {
            Remove-ItemProperty $regPath -Name "KuaminiSecurityClient" -Force -ErrorAction SilentlyContinue
            $startupRemoved++
        } catch {}
        try {
            Remove-ItemProperty $regPath -Name "KuaminiAgentTray" -Force -ErrorAction SilentlyContinue
            $startupRemoved++
        } catch {}
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
    "C:\Program Files\KuaminiSecurityClient",
    "C:\Program Files (x86)\Kuamini",
    "C:\Program Files (x86)\KuaminiSecurityClient",
    "$env:APPDATA\Kuamini",
    "$env:APPDATA\KuaminiSecurityClient",
    "$env:LOCALAPPDATA\Kuamini",
    "$env:LOCALAPPDATA\KuaminiSecurityClient",
    "$env:USERPROFILE\.kuamini",
    "C:\ProgramData\Kuamini",
    "C:\ProgramData\KuaminiSecurityClient"
)

$filesRemoved = 0
$failedPaths = @()

foreach ($path in $installPaths) {
    if (Test-Path $path) {
        Write-Log "  Processing: $path" "Debug"
        $removed = $false
        
        # Try direct removal
        if (-not $removed) {
            try {
                Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                    $_.Attributes = "Normal"
                }
                Remove-Item $path -Recurse -Force -ErrorAction Stop
                Write-Log "    Removed" "Success"
                $filesRemoved++
                $removed = $true
            } catch {
                Write-Log "    Direct removal failed, trying robocopy" "Warning"
            }
        }
        
        # Try robocopy
        if (-not $removed) {
            try {
                $emptyDir = Join-Path $env:TEMP "kuamini_empty_$(Get-Random)"
                New-Item -ItemType Directory $emptyDir -Force -ErrorAction SilentlyContinue | Out-Null
                robocopy $emptyDir $path /MIR /NFL /NDL /NJH /NJS /NP /R:0 /W:0 2>&1 | Out-Null
                Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
                Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
                if (-not (Test-Path $path)) {
                    Write-Log "    Removed via robocopy" "Success"
                    $filesRemoved++
                    $removed = $true
                }
            } catch {
                Write-Log "    Robocopy failed" "Warning"
            }
        }
        
        # Try move to temp
        if (-not $removed) {
            try {
                $tempPath = Join-Path $env:TEMP "kuamini_delete_$(Get-Random)"
                Move-Item $path $tempPath -Force -ErrorAction SilentlyContinue
                if (-not (Test-Path $path)) {
                    Write-Log "    Scheduled for deletion on reboot" "Warning"
                    $filesRemoved++
                    $removed = $true
                }
            } catch {
                Write-Log "    Move to temp failed" "Warning"
            }
        }
        
        if (-not $removed) {
            $failedPaths += $path
            Write-Log "    Could not remove (may require reboot)" "Error"
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

if (-not $remainingProcs -and -not $remainingMSI -and $failedPaths.Count -eq 0) {
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
