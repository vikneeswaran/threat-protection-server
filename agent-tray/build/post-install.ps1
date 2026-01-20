# Kuamini Security Client Post-Installation Script
# Simplified and fully balanced try/catch
# Mirrors macOS postinstall behavior: config in user home, auto-start at login

$ErrorActionPreference = 'Continue'

# Read registration token from MSI property (passed via command line or MSI UI)
$REGISTRATION_TOKEN = $env:REGISTRATION_TOKEN
if (-not $REGISTRATION_TOKEN) {
    # Try reading from command-line argument (for manual installs)
    if ($args.Count -gt 0) {
        $REGISTRATION_TOKEN = $args[0]
    }
}

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

# Get the current user's home directory for config placement
# This mirrors macOS behavior: config lives in user's home, not SYSTEM
$ConfigDir = "$env:USERPROFILE\.kuamini"
$ConfigFile = "$ConfigDir\config.json"

Write-Host "Creating config in user directory: $ConfigDir" -ForegroundColor Gray

if (-not (Test-Path $ConfigDir)) {
    try { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null } catch {}
}

if (-not (Test-Path $ConfigFile)) {
    try {
        # Decode account_id from registration token if provided
        $account_id = $null
        if ($REGISTRATION_TOKEN) {
            try {
                $cleaned = $REGISTRATION_TOKEN.Replace("`n","").Replace(" ","")
                $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($cleaned))
                $tokenObj = $decoded | ConvertFrom-Json
                $account_id = if ($tokenObj.accountId) { $tokenObj.accountId } elseif ($tokenObj.account_id) { $tokenObj.account_id } else { $null }
                Write-Host "Decoded account_id from token: $account_id" -ForegroundColor Green
            } catch {
                Write-Host "Warning: Could not decode account_id from token: $_" -ForegroundColor Yellow
            }
        }
        
        # Create config JSON without UTF-8 BOM
        $configObj = @{
            api_base = 'https://kuaminisystems.com/api/agent'
            console_url = 'https://kuaminisystems.com/securityAgent'
            auto_register = $true
            heartbeat_interval = 60
        }
        
        # Add registration_token if provided
        if ($REGISTRATION_TOKEN) {
            $configObj['registration_token'] = $REGISTRATION_TOKEN
            Write-Host "Added registration_token to config" -ForegroundColor Green
        }
        
        # Add account_id if decoded
        if ($account_id) {
            $configObj['account_id'] = $account_id
            Write-Host "Added account_id to config: $account_id" -ForegroundColor Green
        }
        
        $DefaultConfig = $configObj | ConvertTo-Json -Depth 10
        
        # Write using UTF8 encoding (no BOM) to prevent JSON parse errors
        # Use UTF8Encoding constructor with $false to explicitly disable BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($ConfigFile, $DefaultConfig, $utf8NoBom)
        Write-Host "Created config at: $ConfigFile" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Could not create config: $_" -ForegroundColor Yellow
    }
}

# Ensure startup for all users via HKLM Run (quoted path) as a safety net
$RunKeyMachine = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
try {
    if (-not (Test-Path $RunKeyMachine)) { New-Item -Path $RunKeyMachine -Force | Out-Null }
    Set-ItemProperty -Path $RunKeyMachine -Name "KuaminiSecurityClient" -Value "`"$ExePath`"" -Force
    Write-Host "Set HKLM Run entry for all users" -ForegroundColor Green
} catch {
    Write-Host "Warning: Failed to set HKLM Run entry: $_" -ForegroundColor Yellow
}

# Create scheduled task for user-context setup on next login
# This mirrors macOS LaunchAgent: runs at user login to set startup registry
$SetupTaskName = 'KuaminiSecurityClientSetup'
$SetupScriptPath = "$InstallDir\setup-user.ps1"

# Get current user for scheduled task
$CurrentUserDomain = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
if (-not $CurrentUserDomain) {
    $CurrentUserDomain = whoami
}

Write-Host "Current user context: $CurrentUserDomain" -ForegroundColor Gray

# Create the setup script that will run as the user (mirroring macOS: config + startup registry)
$SetupScript = @"
`$ErrorActionPreference = `"SilentlyContinue`"
`$ExePath = `"$ExePath`"
`$ConfigDir = Join-Path -Path `$env:USERPROFILE -ChildPath `.kuamini`
`$ConfigFile = Join-Path -Path `$ConfigDir -ChildPath `config.json`

# Ensure config directory exists for this user
if (-not (Test-Path `$ConfigDir)) {
    New-Item -ItemType Directory -Path `$ConfigDir -Force | Out-Null
}

# If config doesn't exist for this user, create default
if (-not (Test-Path `$ConfigFile)) {
    `$DefaultConfig = @{
        api_base = `"https://kuaminisystems.com/api/agent`"
        console_url = `"https://kuaminisystems.com/securityAgent`"
        auto_register = `$true
        heartbeat_interval = 60
    } | ConvertTo-Json -Depth 10
    
    [System.IO.File]::WriteAllText(`$ConfigFile, `$DefaultConfig, [System.Text.Encoding]::UTF8)
}

# Set startup registry for this user (HKCU, not HKLM)
`$StartupKey = `"HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`"
if (-not (Test-Path `$StartupKey)) {
    New-Item -Path `$StartupKey -Force | Out-Null
}
Set-ItemProperty -Path `$StartupKey -Name `"KuaminiSecurityClient`" -Value `"`\"`$ExePath`\"`" -Force

# Start the agent immediately
if (Test-Path `$ExePath) {
    try {
        Start-Process -FilePath `$ExePath -WindowStyle Hidden -ErrorAction SilentlyContinue
    } catch {}
}

# Clean up this scheduled task after running
Unregister-ScheduledTask -TaskName `"$SetupTaskName`" -Confirm:`$false -ErrorAction SilentlyContinue
"@

try {
    # Write setup script without UTF-8 BOM
    [System.IO.File]::WriteAllText($SetupScriptPath, $SetupScript, [System.Text.Encoding]::UTF8)
    
    # Create scheduled task that runs the setup script as the current user at logon
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$SetupScriptPath`""
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    
    # Run as the current user (not SYSTEM)
    $Principal = New-ScheduledTaskPrincipal -UserId $CurrentUserDomain -LogonType Interactive -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Compatibility Win7
    
    Register-ScheduledTask -TaskName $SetupTaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
    Write-Host "✅ Setup scheduled task created for user: $CurrentUserDomain" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to create setup task: $_" -ForegroundColor Yellow
}

# Start the agent immediately in user context (mirrors macOS immediate launch)
Write-Host "Starting Kuamini Security Client..." -ForegroundColor Gray
try {
    # Try to start the agent immediately
    $p = Start-Process -FilePath $ExePath -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue
    if ($p) {
        Write-Host "✅ Agent started immediately (PID: $($p.Id))" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Agent will start from scheduled task or registry startup" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Could not start immediately, will load on next login" -ForegroundColor Cyan
}

Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host "Logs available at: %LOCALAPPDATA%\KuaminiSecurityClient\agent.log" -ForegroundColor Gray
