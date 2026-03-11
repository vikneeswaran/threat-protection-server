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

# SIG # Begin signature block
# MIIjIgYJKoZIhvcNAQcCoIIjEzCCIw8CAQExCzAJBgUrDgMCGgUAMGkGCisGAQQB
# gjcCAQSgWzBZMDQGCisGAQQBgjcCAR4wJgIDAQAABBAfzDtgWUsITrck0sYpfvNR
# AgEAAgEAAgEAAgEAAgEAMCEwCQYFKw4DAhoFAAQUZ18JjamtlT2+YPuSHZ2Crr32
# ub2ggh3zMIIDMDCCAragAwIBAgIQN3RDT560DiIfkjbKHy8nFzAKBggqhkjOPQQD
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
# AQsxDjAMBgorBgEEAYI3AgEVMCMGCSqGSIb3DQEJBDEWBBS+4XK/aWy/KA9h2VrO
# 2Lsrs5opvjALBgcqhkjOPQIBBQAEZjBkAjBXqFgtNGlcArmnQMG8znK5Y+RrFS+L
# d+b3E4Po7rOLhBrsYmW5YgsyWQ3uKj4ts40CMGJvhIITYrqc/0m/mMZdaxt9WF8p
# 06bB9UzRJahJkwAkvW4/LJj5vaLI1UQyJTcIN6GCAyYwggMiBgkqhkiG9w0BCQYx
# ggMTMIIDDwIBATB9MGkxCzAJBgNVBAYTAlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwg
# SW5jLjFBMD8GA1UEAxM4RGlnaUNlcnQgVHJ1c3RlZCBHNCBUaW1lU3RhbXBpbmcg
# UlNBNDA5NiBTSEEyNTYgMjAyNSBDQTECEAqA7xhLjfEFgtHEdqeVdGgwDQYJYIZI
# AWUDBAIBBQCgaTAYBgkqhkiG9w0BCQMxCwYJKoZIhvcNAQcBMBwGCSqGSIb3DQEJ
# BTEPFw0yNjAzMTExMzAyNDJaMC8GCSqGSIb3DQEJBDEiBCBNGaQI6QN3q/jlUXN6
# v/leelG4w1zP6rZd17r7pJnfczANBgkqhkiG9w0BAQEFAASCAgCOpTcIKGESs7No
# ALnGIr1o+/VsKcyYjdWmGV5Q1EMSyBGn0cbSLbpyvYZtlCYSgdu/FcBMLiRWDFPO
# UBAZ5Gw57dqZLfT/hUOlQWAWSqGMlKrEe2TMnE0uLFTjtgCOky3SmGm2rKPCoSaM
# Aolta/BuFUm9uWCBAyYOGcrjOv9NA10iv9bq6fMQzg1jnHbCOKtuvu74Mby+BWuM
# 0qkDRkq9uycmAFjQhm7S4R21pXhZPIJwPQ/nbAgP25wLSjlp+Y1PJf1CgkfQv/Tc
# XAnoKbmd/PkkZy3+wN5lYj2QbBAdbonQPTBktpsXaVxeou5Po3aKo0RedoQfyhWR
# 3kcB6qK3G3q4h16Owg6O1JgmHyF0P8fJOecuu2ag/u7VeT3xZUK1zhcpkJ+pDnSe
# k/0FaZr3dgsNGpmFiLLA785YfT55gbfnOAJAWPXId2tvMPZKZ6DsMkaKvAd5Epwl
# Jsis1BUcsH3+JHTQV0aFD8wdXRf0TQbJSpqkG50RPeLhBBrNtGPO1qgFvHOLcLPz
# nrKWe3ekVFneY5R0TtumFuRzfKHHov0O840v7SPUVPvkY9e4hgVJoHdw9aPMl0Wp
# mUX1t631C8ofYLEjqpAXxGok6fn75/eIwyTMqTWThItuU1zoFbmvJqj8dnDGxcx5
# pG/3iaYdNDQRGrGBqzg2+Dsprtit4A==
# SIG # End signature block
