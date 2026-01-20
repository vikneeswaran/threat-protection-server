# Post-install script for KuaminiSecurityClient MSI
# Runs as SYSTEM during MSI installation
# Creates config.json with registration_token if provided

$InstallDir = $env:ProgramFiles + "\KuaminiSecurityClient"
$ConfigDir = $env:LOCALAPPDATA + "\KuaminiSecurityClient"
$ConfigFile = Join-Path $ConfigDir "config.json"
$SetupScriptPath = Join-Path $InstallDir "setup-user.ps1"

# Read REGISTRATION_TOKEN from environment (set by MSI)
$REGISTRATION_TOKEN = $env:REGISTRATION_TOKEN
if (-not $REGISTRATION_TOKEN) {
    $REGISTRATION_TOKEN = $args[0]
}

Write-Host "Starting post-install setup..."
Write-Host "Install directory: $InstallDir"
Write-Host "Config directory: $ConfigDir"

# Create config directory
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Host "Created config directory: $ConfigDir"
}

# Decode account_id from registration token
$AccountId = $null
if ($REGISTRATION_TOKEN) {
    try {
        Write-Host "Processing registration token..."
        # Remove any whitespace or quotes
        $cleaned = $REGISTRATION_TOKEN.Trim().Trim('"').Trim("'")
        
        # Decode base64 to get JSON with account_id
        $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($cleaned))
        $tokenData = $decoded | ConvertFrom-Json
        $AccountId = $tokenData.accountId
        
        Write-Host "Decoded account_id: $AccountId"
    } catch {
        Write-Host "WARNING: Failed to decode registration token: $_"
    }
}

# Create default config.json with NO BOM
$DefaultConfig = @{
    api_base = "https://kuaminisystems.com/api/agent"
    check_interval = 300
} | ConvertTo-Json

# If we have account_id from token, add it to config along with registration_token
if ($AccountId) {
    $configObj = $DefaultConfig | ConvertFrom-Json
    $configObj | Add-Member -NotePropertyName "account_id" -NotePropertyValue $AccountId
    $configObj | Add-Member -NotePropertyName "registration_token" -NotePropertyValue $REGISTRATION_TOKEN
    $DefaultConfig = $configObj | ConvertTo-Json
}

# Write config WITHOUT BOM using UTF8Encoding($false)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($ConfigFile, $DefaultConfig, $utf8NoBom)
Write-Host "Created config file: $ConfigFile"

# Set HKLM Run registry for system-level startup
$RunKeyPath = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
$ExePath = Join-Path $InstallDir "KuaminiSecurityClient.exe"

if (Test-Path $ExePath) {
    Set-ItemProperty -Path $RunKeyPath -Name "KuaminiSecurityClient" -Value "`"$ExePath`"" -Force
    Write-Host "Set HKLM Run registry entry"
} else {
    Write-Host "WARNING: Executable not found at $ExePath"
}

# Create setup-user.ps1 script for user-context setup
$SetupUserScript = @'
# User-context setup script
# Runs on first user login to set up user-specific startup

$InstallDir = $env:ProgramFiles + "\KuaminiSecurityClient"
$ExePath = Join-Path $InstallDir "KuaminiSecurityClient.exe"

if (Test-Path $ExePath) {
    # Set HKCU Run registry for user-level startup
    $RunKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $RunKeyPath -Name "KuaminiSecurityClient" -Value "`"$ExePath`"" -Force
    
    # Start the tray application immediately (if not already running)
    $Process = Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
    if (-not $Process) {
        Start-Process -FilePath $ExePath -WindowStyle Hidden
    }
}

# Unregister this scheduled task (one-time setup)
Unregister-ScheduledTask -TaskName "KuaminiSecurityClientSetup" -Confirm:$false -ErrorAction SilentlyContinue
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($SetupScriptPath, $SetupUserScript, $utf8NoBom)
Write-Host "Created user setup script: $SetupScriptPath"

# Create scheduled task to run setup-user.ps1 at next user login
$TaskName = "KuaminiSecurityClientSetup"
$TaskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$SetupScriptPath`""
$TaskTrigger = New-ScheduledTaskTrigger -AtLogOn
$TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$TaskPrincipal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Users" -RunLevel Limited

# Register the task
Register-ScheduledTask -TaskName $TaskName -Action $TaskAction -Trigger $TaskTrigger -Settings $TaskSettings -Principal $TaskPrincipal -Force | Out-Null
Write-Host "Created scheduled task: $TaskName"

Write-Host "Post-install setup completed successfully."
