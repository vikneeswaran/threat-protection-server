#Requires -RunAsAdministrator
<#
.SYNOPSIS
Robust uninstaller for Kuamini Security Client on Windows.
Handles valid installations, partial installations, corrupt installations, and no installation states.
Attempts to deregister from console if online, cleans all registry/files regardless.

.DESCRIPTION
This script performs a comprehensive uninstallation with multiple phases:
1. Installation detection and validation
2. Deregistration from console (attempt only, don't fail if offline)
3. Process termination
4. Registry cleanup
5. File removal
6. Validation

.EXAMPLE
.\uninstall-kuamini-windows-robust.ps1

.NOTES
Requires Administrator privileges.
#>

param(
    [Parameter(Mandatory = $false)]
    [switch]$Force,
    
    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$script:API_BASE_URL = "https://kuaminisystems.com/api/agent"
$script:INSTALL_PATHS = @(
    "C:\Program Files\Kuamini Security Client",
    "C:\Program Files (x86)\Kuamini Security Client",
    "${env:LOCALAPPDATA}\KuaminiSecurityClient",
    "${env:ProgramFiles}\Kuamini Security Client"
)

$script:CONFIG_PATHS = @(
    "${env:LOCALAPPDATA}\KuaminiSecurityClient\config.json",
    "${env:USERPROFILE}\.kuamini\config.json"
)

$script:LOG_PATHS = @(
    "${env:LOCALAPPDATA}\KuaminiSecurityClient",
    "${env:USERPROFILE}\.kuamini"
)

# ============================================================================
# LOGGING & OUTPUT
# ============================================================================

function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = @{
        "INFO"    = "White"
        "WARN"    = "Yellow"
        "ERROR"   = "Red"
        "SUCCESS" = "Green"
    }[$Level]
    
    if (-not $Quiet) {
        Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
    }
}

# ============================================================================
# PHASE 0: INSTALLATION DETECTION
# ============================================================================

function Get-InstallationState {
    Write-Log "Detecting installation state..." "INFO"
    
    $state = @{
        "exists"        = $false
        "install_paths" = @()
        "config_path"   = $null
        "registry_keys" = @()
        "processes"     = @()
    }
    
    # Check installation directories - collect ALL matching paths
    foreach ($path in $script:INSTALL_PATHS) {
        if (Test-Path $path) {
            $state.exists = $true
            $state.install_paths += $path
            Write-Log "Found installation at: $path" "INFO"
        }
    }
    
    # Check config files
    foreach ($cfgPath in $script:CONFIG_PATHS) {
        if (Test-Path $cfgPath) {
            $state.config_path = $cfgPath
            Write-Log "Found config at: $cfgPath" "INFO"
            break
        }
    }
    
    # Check registry keys
    $regKeys = @(
        "HKCU:\Software\Kuamini",
        "HKLM:\Software\Kuamini",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KuaminiSecurityClient",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KuaminiSecurityClient"
    )
    
    foreach ($key in $regKeys) {
        if (Test-Path $key) {
            $state.registry_keys += $key
            Write-Log "Found registry key: $key" "INFO"
        }
    }
    
    # Check running processes
    $processes = @(
        Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue,
        Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*KuaminiSecurityClient*" }
    )
    
    if ($processes.Count -gt 0) {
        $state.processes = $processes
        Write-Log "Found running process(es) with PIDs: $($processes.Id -join ', ')" "WARN"
    }
    
    # Determine if installed or partial
    if ($state.exists -or $state.config_path -or $state.registry_keys.Count -gt 0) {
        Write-Log "Installation state: EXISTS (may be partial or corrupt)" "INFO"
        return $state
    }
    else {
        Write-Log "Installation state: NOT FOUND" "INFO"
        return $null
    }
}

# ============================================================================
# PHASE 1.5: DEREGISTRATION (ATTEMPT ONLY)
# ============================================================================

function Invoke-Deregistration {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$InstallState
    )
    
    Write-Log "Attempting deregistration from console..." "INFO"
    
    if (-not $InstallState.config_path) {
        Write-Log "No config file found, skipping deregistration" "WARN"
        return $false
    }
    
    try {
        $config = Get-Content $InstallState.config_path -Raw | ConvertFrom-Json
        $agentId = $config.agent_id
        
        if (-not $agentId) {
            Write-Log "No agent_id in config, skipping deregistration" "WARN"
            return $false
        }
        
        Write-Log "Sending deregister request for agent_id: $agentId" "INFO"
        
        $payload = @{
            agent_id = $agentId
        } | ConvertTo-Json
        
        $deregUrl = "$($script:API_BASE_URL)/deregister"
        $response = Invoke-WebRequest -Uri $deregUrl -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Log "Deregistration successful" "SUCCESS"
            return $true
        }
        else {
            Write-Log "Deregistration returned status: $($response.StatusCode)" "WARN"
            return $false
        }
    }
    catch [System.Net.WebException] {
        Write-Log "API unavailable - cannot deregister (continuing anyway): $($_.Exception.Message)" "WARN"
        return $false
    }
    catch {
        Write-Log "Deregistration failed (continuing anyway): $($_.Exception.Message)" "WARN"
        return $false
    }
}

