# Kuamini Security Client Post-Installation Script
# Simplified and fully balanced try/catch

$ErrorActionPreference = 'Continue'

# Prefer the directory of this script first
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Determine install location
$possibleInstallDirs = @(
    $ScriptDir,
    "$env:ProgramFiles\KuaminiSecurityClient",
    "$env:ProgramFiles\Kuamini",
    "$env:ProgramFiles\Kuamini\SecurityClient",
    "$env:ProgramW6432\KuaminiSecurityClient",
    "$env:ProgramW6432\Kuamini",
    "$env:ProgramW6432\Kuamini\SecurityClient",
    "$env:ProgramFiles(x86)\KuaminiSecurityClient",
    "$env:ProgramFiles(x86)\Kuamini",
    "$env:ProgramFiles(x86)\Kuamini\SecurityClient"
)

$InstallDir = $null
$ExePath = $null

Write-Host "Searching for installation..." -ForegroundColor Gray
foreach ($dir in $possibleInstallDirs) {
    if (Test-Path "$dir\KuaminiSecurityClient.exe") {
        $InstallDir = $dir
        $ExePath = "$dir\KuaminiSecurityClient.exe"
        break
    }
}

if (-not $InstallDir) {
    Write-Host "ERROR: Could not find KuaminiSecurityClient.exe" -ForegroundColor Red
    Write-Host "Checked:" -ForegroundColor Yellow
    $possibleInstallDirs | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    exit 1
}

$ConfigDir = "$env:USERPROFILE\.kuamini"
$ConfigFile = "$ConfigDir\config.json"

if (-not (Test-Path $ConfigDir)) {
    try { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null } catch {}
}

if (-not (Test-Path $ConfigFile)) {
    try {
        $DefaultConfig = @{
            api_base = 'https://kuaminisystems.com/api/agent'
            console_url = 'https://kuaminisystems.com/securityAgent'
            auto_register = $true
            heartbeat_interval = 60
        } | ConvertTo-Json -Depth 10
        $DefaultConfig | Set-Content -Path $ConfigFile -Encoding UTF8
    } catch {}
}

$SetupTaskName = 'KuaminiSecurityClientSetup'
$SetupScriptPath = "$InstallDir\setup-user.ps1"

$SetupScript = @'
$ErrorActionPreference = "SilentlyContinue"
$ExePath = "' + $ExePath + '"
$ConfigDir = Join-Path -Path $env:USERPROFILE -ChildPath ".kuamini"
$ConfigFile = Join-Path -Path $ConfigDir -ChildPath "config.json"

if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }

if (-not (Test-Path $ConfigFile)) {
    $DefaultConfig = @{ api_base = "https://kuaminisystems.com/api/agent"; console_url = "https://kuaminisystems.com/securityAgent"; auto_register = $true; heartbeat_interval = 60 } | ConvertTo-Json -Depth 10
    $DefaultConfig | Set-Content -Path $ConfigFile -Encoding UTF8 -Force
}

$StartupKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
if (-not (Test-Path $StartupKey)) { New-Item -Path $StartupKey -Force | Out-Null }
Set-ItemProperty -Path $StartupKey -Name "KuaminiSecurityClient" -Value "`"$ExePath`"" -Force

if (Test-Path $ExePath) { Start-Process -FilePath $ExePath -WindowStyle Hidden }

Unregister-ScheduledTask -TaskName "' + $SetupTaskName + '" -Confirm:$false -ErrorAction SilentlyContinue
'@

try {
    $SetupScript | Set-Content -Path $SetupScriptPath -Encoding UTF8 -Force
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$SetupScriptPath`""
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    $Principal = New-ScheduledTaskPrincipal -UserId (whoami) -LogonType Interactive
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $SetupTaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
    Write-Host "Setup scheduled for next user login" -ForegroundColor Green
} catch {
    Write-Host "Failed to create setup task: $_" -ForegroundColor Yellow
}

Write-Host "Starting Kuamini Security Client..." -ForegroundColor Gray
try {
    $p = Start-Process -FilePath $ExePath -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue
    if ($p) { Write-Host "Agent started (PID: $($p.Id))" -ForegroundColor Green }
} catch {
    Write-Host "Agent will start on next login" -ForegroundColor Cyan
}

Write-Host "Done. Logs: %USERPROFILE%\.kuamini\agent.log" -ForegroundColor Gray
