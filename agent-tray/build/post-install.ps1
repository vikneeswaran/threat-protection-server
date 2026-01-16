# Kuamini Security Client Post-Installation Script
# This script runs after MSI installation to:
# 1. Create config directory and default config
# 2. Start the agent immediately
# 3. Configure autostart

$ErrorActionPreference = "Continue"

# Determine install location
$InstallDir = "${env:ProgramFiles}\KuaminiSecurityClient"
$ConfigDir = "${env:LOCALAPPDATA}\KuaminiSecurityClient"
$ConfigFile = "$ConfigDir\config.json"

Write-Host "=== Kuamini Security Client Post-Install ==="
Write-Host "Install Dir: $InstallDir"
Write-Host "Config Dir: $ConfigDir"

# Create config directory
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Host "✓ Created config directory"
}

# Create default config if it doesn't exist
if (-not (Test-Path $ConfigFile)) {
    $DefaultConfig = @{
        api_base = "https://kuaminisystems.com/api/agent"
        console_url = "https://kuaminisystems.com/securityAgent"
        auto_register = $true
        heartbeat_interval = 60
    } | ConvertTo-Json -Depth 10
    
    $DefaultConfig | Set-Content -Path $ConfigFile -Encoding UTF8
    Write-Host "✓ Created default config file"
}

# Add to startup (current user)
$StartupKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$AppName = "KuaminiSecurityClient"
$ExePath = "$InstallDir\KuaminiSecurityClient.exe"

try {
    Set-ItemProperty -Path $StartupKey -Name $AppName -Value "`"$ExePath`"" -Force
    Write-Host "✓ Added to Windows startup"
} catch {
    Write-Host "⚠ Failed to add startup entry: $_"
}

# Start the application
Write-Host "Starting Kuamini Security Client..."
try {
    Start-Process -FilePath $ExePath -WindowStyle Hidden
    Write-Host "✓ Agent started successfully"
    Write-Host ""
    Write-Host "The Kuamini Security Client is now running in your system tray."
    Write-Host "Look for the tray icon near your clock."
} catch {
    Write-Host "⚠ Failed to start agent: $_"
    Write-Host "You can manually start it from: $ExePath"
}

Write-Host ""
Write-Host "Installation complete!"
