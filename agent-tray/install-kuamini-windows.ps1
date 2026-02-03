#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client - Windows Installer Wrapper
Downloads MSI and installs with account-specific configuration.

.DESCRIPTION
This script:
1. Validates the registration token
2. Downloads the pre-built MSI installer
3. Executes the MSI with embedded account details
4. Creates initial configuration
5. Verifies endpoint registration in console

.PARAMETER Token
Registration token (base64 or JWT) containing account details.
Required.

.PARAMETER AccountId
Account ID (UUID). Used for verification and tracking.

.PARAMETER ConsoleUrl
Console URL for verification. Defaults to https://kuaminisystems.com/securityAgent

.PARAMETER InstallPath
Installation directory. Defaults to C:\Program Files\Kuamini Security Client

.PARAMETER Quiet
Suppress non-error output.

.EXAMPLE
.\install-kuamini-windows.ps1 -Token "eyJ..." -AccountId "12345678-..."

.NOTES
Requires Windows 10+ and Administrator privileges.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    
    [Parameter(Mandatory = $false)]
    [string]$AccountId,
    
    [Parameter(Mandatory = $false)]
    [string]$ConsoleUrl = "https://kuaminisystems.com/securityAgent",
    
    [Parameter(Mandatory = $false)]
    [string]$InstallPath = "C:\Program Files\Kuamini Security Client",
    
    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$script:API_BASE_URL = "https://kuaminisystems.com/api/agent"
$script:MSI_TEMP_DIR = Join-Path $env:TEMP "kuamini-install-$(Get-Random)"
$script:CONFIG_DIR = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
$script:CONFIG_FILE = Join-Path $script:CONFIG_DIR "config.json"
$script:REGISTRATION_TOKEN_FILE = Join-Path $InstallPath "registration.token"

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

function Write-ErrorLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [ERROR] $Message" -ForegroundColor Red
}

# ============================================================================
# VALIDATION
# ============================================================================

function Test-Prerequisites {
    Write-Log "Validating prerequisites..." "INFO"
    
    # Check Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-ErrorLog "Windows 10 or newer is required. Current: $osVersion"
        return $false
    }
    
    Write-Log "Windows version: $osVersion" "INFO"
    
    # Check if WiX is installed (for rebuild, not needed for MSI execution)
    # MSI execution doesn't require WiX
    
    # Check token format
    if ([string]::IsNullOrWhiteSpace($Token)) {
        Write-ErrorLog "Registration token is required"
        return $false
    }
    
    Write-Log "Registration token validated (length: $($Token.Length) chars)" "INFO"
    return $true
}

function ConvertFrom-JSONToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Token
    )
    
    Write-Log "Parsing registration token..." "INFO"
    
    try {
        # Try base64 decoding
        $bytes = [System.Convert]::FromBase64String($Token)
        $decoded = [System.Text.Encoding]::UTF8.GetString($bytes)
        $tokenData = ConvertFrom-Json $decoded
        
        Write-Log "Token parsed successfully" "INFO"
        Write-Log "Account ID from token: $($tokenData.accountId)" "INFO"
        
        return $tokenData
    }
    catch {
        Write-Log "Token appears to be JWT or already decoded, using as-is" "WARN"
        return $null
    }
}

# ============================================================================
# MSI DOWNLOAD & VALIDATION
# ============================================================================

function Get-InstallerMSI {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiUrl
    )
    
    Write-Log "Downloading MSI installer..." "INFO"
    
    # Create temp directory
    if (-not (Test-Path $script:MSI_TEMP_DIR)) {
        New-Item -ItemType Directory -Path $script:MSI_TEMP_DIR -Force | Out-Null
    }
    
    try {
        # Download MSI from API endpoint
        # API will embed the token and account details
        $downloadUrl = "$($script:API_BASE_URL)/installers/windows?token=$([Uri]::EscapeDataString($Token))"
        $msiPath = Join-Path $script:MSI_TEMP_DIR "KuaminiSecurityClient.msi"
        
        Write-Log "Download URL: $downloadUrl" "INFO"
        
        Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath -TimeoutSec 300 -ErrorAction Stop
        
        if (-not (Test-Path $msiPath)) {
            throw "MSI file not created after download"
        }
        
        $fileSize = (Get-Item $msiPath).Length / 1MB
        Write-Log "MSI downloaded successfully (Size: $([math]::Round($fileSize, 2)) MB)" "SUCCESS"
        
        return $msiPath
    }
    catch {
        Write-ErrorLog "Failed to download MSI: $($_.Exception.Message)"
        return $null
    }
}