# ============================================================================
# PHASE 1: PROCESS TERMINATION
# ============================================================================

function Stop-AgentProcesses {
    Write-Log "Terminating agent processes..." "INFO"
    
    $attempts = 0
    $maxAttempts = 3
    
    while ($attempts -lt $maxAttempts) {
        $attempts++
        
        # Kill main executable
        $processes = Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
        if ($processes.Count -gt 0) {
            Write-Log "Attempt ${attempts}/${maxAttempts}: Stopping KuaminiSecurityClient.exe..." "INFO"
            $processes | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
        }
        
        # Kill Python processes that might be running the agent
        $pythonProcs = @(Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*KuaminiSecurityClient*" -or
            $_.Path -like "*KuaminiSecurityClient*"
        })
        
        if ($pythonProcs.Count -gt 0) {
            Write-Log "Attempt ${attempts}/${maxAttempts}: Stopping Python processes..." "INFO"
            $pythonProcs | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
        }
        
        # Check if all processes are gone
        $remaining = @(Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue)
        if ($remaining.Count -eq 0) {
            Write-Log "All processes terminated successfully" "SUCCESS"
            return $true
        }
        
        if ($attempts -lt $maxAttempts) {
            Write-Log "Processes still running, retrying..." "WARN"
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Log "Could not terminate all processes (may be locked)" "WARN"
    return $false
}

# ============================================================================
# PHASE 2: REGISTRY CLEANUP
# ============================================================================

function Remove-RegistryKeys {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$RegistryKeys
    )
    
    Write-Log "Cleaning registry..." "INFO"
    
    foreach ($key in $RegistryKeys) {
        if (Test-Path $key) {
            try {
                Remove-Item -Path $key -Recurse -Force -ErrorAction Stop
                Write-Log "Removed: $key" "SUCCESS"
            }
            catch {
                Write-Log "Failed to remove registry key $key : $($_.Exception.Message)" "WARN"
            }
        }
    }
    
    # Also check and remove from Run registry
    $runKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
    if (Test-Path $runKey) {
        try {
            $runItem = Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
            if ($runItem) {
                Remove-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -Force -ErrorAction Stop
                Write-Log "Removed autostart registry entry" "SUCCESS"
            }
        }
        catch {
            Write-Log "Failed to remove autostart entry: $($_.Exception.Message)" "WARN"
        }
    }
}

# ============================================================================
# PHASE 3: FILE REMOVAL
# ============================================================================

function Remove-AgentFiles {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$InstallState
    )
    
    Write-Log "Removing agent files..." "INFO"
    
    # Combine all install paths with log paths for removal
    $filePaths = @($InstallState.install_paths) + $script:LOG_PATHS | Where-Object { $_ }
    
    foreach ($path in $filePaths) {
        if (Test-Path $path) {
            try {
                Write-Log "Removing: $path" "INFO"
                Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                Write-Log "Successfully removed: $path" "SUCCESS"
            }
            catch {
                # Try robocopy method for locked files
                Write-Log "Direct removal failed for $path, trying robocopy..." "WARN"
                
                try {
                    $tempDir = Join-Path $env:TEMP "kuamini-remove-$(Get-Random)"
                    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
                    & robocopy "$path" "$tempDir" /mir /e /r:1 /w:1 2>&1 | Out-Null
                    Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                    Write-Log "Successfully removed via robocopy: $path" "SUCCESS"
                }
                catch {
                    Write-Log "Could not remove $path (may be in use): $($_.Exception.Message)" "WARN"
                }
            }
        }
    }
}

# ============================================================================
# PHASE 4: MSI UNINSTALL
# ============================================================================

function Invoke-MSIUninstall {
    Write-Log "Attempting MSI uninstallation..." "INFO"
    
    try {
        # Find product code for uninstalled Kuamini
        $uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
        $products = Get-ChildItem -Path $uninstallKey -ErrorAction SilentlyContinue
        
        $kuaminiProduct = $null
        foreach ($product in $products) {
            $displayName = (Get-ItemProperty -Path $product.PSPath -Name "DisplayName" -ErrorAction SilentlyContinue).DisplayName
            if ($displayName -like "*Kuamini*") {
                $kuaminiProduct = $product.PSChildName
                Write-Log "Found MSI product: $kuaminiProduct" "INFO"
                break
            }
        }
        
        if ($kuaminiProduct) {
            Write-Log "Running MSI uninstall..." "INFO"
            $msiArgs = @("/x", $kuaminiProduct, "/quiet", "/norestart")
            $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -NoNewWindow -PassThru -Wait
            
            if ($process.ExitCode -eq 0) {
                Write-Log "MSI uninstall successful" "SUCCESS"
                return $true
            }
            else {
                Write-Log "MSI uninstall exited with code: $($process.ExitCode)" "WARN"
                return $false
            }
        }
        else {
            Write-Log "No MSI product found (may be portable installation)" "INFO"
            return $false
        }
    }
    catch {
        Write-Log "MSI uninstall failed: $($_.Exception.Message)" "WARN"
        return $false
    }
}

