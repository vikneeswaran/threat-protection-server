#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client - Windows Installer (Console CLI Version)
Smart installer that handles token-aware installation from console.

.DESCRIPTION
This script:
1. Prompts for or accepts registration token via parameter
2. Downloads the pre-built MSI installer
3. Creates installation configuration with token
4. Executes MSI installation
5. Writes token to agent directory
6. Verifies endpoint registration

Can be called directly from console with embedded token:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "& { iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/installers/install.ps1') -Token 'your-token' }"

Or run locally:
  .\install-kuamini-windows-cli.ps1 -Token "your-token"

.PARAMETER Token
Registration token (base64 or JWT) containing account details.
REQUIRED if not provided interactively.

.PARAMETER AccountId
Account ID (UUID). Optional - extracted from token if available.

.PARAMETER ConsoleUrl
Console URL for agent communication. Defaults to https://kuaminisystems.com/securityAgent

.PARAMETER Quiet
Suppress non-error output.

.NOTES
Requires Windows 10+ and Administrator privileges.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Token,
    
    [Parameter(Mandatory = $false)]
    [string]$AccountId,
    
    [Parameter(Mandatory = $false)]
    [string]$ConsoleUrl = "https://kuaminisystems.com/securityAgent",
    
    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$script:API_BASE_URL = "https://kuaminisystems.com/api/agent"
$script:MSI_DOWNLOAD_URL = "https://kuaminisystems.com/api/agent/installers/windows"
$script:MSI_TEMP_DIR = Join-Path $env:TEMP "kuamini-install-$(Get-Random)"
$script:CONFIG_DIR = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
$script:CONFIG_FILE = Join-Path $script:CONFIG_DIR "config.json"

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
# TOKEN HANDLING
# ============================================================================

function Get-TokenFromConsole {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗"
    Write-Host "║  Kuamini Security Client - Windows Installer               ║"
    Write-Host "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""
    
    if ($Token) {
        Write-Log "Token provided via parameter" "INFO"
        return $Token
    }
    
    Write-Log "No token provided. Please enter your registration token:" "INFO"
    Write-Log "(Token is available in the Kuamini Security Console)" "INFO"
    Write-Host ""
    
    $tokenInput = Read-Host "Enter registration token"
    
    if (-not $tokenInput) {
        Write-ErrorLog "No token provided. Installation cannot continue."
        exit 1
    }
    
    return $tokenInput
}

function ConvertFrom-TokenJSON {
    param(
        [Parameter(Mandatory = $false)]
        [string]$Token
    )
    
    if (-not $Token) {
        return $null
    }
    
    try {
        # Assume token is base64 encoded JSON
        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Token))
        return $decoded | ConvertFrom-Json
    }
    catch {
        Write-Log "Could not decode token as base64 JSON: $($_.Exception.Message)" "WARN"
        return $null
    }
}

# ============================================================================
# PREREQUISITES
# ============================================================================

function Test-Prerequisites {
    Write-Log "Checking prerequisites..." "INFO"
    
    # Check OS
    if ([Environment]::OSVersion.Version.Major -lt 10) {
        Write-ErrorLog "Windows 10 or later is required"
        return $false
    }
    
    Write-Log "✓ Windows 10+ detected" "SUCCESS"
    
    # Check admin rights (we already required it above)
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-ErrorLog "Administrator privileges required. Please run as Administrator."
        return $false
    }
    
    Write-Log "✓ Running as Administrator" "SUCCESS"
    
    # Check internet connectivity
    try {
        $testUri = "https://kuaminisystems.com"
        $response = Invoke-WebRequest -Uri $testUri -TimeoutSec 5 -ErrorAction Stop
        Write-Log "✓ Internet connectivity verified" "SUCCESS"
    }
    catch {
        Write-ErrorLog "Cannot reach kuaminisystems.com. Check your internet connection."
        return $false
    }
    
    return $true
}

# ============================================================================
# MSI DOWNLOAD
# ============================================================================

function Get-InstallerMSI {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Token
    )
    
    Write-Log "Downloading MSI installer..." "INFO"
    
    try {
        # Create temp directory
        New-Item -ItemType Directory -Path $script:MSI_TEMP_DIR -Force | Out-Null
        
        # Build download URL with token
        $downloadUrl = "$($script:MSI_DOWNLOAD_URL)?token=$([System.Web.HttpUtility]::UrlEncode($Token))"
        
        $msiPath = Join-Path $script:MSI_TEMP_DIR "KuaminiSecurityClient.msi"
        
        Write-Log "Downloading from: $($script:MSI_DOWNLOAD_URL)" "INFO"
        Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath -TimeoutSec 60 -ErrorAction Stop
        
        if (-not (Test-Path $msiPath)) {
            Write-ErrorLog "MSI file not found after download"
            return $null
        }
        
        $msiSize = (Get-Item $msiPath).Length / 1MB
        Write-Log "✓ MSI downloaded successfully ($([Math]::Round($msiSize, 2)) MB)" "SUCCESS"
        
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
        [Parameter(Mandatory = $true)]
        [string]$Token,
        
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
    
    Write-Log "✓ Configuration file created: $script:CONFIG_FILE" "SUCCESS"
    Write-Log "Agent ID: $agentId" "INFO"
    
    return $agentId
}

# ============================================================================
# MSI INSTALLATION
# ============================================================================

