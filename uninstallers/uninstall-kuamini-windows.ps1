# Kuamini Security Client Uninstaller for Windows
# Comprehensive uninstaller with error handling and verification

param(
    [switch]$Silent,
    [switch]$SkipDeregister
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Color output functions
function Write-Step { param($msg) if (-not $Silent) { Write-Host "➤ $msg" -ForegroundColor Cyan } }
function Write-Success { param($msg) if (-not $Silent) { Write-Host "  ✓ $msg" -ForegroundColor Green } }
function Write-Warning { param($msg) if (-not $Silent) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow } }
function Write-Error { param($msg) if (-not $Silent) { Write-Host "  ✗ $msg" -ForegroundColor Red } }
function Write-Info { param($msg) if (-not $Silent) { Write-Host "  ℹ $msg" -ForegroundColor Gray } }

if (-not $Silent) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "   Kuamini Security Client - Complete Uninstaller" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "This script requires Administrator privileges"
    Write-Info "Right-click and select 'Run as Administrator'"
    if (-not $Silent) { pause }
    exit 1
}

$uninstallSuccess = $true

# ============================================================================
# STEP 1: Find Agent Configuration
# ============================================================================
Write-Step "Finding agent configuration..."

$AGENT_ID = ""
$ACCOUNT_ID = ""
$API_BASE = "https://kuaminisystems.com/api/agent"

$CONFIG_LOCATIONS = @(
    "$env:USERPROFILE\.kuamini\config.json",
    "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json",
    "$env:APPDATA\Kuamini\config.json",
    "$env:APPDATA\.kuamini\config.json",
    "$env:ProgramData\Kuamini\config.json"
)

foreach ($configPath in $CONFIG_LOCATIONS) {
    if (Test-Path $configPath) {
        Write-Info "Found config: $configPath"
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($config.agent_id) { $AGENT_ID = $config.agent_id }
            if ($config.account_id) { $ACCOUNT_ID = $config.account_id }
            if ($config.api_base) { $API_BASE = $config.api_base }
            
            if ($AGENT_ID) {
                Write-Success "Agent ID: $AGENT_ID"
                break
            }
        } catch {
            Write-Warning "Could not parse config file"
        }
    }
}

if (-not $AGENT_ID) {
    Write-Info "No agent configuration found"
}

# ============================================================================
# STEP 2: Deregister from Console
# ============================================================================
if (-not $SkipDeregister -and $AGENT_ID) {
    Write-Step "Deregistering from console..."
    try {
        $deregisterPayload = @{ 
            agent_id = $AGENT_ID
            account_id = $ACCOUNT_ID
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$API_BASE/deregister" `
            -Method Post `
            -Body $deregisterPayload `
            -ContentType "application/json" `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        Write-Success "Successfully deregistered from console"
    } catch {
        Write-Warning "Deregister failed: $($_.Exception.Message)"
        Write-Info "Continuing with local cleanup..."
    }
} elseif ($SkipDeregister) {
    Write-Info "Skipping console deregistration (user requested)"
} else {
    Write-Info "No agent_id found, skipping deregistration"
}

# ============================================================================
# STEP 3: Uninstall via MSI (if applicable)
# ============================================================================
Write-Step "Checking for MSI installation..."

$uninstallKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$msiFound = $false
foreach ($keyPath in $uninstallKeys) {
    try {
        $apps = Get-ItemProperty $keyPath -ErrorAction SilentlyContinue | 
            Where-Object { $_.DisplayName -like "*Kuamini*" }
        
        foreach ($app in $apps) {
            $msiFound = $true
            Write-Info "Found: $($app.DisplayName) v$($app.DisplayVersion)"
            
            if ($app.UninstallString -match 'MsiExec\.exe\s+[/-]I?(\{[A-F0-9-]+\})' -or
                $app.UninstallString -match '\{([A-F0-9-]+)\}') {
                $productCode = $Matches[1]
                Write-Info "Product Code: $productCode"
                
                try {
                    Write-Info "Running MSI uninstaller (this may take a moment)..."
                    $msiProcess = Start-Process "msiexec.exe" `
                        -ArgumentList "/x $productCode /qn /norestart /L*V `"$env:TEMP\kuamini-uninstall.log`"" `
                        -Wait `
                        -PassThru `
                        -NoNewWindow
                    
                    if ($msiProcess.ExitCode -eq 0) {
                        Write-Success "MSI uninstall completed successfully"
                    } elseif ($msiProcess.ExitCode -eq 1605) {
                        Write-Warning "Product not found (may have been partially uninstalled)"
                    } else {
                        Write-Warning "MSI uninstall exited with code: $($msiProcess.ExitCode)"
                        Write-Info "Log: $env:TEMP\kuamini-uninstall.log"
                    }
                    
                    Start-Sleep -Seconds 2
                } catch {
                    Write-Warning "MSI uninstall failed: $($_.Exception.Message)"
                }
            }
        }
    } catch {
        # Ignore errors reading registry keys
    }
}