# ============================================================================
# PHASE 5: VALIDATION
# ============================================================================

function Test-UninstallComplete {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$InstallState
    )
    
    Write-Log "Validating uninstallation..." "INFO"
    
    $issues = @()
    
    # Check processes
    $remaining = @(Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue)
    if ($remaining.Count -gt 0) {
        $issues += "Processes still running: $($remaining.Id -join ', ')"
    }
    
    # Check ALL installation directories
    foreach ($path in $InstallState.install_paths) {
        if (Test-Path $path) {
            $issues += "Installation directory still exists: $path"
        }
    }
    
    # Also check all known install paths for any leftovers
    foreach ($path in $script:INSTALL_PATHS) {
        if ($path -notin $InstallState.install_paths -and (Test-Path $path)) {
            $issues += "Leftover installation directory found: $path"
        }
    }
    
    # Check config files
    foreach ($cfgPath in $script:CONFIG_PATHS) {
        if (Test-Path $cfgPath) {
            $issues += "Config file still exists: $cfgPath"
        }
    }
    
    # Check registry
    foreach ($key in $InstallState.registry_keys) {
        if (Test-Path $key) {
            $issues += "Registry key still exists: $key"
        }
    }
    
    # Check Run registry
    $runKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
    if (Test-Path $runKey) {
        $runItem = Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
        if ($runItem) {
            $issues += "Autostart registry entry still exists"
        }
    }
    
    if ($issues.Count -eq 0) {
        Write-Log "Validation PASSED: Uninstallation complete" "SUCCESS"
        return $true
    }
    else {
        Write-Log "Validation FAILED: Found remaining items:" "ERROR"
        foreach ($issue in $issues) {
            Write-Log "  - $issue" "ERROR"
        }
        return $false
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗"
    Write-Host "║  Kuamini Security Client - Robust Uninstaller             ║"
    Write-Host "║  Version 2.0                                              ║"
    Write-Host "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""
    
    # Phase 0: Detection
    $installState = Get-InstallationState
    
    if (-not $installState) {
        Write-Log "No installation found. Uninstallation not necessary." "SUCCESS"
        Write-Host ""
        exit 0
    }
    
    Write-Host ""
    
    if (-not $Force) {
        Write-Host "WARNING: This will remove Kuamini Security Client completely."
        $confirmation = Read-Host "Do you want to continue? (yes/no)"
        if ($confirmation -ne "yes") {
            Write-Log "Uninstallation cancelled by user" "WARN"
            exit 1
        }
    }
    
    Write-Host ""
    
    # Phase 1.5: Deregistration (attempt only)
    Invoke-Deregistration -InstallState $installState
    Start-Sleep -Seconds 1
    
    # Phase 1: Stop processes
    Write-Host ""
    Stop-AgentProcesses
    Start-Sleep -Seconds 1
    
    # Phase 2: Registry cleanup
    Write-Host ""
    if ($installState.registry_keys.Count -gt 0 -or $Force) {
        Remove-RegistryKeys -RegistryKeys $installState.registry_keys
    }
    Start-Sleep -Seconds 1
    
    # Phase 3: File removal
    Write-Host ""
    Remove-AgentFiles -InstallState $installState
    Start-Sleep -Seconds 1
    
    # Phase 4: MSI uninstall
    Write-Host ""
    Invoke-MSIUninstall
    Start-Sleep -Seconds 1
    
    # Phase 5: Validation
    Write-Host ""
    $success = Test-UninstallComplete -InstallState $installState
    
    Write-Host ""
    if ($success) {
        Write-Host "╔════════════════════════════════════════════════════════════╗"
        Write-Host "║  Uninstallation completed successfully!                    ║"
        Write-Host "║  The endpoint will be removed from the console within      ║"
        Write-Host "║  60 seconds once the heartbeat timeout is reached.         ║"
        Write-Host "╚════════════════════════════════════════════════════════════╝"
        Write-Host ""
        exit 0
    }
    else {
        Write-Host "╔════════════════════════════════════════════════════════════╗"
        Write-Host "║  Uninstallation partially complete with warnings.          ║"
        Write-Host "║  Please address the issues above manually.                 ║"
        Write-Host "╚════════════════════════════════════════════════════════════╝"
        Write-Host ""
        exit 1
    }
}

# Execute main
Main
