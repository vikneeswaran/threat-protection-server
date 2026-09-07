#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$installPath = "C:\Program Files\Kuamini Security Client"
$userConfigDirectory = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
$serviceConfigDirectory = Join-Path $env:ProgramData "KuaminiSecurityClient"

function Stop-Install {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Get-RegistrationToken {
    foreach ($name in @("registration.token", "registration_token.txt")) {
        $path = Join-Path $scriptDirectory $name
        if (Test-Path $path) {
            $token = (Get-Content $path -Raw -Encoding UTF8).Trim()
            if ($token.Length -gt 50 -and $token -ne "placeholder-token") {
                return $token
            }
        }
    }

    Stop-Install "A valid registration token was not found next to the installer."
}

function Get-InstallerMsi {
    $msi = Get-ChildItem -Path $scriptDirectory -Filter "KuaminiSecurityClient-*.msi" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $msi) {
        Stop-Install "KuaminiSecurityClient MSI was not found next to this helper."
    }
    return $msi.FullName
}

function Write-AgentConfig {
    param(
        [string]$Directory,
        [string]$Token,
        [string]$AgentId
    )

    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    $config = [ordered]@{
        api_base = "https://kuaminisystems.com/api/securityagent/agent"
        console_url = "https://kuaminisystems.com/securityAgent"
        registration_token = $Token
        agent_id = $AgentId
        auto_register = $true
        heartbeat_interval = 60
    }
    $config | ConvertTo-Json | Set-Content (Join-Path $Directory "config.json") -Encoding UTF8 -NoNewline
    Set-Content (Join-Path $Directory "registration.token") -Value $Token -Encoding UTF8 -NoNewline
}

Write-Host "Installing Kuamini Security Client v__VERSION__" -ForegroundColor Green
$token = Get-RegistrationToken
$msiPath = Get-InstallerMsi
$agentId = [guid]::NewGuid().ToString()

try {
    Write-AgentConfig -Directory $userConfigDirectory -Token $token -AgentId $agentId
    Write-AgentConfig -Directory $serviceConfigDirectory -Token $token -AgentId $agentId
} catch {
    Stop-Install "Unable to write agent configuration: $($_.Exception.Message)"
}

$msiLog = Join-Path $env:TEMP "kuamini-install-$([guid]::NewGuid()).log"
$msiArguments = @("/i", "`"$msiPath`"", "REGISTRATIONTOKEN=`"$token`"", "/passive", "/norestart", "/L*V", "`"$msiLog`"")
$process = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArguments -PassThru -Wait
if ($process.ExitCode -notin @(0, 3010)) {
    Stop-Install "MSI installation failed with exit code $($process.ExitCode). See $msiLog"
}

$agentExe = Join-Path $installPath "KuaminiSecurityClient.exe"
if (-not (Test-Path $agentExe)) {
    Stop-Install "Installed agent executable was not found at $agentExe"
}

$service = Get-Service -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
if (-not $service) {
    Stop-Install "The Kuamini Windows service was not installed. This installer package is outdated."
}

Start-Service -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
Start-Process -FilePath $agentExe -ErrorAction Stop
Write-Host "Kuamini service and tray client started successfully." -ForegroundColor Green