if (-not $msiFound) {
    Write-Info "No MSI installation found"
}

# ============================================================================
# STEP 4: Stop All Running Processes
# ============================================================================
Write-Step "Stopping all Kuamini processes..."

$processPatterns = @(
    "*Kuamini*",
    "*kuamini*"
)

$processNames = @(
    "KuaminiSecurityClient",
    "KuaminiAgentTray",
    "KuaminiAgent"
)

$stoppedProcesses = 0

# Try graceful termination first
foreach ($pattern in $processPatterns) {
    $processes = Get-Process | Where-Object { $_.ProcessName -like $pattern } -ErrorAction SilentlyContinue
    foreach ($proc in $processes) {
        try {
            Write-Info "Stopping process: $($proc.ProcessName) (PID: $($proc.Id))"
            $proc.CloseMainWindow() | Out-Null
            $stoppedProcesses++
        } catch {
            # Will force kill in next step
        }
    }
}

# Wait for graceful shutdown
if ($stoppedProcesses -gt 0) {
    Start-Sleep -Seconds 3
}

# Force kill any remaining processes
foreach ($pattern in $processPatterns) {
    Get-Process | Where-Object { $_.ProcessName -like $pattern } -ErrorAction SilentlyContinue | 
        ForEach-Object {
            try {
                Write-Info "Force stopping: $($_.ProcessName) (PID: $($_.Id))"
                Stop-Process -Id $_.Id -Force -ErrorAction Stop
                $stoppedProcesses++
            } catch {
                Write-Warning "Could not stop process $($_.ProcessName): $($_.Exception.Message)"
            }
        }
}

# Also target by exact name
foreach ($name in $processNames) {
    try {
        Stop-Process -Name $name -Force -ErrorAction SilentlyContinue
    } catch {
        # Ignore if process doesn't exist
    }
}

if ($stoppedProcesses -gt 0) {
    Write-Success "Stopped $stoppedProcesses process(es)"
    Start-Sleep -Seconds 2
} else {
    Write-Info "No running processes found"
}

# ============================================================================
# STEP 5: Remove Startup Entries
# ============================================================================
Write-Step "Removing startup entries..."

$startupRemoved = 0

# Registry Run keys
$runKeys = @(
    @{Path="HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"; Name="KuaminiSecurityClient"},
    @{Path="HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"; Name="KuaminiAgentTray"},
    @{Path="HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"; Name="KuaminiSecurityClient"},
    @{Path="HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"; Name="KuaminiAgentTray"}
)

foreach ($key in $runKeys) {
    try {
        if (Test-Path $key.Path) {
            $prop = Get-ItemProperty -Path $key.Path -Name $key.Name -ErrorAction SilentlyContinue
            if ($prop) {
                Remove-ItemProperty -Path $key.Path -Name $key.Name -Force -ErrorAction Stop
                Write-Info "Removed: $($key.Path)\$($key.Name)"
                $startupRemoved++
            }
        }
    } catch {
        # Ignore if property doesn't exist
    }
}

# Startup folder shortcuts
$startupFolders = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
)

foreach ($folder in $startupFolders) {
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Filter "*Kuamini*.lnk" -ErrorAction SilentlyContinue | 
            ForEach-Object {
                try {
                    Remove-Item $_.FullName -Force
                    Write-Info "Removed shortcut: $($_.Name)"
                    $startupRemoved++
                } catch {
                    Write-Warning "Could not remove: $($_.Name)"
                }
            }
    }
}

# Scheduled tasks
$taskNames = @("KuaminiSecurityClient", "KuaminiAgentTray", "KuaminiAgent")
foreach ($taskName in $taskNames) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
            Write-Info "Removed scheduled task: $taskName"
            $startupRemoved++
        }
    } catch {
        # Ignore if task doesn't exist
    }
}

if ($startupRemoved -gt 0) {
    Write-Success "Removed $startupRemoved startup entry/entries"
} else {
    Write-Info "No startup entries found"
}

# ============================================================================
# STEP 6: Remove Files and Directories
# ============================================================================
Write-Step "Removing files and directories..."

$pathsToRemove = @(
    # Program Files
    "$env:ProgramFiles\KuaminiSecurityClient",
    "$env:ProgramFiles\Kuamini",
    "${env:ProgramFiles(x86)}\KuaminiSecurityClient",
    "${env:ProgramFiles(x86)}\Kuamini",
    
    # User AppData
    "$env:LOCALAPPDATA\KuaminiSecurityClient",
    "$env:LOCALAPPDATA\Kuamini",
    "$env:APPDATA\Kuamini",
    "$env:APPDATA\.kuamini",
    "$env:USERPROFILE\.kuamini",
    
    # System-wide
    "$env:ProgramData\Kuamini",
    "$env:ProgramData\KuaminiSecurityClient"
)