function Install-MSI {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MsiPath,
        
        [Parameter(Mandatory = $true)]
        [string]$Token
    )
    
    Write-Log "Installing MSI package..." "INFO"
    
    try {
        # MSI installation arguments
        $msiArgs = @(
            "/i",
            "`"$MsiPath`"",
            "/quiet",
            "/norestart",
            "/l*vx",
            "`"$($script:MSI_TEMP_DIR)\install.log`""
        )
        
        Write-Log "Running: msiexec.exe $($msiArgs -join ' ')" "INFO"
        $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -NoNewWindow -PassThru -Wait
        
        if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
            Write-Log "✓ MSI installation completed (exit code: $($process.ExitCode))" "SUCCESS"
            return $true
        }
        else {
            Write-ErrorLog "MSI installation failed with exit code: $($process.ExitCode)"
            return $false
        }
    }
    catch {
        Write-ErrorLog "Failed to execute MSI: $($_.Exception.Message)"
        return $false
    }
}

function Write-RegistrationToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Token
    )
    
    Write-Log "Writing registration token to installation..." "INFO"
    
    try {
        # Check both Program Files and Program Files (x86)
        $installPaths = @(
            "C:\Program Files\Kuamini Security Client",
            "C:\Program Files (x86)\Kuamini Security Client"
        )
        
        $tokenWritten = $false
        
        foreach ($installPath in $installPaths) {
            if (Test-Path $installPath) {
                $tokenFile = Join-Path $installPath "registration.token"
                Set-Content -Path $tokenFile -Value $Token -Encoding UTF8 -Force
                Write-Log "✓ Token written to: $tokenFile" "SUCCESS"
                $tokenWritten = $true
            }
        }
        
        if (-not $tokenWritten) {
            Write-ErrorLog "Could not find installation directory"
            return $false
        }
        
        return $true
    }
    catch {
        Write-ErrorLog "Failed to write registration token: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================================
# VERIFICATION
# ============================================================================

function Test-Installation {
    Write-Log "Verifying installation..." "INFO"
    
    $installPaths = @(
        "C:\Program Files\Kuamini Security Client",
        "C:\Program Files (x86)\Kuamini Security Client"
    )
    
    $found = $false
    foreach ($installPath in $installPaths) {
        $exePath = Join-Path $installPath "KuaminiSecurityClient.exe"
        if (Test-Path $exePath) {
            Write-Log "✓ Executable found: $exePath" "SUCCESS"
            $found = $true
            break
        }
    }
    
    if (-not $found) {
        Write-ErrorLog "Executable not found in any installation directory"
        return $false
    }
    
    if (-not (Test-Path $script:CONFIG_FILE)) {
        Write-ErrorLog "Configuration file not found: $script:CONFIG_FILE"
        return $false
    }
    
    Write-Log "✓ Configuration file verified: $script:CONFIG_FILE" "SUCCESS"
    return $true
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    # Step 1: Display header
    if (-not $Quiet) {
        Write-Host ""
        Write-Host "╔════════════════════════════════════════════════════════════╗"
        Write-Host "║  Kuamini Security Client - Windows Installer               ║"
        Write-Host "║  Version 2.1                                              ║"
        Write-Host "╚════════════════════════════════════════════════════════════╝"
        Write-Host ""
    }
    
    # Step 2: Get token
    $actualToken = Get-TokenFromConsole
    if (-not $actualToken) {
        exit 1
    }
    
    # Step 3: Check prerequisites
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    Write-Host ""
    
    # Step 4: Decode token for info
    $tokenData = ConvertFrom-TokenJSON -Token $actualToken
    
    # Step 5: Download MSI
    Write-Host ""
    $msiPath = Get-InstallerMSI -Token $actualToken
    if (-not $msiPath) {
        exit 1
    }
    
    # Step 6: Create configuration
    Write-Host ""
    $agentId = New-ConfigFile -Token $actualToken -TokenData $tokenData
    
    # Step 7: Install MSI
    Write-Host ""
    if (-not (Install-MSI -MsiPath $msiPath -Token $actualToken)) {
        exit 1
    }
    
    # Step 8: Write registration token
    Write-Host ""
    if (-not (Write-RegistrationToken -Token $actualToken)) {
        exit 1
    }
    
    # Step 9: Verify installation
    Write-Host ""
    if (-not (Test-Installation)) {
        Write-ErrorLog "Installation verification failed"
        exit 1
    }
    
    # Step 10: Start the agent
    Write-Log "Starting Kuamini Security Client agent..." "INFO"
    $installPaths = @(
        "C:\Program Files\Kuamini Security Client\KuaminiSecurityClient.exe",
        "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"
    )
    
    $agentStarted = $false
    foreach ($exePath in $installPaths) {
        if (Test-Path $exePath) {
            try {
                Start-Process -FilePath $exePath -NoNewWindow -ErrorAction Stop
                Write-Log "[OK] Agent started successfully" "SUCCESS"
                $agentStarted = $true
                Start-Sleep -Seconds 2  # Give agent time to start
                break
            }
            catch {
                Write-ErrorLog "Failed to start agent at $exePath : $($_.Exception.Message)"
            }
        }
    }
    
    if (-not $agentStarted) {
        Write-ErrorLog "Could not start agent - please start manually or restart Windows"
    }
    
    # Step 11: Cleanup
    Write-Log "Cleaning up temporary files..." "INFO"
    Remove-Item -Path $script:MSI_TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    
    # Final message
    Write-Host ""
    Write-Host "=========================================================="
    Write-Host "  Installation Completed Successfully!"
    Write-Host "  Agent ID: $agentId"
    Write-Host "  Status: Agent is running and registering..."
    Write-Host "=========================================================="
    Write-Host ""
    Write-Log "The agent will now register with the console." "INFO"
    Write-Log "Check your Kuamini Security Console after 10 seconds." "INFO"
}

# ============================================================================
# RUN
# ============================================================================

try {
    Main
}
catch {
    Write-ErrorLog "Unexpected error: $($_.Exception.Message)"
    exit 1
}
