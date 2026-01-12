# Cross-Platform Installer Build System

## Summary

Replaced ZIP bundle distribution with proper installers for all platforms:

- **macOS**: PKG installer (native package format)
- **Windows**: MSI installer (Windows Installer format)
- **Linux**: Self-extracting shell script installer

## GitHub Actions Workflow

**Workflow**: `.github/workflows/build-installers.yml`

Automatically builds installers on every push to `agent-tray/**` or via manual trigger.

### Build Process

1. **macOS** (runs on `macos-latest`)
   - PyInstaller → `.app` bundle
   - pkgbuild → `.pkg` installer
   - Output: `KuaminiSecurityClient-1.0.0.pkg`

2. **Windows** (runs on `windows-latest`)
   - PyInstaller → `.exe` executable
   - WiX Toolset → `.msi` installer
   - Output: `KuaminiSecurityClient-1.0.0.msi`
   - ⚠️ Requires: `choco install wixtoolset`

3. **Linux** (runs on `ubuntu-latest`)
   - PyInstaller → Linux binary
   - Custom shell script → self-extracting installer
   - Output: `KuaminiSecurityClient-1.0.0.sh`

### Deployment

After all three builds complete, the `deploy` job:
1. Downloads all installers
2. Copies to `public/tray/`
3. Commits and pushes to `main`
4. Next.js deployment picks up the new files

## How to Trigger Builds

### Automatic
Changes to `agent-tray/**` or `.github/workflows/build-installers.yml` trigger builds automatically.

### Manual
1. Go to GitHub repo → **Actions** tab
2. Select **"Build and Deploy Installers"** workflow
3. Click **"Run workflow"** button
4. Wait ~10-15 minutes for all builds to complete
5. Pull changes: `git pull origin main`
6. Deploy

## Build Scripts

### Linux Installer (`build/build-linux-installer.sh`)

Creates self-extracting installer that:
- Prompts for installation location (`/opt/kuamini-security-client`)
- Creates config directory (`~/.kuamini`)
- Sets up systemd user service for auto-start
- Creates launcher script in `/usr/local/bin`
- Provides uninstall script

Installation:
```bash
bash KuaminiSecurityClient-1.0.0.sh
```

### Windows Installer (`build/build-windows-msi.ps1`)

Creates Windows Installer package using WiX Toolset:
- Installs to `Program Files\Kuamini Security Client`
- Creates Start Menu shortcuts
- Integrates with Windows Add/Remove Programs
- Supports silent installation: `msiexec /i KuaminiSecurityClient-1.0.0.msi /quiet`

Installation:
```
Double-click KuaminiSecurityClient-1.0.0.msi
Or: msiexec /i KuaminiSecurityClient-1.0.0.msi
```

### macOS Installer (`build/pkgbuild-mac.sh`)

Creates macOS package that:
- Installs to `/Applications/KuaminiSecurityClient.app`
- Runs postinstall script to:
  - Create config directory
  - Setup LaunchAgent for auto-start
  - Install plist for user's GUI session

Installation:
```bash
sudo installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /
```

## Installer Features

All installers include:
- ✅ Auto-start after installation
- ✅ Config file support
- ✅ Uninstall capability
- ✅ Version information
- ✅ Error handling
- ✅ User-friendly prompts

## Next Steps

1. **Test on Windows machine**:
   - Download from: `https://kuaminisystems.com/public/tray/KuaminiSecurityClient-1.0.0.msi`
   - Install and verify agent starts
   - Check system tray icon appears
   - Verify connection to console

2. **Test on Linux machine**:
   - Download from: `https://kuaminisystems.com/public/tray/KuaminiSecurityClient-1.0.0.sh`
   - Run: `bash KuaminiSecurityClient-1.0.0.sh`
   - Verify systemd service is running: `systemctl --user status kuamini-security-client`
   - Check connection to console

3. **Update distribution links**:
   - Replace installer download URLs in console
   - Update documentation with new installer types

## Dependencies

- **macOS**: `pkgbuild` (included in Xcode Command Line Tools)
- **Windows**: `WiX Toolset` (installed by `choco install wixtoolset`)
- **Linux**: `tar`, `bash` (standard utilities)
- **All**: Python 3.10+, PyInstaller

## Troubleshooting

### Windows MSI build fails
- Ensure WiX Toolset is installed: `choco install wixtoolset --no-progress -y`
- Clear build cache: `rm -r agent-tray/build`

### Linux installer extraction fails
- Ensure sufficient disk space in `/opt` and `$HOME`
- Check permissions: `sudo chmod 755 /opt`

### macOS PKG installation fails
- Verify Xcode Command Line Tools: `xcode-select --install`
- Check available disk space
- Try installing with: `sudo installer -pkg file.pkg -target /`