$removedPaths = 0
$failedPaths = @()

foreach ($path in $pathsToRemove) {
    if (Test-Path $path) {
        try {
            Write-Info "Removing: $path"
            
            # Remove read-only attributes first
            Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue | 
                ForEach-Object { $_.Attributes = 'Normal' }
            
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
            Write-Success "Removed: $path"
            $removedPaths++
        } catch {
            Write-Warning "Could not remove: $path"
            Write-Warning "Error: $($_.Exception.Message)"
            $failedPaths += $path
            $uninstallSuccess = $false
        }
    }
}

if ($removedPaths -gt 0) {
    Write-Success "Removed $removedPaths directory/directories"
}
if ($failedPaths.Count -eq 0 -and $removedPaths -eq 0) {
    Write-Info "No files or directories found"
}

# ============================================================================
# STEP 7: Remove Registry Keys
# ============================================================================
Write-Step "Removing registry entries..."

$regKeysToRemove = @(
    "HKCU:\Software\Kuamini",
    "HKCU:\Software\KuaminiSecurityClient",
    "HKLM:\Software\Kuamini",
    "HKLM:\Software\KuaminiSecurityClient",
    "HKLM:\Software\WOW6432Node\Kuamini",
    "HKLM:\Software\WOW6432Node\KuaminiSecurityClient"
)

$removedKeys = 0
foreach ($regKey in $regKeysToRemove) {
    if (Test-Path $regKey) {
        try {
            Remove-Item -Path $regKey -Recurse -Force -ErrorAction Stop
            Write-Info "Removed: $regKey"
            $removedKeys++
        } catch {
            Write-Warning "Could not remove: $regKey"
        }
    }
}

if ($removedKeys -gt 0) {
    Write-Success "Removed $removedKeys registry key(s)"
} else {
    Write-Info "No registry keys found"
}

# ============================================================================
# STEP 8: Clear System Tray Icons
# ============================================================================
Write-Step "Clearing system tray icons..."

try {
    # Stop Explorer to clear notification area cache
    $explorerProcesses = Get-Process -Name explorer -ErrorAction SilentlyContinue
    if ($explorerProcesses) {
        Write-Info "Restarting Windows Explorer..."
        Stop-Process -Name explorer -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
        Start-Process explorer.exe
        Start-Sleep -Seconds 3
        Write-Success "Explorer restarted"
    }
} catch {
    Write-Warning "Could not restart Explorer: $($_.Exception.Message)"
}

# ============================================================================
# STEP 9: Final Verification
# ============================================================================
Write-Step "Verifying cleanup..."

$remainingIssues = @()

# Check for running processes
$remainingProcs = Get-Process | Where-Object { $_.ProcessName -like "*Kuamini*" } -ErrorAction SilentlyContinue
if ($remainingProcs) {
    $remainingIssues += "Running processes still detected"
    Write-Warning "Still running: $($remainingProcs.ProcessName -join ', ')"
}

# Check for remaining files
$criticalPaths = @(
    "$env:ProgramFiles\KuaminiSecurityClient",
    "$env:LOCALAPPDATA\KuaminiSecurityClient"
)

foreach ($path in $criticalPaths) {
    if (Test-Path $path) {
        $remainingIssues += "Directory still exists: $path"
    }
}

# ============================================================================
# Final Report
# ============================================================================
if (-not $Silent) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "                  Uninstall Summary" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

if ($remainingIssues.Count -eq 0 -and $failedPaths.Count -eq 0) {
    Write-Success "Uninstallation completed successfully!"
    Write-Info "All components have been removed"
    Write-Info "System has been cleaned"
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "✓ You can now reinstall if needed" -ForegroundColor Green
    }
    exit 0
} else {
    Write-Warning "Uninstallation completed with issues:"
    
    foreach ($issue in $remainingIssues) {
        Write-Warning "  • $issue"
    }
    
    foreach ($path in $failedPaths) {
        Write-Warning "  • Could not remove: $path"
    }
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "Recommendations:" -ForegroundColor Yellow
        Write-Host "  1. Close all programs and try uninstalling again" -ForegroundColor Gray
        Write-Host "  2. Restart your computer and run this script again" -ForegroundColor Gray
        Write-Host "  3. Check if files are locked by another process" -ForegroundColor Gray
        Write-Host ""
    }
    
    exit 1
}

if (-not $Silent) {
    Write-Host ""
    pause
}
