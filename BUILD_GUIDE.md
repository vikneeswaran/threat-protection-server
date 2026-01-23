# Quick Build & Deploy Guide

## Prerequisites
```powershell
python -m pip install --upgrade pip
python -m pip install pyinstaller requests psutil Pillow pystray
```

## Build Windows Executable

```powershell
cd agent-tray

# Clean previous build
Remove-Item -Path dist, build -Recurse -Force -ErrorAction SilentlyContinue

# Build with PyInstaller
python -m PyInstaller --clean KuaminiSecurityClient-win.spec

# Verify executable was created
if ((Test-Path "dist\KuaminiSecurityClient\KuaminiSecurityClient.exe")) {
    Write-Host "✓ Build successful!" -ForegroundColor Green
    dir "dist\KuaminiSecurityClient\KuaminiSecurityClient.exe"
} else {
    Write-Host "✗ Build failed - executable not found" -ForegroundColor Red
    exit 1
}
```

## Create MSI Installer

```powershell
# Option 1: Using Heat & Candle (requires WiX Toolset)
cd agent-tray/build
./build-windows-msi.ps1

# Option 2: Using Python WiX generator
cd agent-tray/build
python build-windows-msi.py
```

## Test Installation

```powershell
# Install the MSI (replace with actual path)
$msiPath = "C:\path\to\KuaminiSecurityClient.msi"
msiexec /i $msiPath /quiet /norestart

# Wait for installation
Start-Sleep -Seconds 5

# Check if running
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue

# View logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 50 -Wait

# Check config
Get-Content "$env:USERPROFILE\.kuamini\config.json" | ConvertFrom-Json | Format-Table
```

## Troubleshooting Build Issues

### PyInstaller Hidden Imports Error
**Error**: `ModuleNotFoundError: No module named 'pystray'`

**Fix**: Ensure all dependencies are in the spec file's `hiddenimports` list
```python
hiddenimports=[
    'pystray', 'psutil', 'PIL', 'PIL.Image', 'PIL.ImageDraw',
    'requests', 'requests.adapters', 'requests.auth', ...
]
```

### Missing DLL Files
**Error**: `ImportError: DLL load failed`

**Fix**: Reinstall packages in correct order:
```powershell
python -m pip install --force-reinstall Pillow psutil requests
```

### Executable Won't Start
**Error**: Application closes immediately

**Fix**: Check the log file:
```powershell
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" | Select-Object -Last 20
```

Look for:
- `[IMPORT ERROR]` - Missing Python module
- `[CA Bundle]` - SSL certificate issues
- `[COMPAT]` - Pillow version issues

## Push to Production

1. **Sign the executable** (optional but recommended)
   ```powershell
   signtool sign /f cert.pfx /p password /t http://timestamp.authority.com dist\KuaminiSecurityClient\KuaminiSecurityClient.exe
   ```

2. **Create deployment package**
   ```powershell
   $version = "1.0.0"
   Compress-Archive -Path dist\KuaminiSecurityClient\* -DestinationPath "KuaminiSecurityClient-$version-windows.zip"
   ```

3. **Update download link** in installation instructions

4. **Notify users** of update with changelog

## Key Metrics to Verify

- [ ] Executable size is reasonable (~100-150 MB)
- [ ] Startup time < 3 seconds
- [ ] Memory usage < 50 MB at idle
- [ ] Systray icon appears within 2 seconds
- [ ] First registration < 10 seconds
- [ ] Heartbeat every 60 seconds (configurable)
- [ ] Log file is created and contains no [ERROR] on success

## Common Build Output Files

```
agent-tray/
├── dist/
│   └── KuaminiSecurityClient/
│       ├── KuaminiSecurityClient.exe      ← Main executable
│       ├── python*.dll                    ← Python runtime
│       ├── _ctypes.pyd                    ← Windows API access
│       └── ... (other dependencies)
├── build/
│   └── KuaminiSecurityClient/
│       └── ... (build intermediate files)
└── public/
    └── tray/
        └── windows.zip                    ← Distribution package
```
