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
    
    # Step 5.5: Write actual registration token to file (agent looks for this)
    # IMPORTANT: Determine actual install path BEFORE trying to write token
    $actualInstallPath = $null
    Write-Log "Determining installation path..." "INFO"
    
    if (Test-Path $InstallPath) {
        $actualInstallPath = $InstallPath
        Write-Log "Found installation at default path: $InstallPath" "INFO"
    }
    else {
        # Check if it was installed to x86 instead
        $x86Path = $InstallPath.Replace("Program Files", "Program Files (x86)")
        if (Test-Path $x86Path) {
            $actualInstallPath = $x86Path
            Write-Log "Found installation at x86 path: $x86Path" "INFO"
        }
    }
    
    if (-not $actualInstallPath) {
        Write-ErrorLog "Installation directory not found at either: $InstallPath or x86 variant"
        exit 1
    }
    
    Write-Log "Writing registration token to installation directory..." "INFO"
    try {
        $tokenFile = Join-Path $actualInstallPath "registration.token"
        
        # Validate token before writing
        if (-not $Token -or $Token.Trim() -eq "") {
            Write-ErrorLog "Registration token is empty or null"
            exit 1
        }
        
        Write-Log "Token length: $($Token.Length) bytes" "INFO"
        
        # Write token to file with proper encoding
        [System.IO.File]::WriteAllText($tokenFile, $Token, [System.Text.Encoding]::UTF8)
        
        # Verify write was successful
        if (-not (Test-Path $tokenFile)) {
            Write-ErrorLog "Failed to create registration.token file at $tokenFile"
            exit 1
        }
        
        # Verify content was written
        $writtenToken = [System.IO.File]::ReadAllText($tokenFile, [System.Text.Encoding]::UTF8)
        if ($writtenToken -ne $Token) {
            Write-ErrorLog "Token verification failed - written content does not match original"
            Write-Log "Original length: $($Token.Length), Written length: $($writtenToken.Length)" "WARN"
            exit 1
        }
        
        Write-Log "✓ Registration token file created/updated: $tokenFile" "SUCCESS"
        Write-Log "✓ Token verified: $($writtenToken.Length) bytes written" "SUCCESS"
    }
    catch {
        Write-ErrorLog "Failed to write registration token: $($_.Exception.Message)"
        Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
        exit 1
    }
    
    # Step 6: Verify installation
    Write-Host ""
    if (-not (Test-Installation -AgentId $agentId)) {
        Write-ErrorLog "Installation verification failed"
        exit 1
    }
    
    # Step 6.5: Start the agent immediately (no reboot required)
    Write-Host ""
    Write-Log "Starting Kuamini Security Client agent..." "INFO"
    $installPaths = @(
        $actualInstallPath,
        "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe",
        "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
    )
    
    $agentStarted = $false
    $agentExePath = $null
    foreach ($exePath in $installPaths) {
        if (Test-Path $exePath) {
            try {
                Start-Process -FilePath $exePath -NoNewWindow -ErrorAction Stop
                Write-Log "✓ Agent process started at: $exePath" "SUCCESS"
                $agentStarted = $true
                $agentExePath = $exePath
                break
            }
            catch {
                Write-ErrorLog "Failed to start agent at $exePath : $($_.Exception.Message)"
            }
        }
    }
    
    if (-not $agentStarted) {
        Write-ErrorLog "Could not start agent automatically - installation incomplete"
        Write-Log "Please restart Windows for the agent to start automatically" "WARN"
        Write-Log "To start manually, run: $($installPaths[0])" "INFO"
    }
    else {
        # Wait for agent to initialize (create config, register, etc.)
        Write-Log "Waiting for agent to initialize..." "INFO"
        $maxWaitSeconds = 30
        $waitedSeconds = 0
        $agentProcessRunning = $false
        
        do {
            Start-Sleep -Seconds 2
            $waitedSeconds += 2
            
            # Check if KuaminiSecurityClient process is still running
            $process = Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
            if ($process) {
                $agentProcessRunning = $true
                Write-Log "✓ Agent process is running (PID: $($process.Id))" "SUCCESS"
            }
            
            # Check if agent log file exists and has recent entries
            $logPath = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient\agent.log"
            if (Test-Path $logPath) {
                $logContent = Get-Content $logPath -Tail 1 -ErrorAction SilentlyContinue
                if ($logContent -match "Heartbeat successful|✓|Registration.*successful") {
                    Write-Log "✓ Agent is operational and registering" "SUCCESS"
                    $agentProcessRunning = $true
                    break
                }
            }
        } while ($waitedSeconds -lt $maxWaitSeconds -and $agentProcessRunning)
        
        if ($agentProcessRunning) {
            Write-Log "✓ Agent initialization completed successfully" "SUCCESS"
        }
        else {
            Write-Log "⚠ Agent startup verification incomplete (may be initializing in background)" "WARN"
            Write-Log "Check agent log at: $logPath" "INFO"
        }
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
    
    if ($agentStarted) {
        Write-Host "✓ Agent has been started automatically"
        Write-Host "✓ Endpoint is registering with the console..."
        
        if ($registered) {
            Write-Host "✓ Endpoint is now registered and online in the console"
        }
        else {
            Write-Host "⚠ Endpoint registration in progress (usually completes within 10 seconds)"
        }
    }
    else {
        if ($registered) {
            Write-Host "✓ Endpoint is registered and online in the console"
        }
        else {
            Write-Host "⚠ Endpoint is installing - it will appear in console after restart"
            Write-Host "  (Agent will start on next system reboot)"
        }
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