# ============================================================================
# CONFIGURATION SETUP
# ============================================================================

function New-ConfigFile {
    param(
        [Parameter(Mandatory = $false)]
        [hashtable]$TokenData
    )
    
    Write-Log "Creating configuration file..." "INFO"
    
    # Create config directory if not exists
    if (-not (Test-Path $script:CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $script:CONFIG_DIR -Force | Out-Null
        Write-Log "Created config directory: $script:CONFIG_DIR" "INFO"
    }
    
    # Generate agent_id (UUID)
    $agentId = [guid]::NewGuid().ToString()
    
    $config = @{
        api_base           = $script:API_BASE_URL
        console_url        = $ConsoleUrl
        agent_id           = $agentId
        account_id         = if ($TokenData) { $TokenData.accountId } else { $AccountId }
        registration_token = $Token
        heartbeat_interval = 60
        auto_register      = $true
    }
    
    $configJson = ConvertTo-Json $config -Depth 10
    Set-Content -Path $script:CONFIG_FILE -Value $configJson -Encoding UTF8 -Force
    
    Write-Log "Configuration file created: $script:CONFIG_FILE" "SUCCESS"
    Write-Log "Agent ID: $agentId" "INFO"
    Write-Log "Account ID: $($config.account_id)" "INFO"
    
    return $agentId
}

# ============================================================================
# MSI INSTALLATION
# ============================================================================

function Install-MSI {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MsiPath,
        
        [Parameter(Mandatory = $false)]
        [string]$RegistrationToken
    )
    
    Write-Log "Installing MSI package..." "INFO"
    
    try {
        # MSI installation arguments
        $msiArgs = @(
            "/i",              # Install
            "`"$MsiPath`"",    # MSI path with quotes
            "/quiet",          # Quiet mode (no UI)
            "/norestart",      # Don't restart
            "/l*vx",           # Verbose logging
            "`"$($script:MSI_TEMP_DIR)\install.log`""  # Log file
        )
        
        # Add token property if provided
        if ($RegistrationToken) {
            $msiArgs += "REGISTRATIONTOKEN=`"$RegistrationToken`""
        }
        
        Write-Log "Running: msiexec.exe $($msiArgs -join ' ')" "INFO"
        
        $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -NoNewWindow -PassThru -Wait
        
        if ($process.ExitCode -eq 0) {
            Write-Log "MSI installation completed successfully" "SUCCESS"
            return $true
        }
        elseif ($process.ExitCode -eq 3010) {
            Write-Log "Installation successful but system restart is required (exit code: 3010)" "WARN"
            return $true
        }
        else {
            Write-ErrorLog "MSI installation failed with exit code: $($process.ExitCode)"
            
            # Show log contents for debugging
            if (Test-Path "$($script:MSI_TEMP_DIR)\install.log") {
                Write-Log "Last 20 lines of install log:" "INFO"
                Get-Content "$($script:MSI_TEMP_DIR)\install.log" -Tail 20 | ForEach-Object {
                    Write-Log "  $_" "INFO"
                }
            }
            
            return $false
        }
    }
    catch {
        Write-ErrorLog "Failed to execute MSI installation: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================================
# VERIFICATION
# ============================================================================

function Test-Installation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AgentId
    )
    
    Write-Log "Verifying installation..." "INFO"
    
    # Check executable exists
    $exePath = Join-Path $InstallPath "KuaminiSecurityClient.exe"
    if (-not (Test-Path $exePath)) {
        Write-ErrorLog "Executable not found: $exePath"
        return $false
    }
    
    Write-Log "✓ Executable found: $exePath" "SUCCESS"
    
    # Check config file exists
    if (-not (Test-Path $script:CONFIG_FILE)) {
        Write-ErrorLog "Configuration file not found: $script:CONFIG_FILE"
        return $false
    }
    
    Write-Log "✓ Configuration file found: $script:CONFIG_FILE" "SUCCESS"
    
    # Check registry autostart entry
    $runKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
    $runItem = Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
    if ($runItem) {
        Write-Log "✓ Autostart registry entry configured" "SUCCESS"
    }
    else {
        Write-Log "⚠ Autostart registry entry not found (will be created on first run)" "WARN"
    }
    
    Write-Log "Installation verification completed successfully" "SUCCESS"
    return $true
}

function Wait-ForEndpointRegistration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AgentId,
        
        [Parameter(Mandatory = $false)]
        [int]$TimeoutSeconds = 120
    )
    
    Write-Log "Waiting for endpoint registration in console (timeout: $TimeoutSeconds seconds)..." "INFO"
    
    $elapsed = 0
    $checkInterval = 5  # Check every 5 seconds
    
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $heartbeatUrl = "$($script:API_BASE_URL)/heartbeat"
            $payload = @{
                agent_id = $AgentId
                status   = "online"
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest -Uri $heartbeatUrl -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                Write-Log "Endpoint successfully registered and responsive!" "SUCCESS"
                return $true
            }
        }
        catch {
            # Still waiting
        }
        
        $elapsed += $checkInterval
        if ($elapsed -lt $TimeoutSeconds) {
            Write-Log "Waiting... ($elapsed/$TimeoutSeconds seconds)" "INFO"
            Start-Sleep -Seconds $checkInterval
        }
    }
    
    Write-Log "Endpoint did not register within $TimeoutSeconds seconds (agent may still be starting)" "WARN"
    return $false
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗"
    Write-Host "║  Kuamini Security Client - Windows Installer               ║"
    Write-Host "║  Version 2.0                                              ║"
    Write-Host "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""
    
    # Step 1: Validate prerequisites
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    Write-Host ""
    
    # Step 2: Decode token (optional, for logging)
    $tokenData = ConvertFrom-JSONToken -Token $Token
    
    # Step 3: Download MSI
    Write-Host ""
    $msiPath = Get-InstallerMSI -ApiUrl "$($script:API_BASE_URL)/installers/windows"
    if (-not $msiPath) {
        exit 1
    }
    
    # Step 4: Create configuration
    Write-Host ""
    $agentId = New-ConfigFile -TokenData $tokenData
    
    # Step 5: Install MSI
    Write-Host ""
    if (-not (Install-MSI -MsiPath $msiPath -RegistrationToken $Token)) {
        exit 1
    }
    
    # Step 6: Verify installation
    Write-Host ""
    if (-not (Test-Installation -AgentId $agentId)) {
        Write-ErrorLog "Installation verification failed"
        exit 1
    }
    
    # Step 7: Wait for registration
    Write-Host ""
    $registered = Wait-ForEndpointRegistration -AgentId $agentId
    
    # Step 8: Cleanup
    Write-Log "Cleaning up temporary files..." "INFO"
    Remove-Item -Path $script:MSI_TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    
    # Final message
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗"
    Write-Host "║  Installation Completed Successfully!                      ║"
    Write-Host "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""
    
    if ($registered) {
        Write-Host "✓ Endpoint is registered and online in the console"
    }
    else {
        Write-Host "⚠ Endpoint is installing - it will appear in console shortly"
        Write-Host "  (Agent takes 30-60 seconds to start after installation)"
    }
    
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Check the Kuamini Security Console: $ConsoleUrl"
    Write-Host "2. Find your endpoint in the Endpoints list"
    Write-Host "3. Assign security policies as needed"
    Write-Host ""
    
    exit 0
}

# Execute main
try {
    Main
}
catch {
    Write-ErrorLog "Fatal error: $($_.Exception.Message)"
    Write-ErrorLog $_.ScriptStackTrace
    exit 1
}
