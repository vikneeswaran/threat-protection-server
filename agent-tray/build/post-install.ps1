# Kuamini Security Client Post-Installation Script
# This script runs after MSI installation to:
# 1. Create config directory and default config
# 2. Start the agent immediately
# 3. Configure autostart

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "=== Kuamini Security Client Post-Install ===" -ForegroundColor Cyan
Write-Host ""

# Determine install location (check multiple possible locations)
$possibleInstallDirs = @(
    "${env:ProgramFiles}\KuaminiSecurityClient",
    "${env:ProgramFiles}\Kuamini",
    "${env:ProgramFiles}\Kuamini\SecurityClient"
)

$InstallDir = $null
$ExePath = $null

Write-Host "Searching for installation..." -ForegroundColor Gray
foreach ($dir in $possibleInstallDirs) {
    Write-Host "  Checking: $dir" -ForegroundColor Gray
    if (Test-Path "$dir\KuaminiSecurityClient.exe") {
        $InstallDir = $dir
        $ExePath = "$dir\KuaminiSecurityClient.exe"
        Write-Host "  ✓ Found executable!" -ForegroundColor Green
        break
    }
}

if (-not $InstallDir) {
    Write-Host ""
    Write-Host "ERROR: Could not find KuaminiSecurityClient.exe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Searched locations:" -ForegroundColor Yellow
    foreach ($dir in $possibleInstallDirs) {
        Write-Host "  - $dir" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "The MSI installation may be incomplete." -ForegroundColor Red
    Write-Host "Please try reinstalling or contact support." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Use user's .kuamini directory for config (matches what agent expects)
$ConfigDir = "$env:USERPROFILE\.kuamini"
$ConfigFile = "$ConfigDir\config.json"

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Install Dir: $InstallDir" -ForegroundColor Gray
Write-Host "  Executable: $ExePath" -ForegroundColor Gray
Write-Host "  Config Dir: $ConfigDir" -ForegroundColor Gray
Write-Host ""

# Create config directory
Write-Host "Setting up configuration..." -ForegroundColor Gray
if (-not (Test-Path $ConfigDir)) {
    try {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
        Write-Host "  ✓ Created config directory" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Failed to create config directory: $_" -ForegroundColor Yellow
    }
}

# Create default config if it doesn't exist
if (-not (Test-Path $ConfigFile)) {
    try {
        $DefaultConfig = @{
            api_base = "https://kuaminisystems.com/api/agent"
            console_url = "https://kuaminisystems.com/securityAgent"
            auto_register = $true
            heartbeat_interval = 60
        } | ConvertTo-Json -Depth 10
        
        $DefaultConfig | Set-Content -Path $ConfigFile -Encoding UTF8
        Write-Host "  ✓ Created default config file" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Failed to create config file: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ℹ Config file already exists" -ForegroundColor Gray
}

# Add to startup (current user)
Write-Host ""
Write-Host "Configuring autostart..." -ForegroundColor Gray
$StartupKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$AppName = "KuaminiSecurityClient"

try {
    Set-ItemProperty -Path $StartupKey -Name $AppName -Value "`"$ExePath`"" -Force
    Write-Host "  ✓ Added to Windows startup" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Failed to add startup entry: $_" -ForegroundColor Yellow
}

# Start the application
Write-Host ""
Write-Host "Starting Kuamini Security Client..." -ForegroundColor Gray
try {
    $process = Start-Process -FilePath $ExePath -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 3
    
    # Verify process is still running
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ Agent started successfully (PID: $($process.Id))" -ForegroundColor Green
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "  Installation Complete!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host ""
        Write-Host "  The Kuamini Security Client is now running." -ForegroundColor White
        Write-Host "  Look for the tray icon near your system clock." -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Right-click the icon to:" -ForegroundColor Gray
        Write-Host "    • View agent status" -ForegroundColor Gray
        Write-Host "    • Open the management console" -ForegroundColor Gray
        Write-Host "    • Send manual heartbeat" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "  ⚠ Agent started but may have exited" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Check logs for details:" -ForegroundColor Yellow
        Write-Host "  $env:USERPROFILE\.kuamini\" -ForegroundColor Gray
        Write-Host ""
        Write-Host "You can manually start the agent from:" -ForegroundColor Yellow
        Write-Host "  $ExePath" -ForegroundColor Gray
        Write-Host ""
    }
} catch {
    Write-Host "  ✗ Failed to start agent: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check if antivirus is blocking the application" -ForegroundColor Gray
    Write-Host "  2. Try running manually: $ExePath" -ForegroundColor Gray
    Write-Host "  3. Check logs: $env:USERPROFILE\.kuamini\" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
