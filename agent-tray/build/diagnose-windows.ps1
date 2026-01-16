# Kuamini Security Client Diagnostic Script
# Run this to troubleshoot installation issues

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Kuamini Security Client - Diagnostics" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check 1: Find installation
Write-Host "[1] Checking installation locations..." -ForegroundColor Yellow
$possibleDirs = @(
    "${env:ProgramFiles}\KuaminiSecurityClient",
    "${env:ProgramFiles}\Kuamini",
    "${env:ProgramFiles}\Kuamini\SecurityClient"
)

$foundInstall = $false
foreach ($dir in $possibleDirs) {
    if (Test-Path $dir) {
        Write-Host "  ✓ Found directory: $dir" -ForegroundColor Green
        $foundInstall = $true
        
        $exe = "$dir\KuaminiSecurityClient.exe"
        if (Test-Path $exe) {
            Write-Host "    ✓ Executable exists: $exe" -ForegroundColor Green
            
            # Get file details
            $fileInfo = Get-Item $exe
            Write-Host "    Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
            Write-Host "    Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
        } else {
            Write-Host "    ✗ KuaminiSecurityClient.exe NOT FOUND" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "  Contents of $dir :" -ForegroundColor Gray
        Get-ChildItem $dir | ForEach-Object {
            Write-Host "    - $($_.Name)" -ForegroundColor Gray
        }
    }
}

if (-not $foundInstall) {
    Write-Host "  ✗ No installation directory found!" -ForegroundColor Red
}

Write-Host ""

# Check 2: Running processes
Write-Host "[2] Checking for running processes..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object { $_.ProcessName -like "*Kuamini*" }
if ($processes) {
    Write-Host "  ✓ Found running process(es):" -ForegroundColor Green
    $processes | ForEach-Object {
        Write-Host "    - $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Green
        Write-Host "      Path: $($_.Path)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ No Kuamini processes running" -ForegroundColor Red
}

Write-Host ""

# Check 3: Config file
Write-Host "[3] Checking configuration files..." -ForegroundColor Yellow
$configPaths = @(
    "$env:USERPROFILE\.kuamini\config.json",
    "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json",
    "$env:APPDATA\Kuamini\config.json"
)

$foundConfig = $false
foreach ($configPath in $configPaths) {
    if (Test-Path $configPath) {
        Write-Host "  ✓ Found config: $configPath" -ForegroundColor Green
        $foundConfig = $true
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
            Write-Host "    API Base: $($config.api_base)" -ForegroundColor Gray
            Write-Host "    Agent ID: $($config.agent_id)" -ForegroundColor Gray
            Write-Host "    Auto Register: $($config.auto_register)" -ForegroundColor Gray
        } catch {
            Write-Host "    ⚠ Could not parse config: $_" -ForegroundColor Yellow
        }
    }
}

if (-not $foundConfig) {
    Write-Host "  ✗ No config file found!" -ForegroundColor Red
}

Write-Host ""

# Check 4: Startup entries
Write-Host "[4] Checking startup configuration..." -ForegroundColor Yellow
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
try {
    $startupEntry = Get-ItemProperty -Path $runKey -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
    if ($startupEntry) {
        Write-Host "  ✓ Startup registry entry exists:" -ForegroundColor Green
        Write-Host "    $($startupEntry.KuaminiSecurityClient)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ No startup registry entry found" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Could not check startup registry" -ForegroundColor Red
}

Write-Host ""

# Check 5: Log files
Write-Host "[5] Checking for log files..." -ForegroundColor Yellow
$logPaths = @(
    "$env:USERPROFILE\Library\Logs\KuaminiSecurityClient\agent.log",
    "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log",
    "$env:USERPROFILE\.kuamini\agent.log"
)

$foundLog = $false
foreach ($logPath in $logPaths) {
    if (Test-Path $logPath) {
        Write-Host "  ✓ Found log file: $logPath" -ForegroundColor Green
        $foundLog = $true
        
        $lastLines = Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue
        if ($lastLines) {
            Write-Host ""
            Write-Host "  Last 20 lines of log:" -ForegroundColor Gray
            Write-Host "  ----------------------------------------" -ForegroundColor Gray
            $lastLines | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Gray
            }
            Write-Host "  ----------------------------------------" -ForegroundColor Gray
        }
    }
}

if (-not $foundLog) {
    Write-Host "  ℹ No log files found (agent may not have started)" -ForegroundColor Yellow
}

Write-Host ""

# Check 6: Try to start manually
Write-Host "[6] Attempting to start agent manually..." -ForegroundColor Yellow

$exePath = $null
foreach ($dir in $possibleDirs) {
    $testPath = "$dir\KuaminiSecurityClient.exe"
    if (Test-Path $testPath) {
        $exePath = $testPath
        break
    }
}

if ($exePath) {
    Write-Host "  Found executable: $exePath" -ForegroundColor Gray
    Write-Host "  Starting agent..." -ForegroundColor Gray
    
    try {
        $process = Start-Process -FilePath $exePath -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 3
        
        if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
            Write-Host "  ✓ Agent started successfully (PID: $($process.Id))" -ForegroundColor Green
            Write-Host ""
            Write-Host "  Check your system tray for the icon." -ForegroundColor Green
            Write-Host "  Wait 5-10 seconds for it to initialize." -ForegroundColor Gray
        } else {
            Write-Host "  ✗ Agent started but immediately exited" -ForegroundColor Red
            Write-Host "  This usually means there's an error. Check logs above." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ✗ Failed to start: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ Could not find KuaminiSecurityClient.exe" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please share this entire output for troubleshooting." -ForegroundColor Yellow
Write-Host ""
pause
