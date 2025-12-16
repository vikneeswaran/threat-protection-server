# Kuamini Agent Tray - Build Instructions

This directory contains build scripts to create OS-specific system tray agents.

## Prerequisites

- Python 3.10+
- PyInstaller
- OS-specific tools:
  - macOS: Xcode Command Line Tools, `pkgbuild`
  - Linux: `zip`, standard build tools
  - Windows: PowerShell, optionally Inno Setup

## Quick Start

### macOS

```bash
cd agent-tray/build
./pyinstaller-mac.sh    # Build .app bundle
./sign-mac.sh           # Sign & notarize (requires Apple Developer account)
./zip-mac.sh            # Create macos.zip
./pkgbuild-mac.sh       # Optional: create .pkg installer
```

Output: `dist/macos.zip`, `dist/KuaminiAgentTray-1.0.0.pkg`

**Note:** For distribution, signing is required. See "Code Signing" section below.

### Linux

```bash
cd agent-tray/build
./pyinstaller-linux.sh  # Build binary
./zip-linux.sh          # Create linux.zip
```

Output: `dist/linux.zip`

### Windows

```powershell
cd agent-tray\build
.\pyinstaller-win.ps1   # Build EXE bundle
.\sign-win.ps1          # Sign the executable (requires Authenticode certificate)
.\zip-win.ps1           # Create windows.zip
```

Output: `dist\windows.zip`

**Note:** For distribution, signing is required. See "Code Signing" section below.

Optional: Use Inno Setup with `inno-setup-template.iss` to create a full installer.

## Build All (Unix)

```bash
cd agent-tray/build
./build-all.sh
```

This will build macOS and Linux bundles if run on the respective platforms.

## Deployment

1. Build the bundles on each platform
2. Copy the resulting zip files into `public/tray/` **before** deploying the Next.js app (build-all.sh will attempt this for macOS/Linux)
  - `public/tray/macos.zip`
  - `public/tray/linux.zip`
  - `public/tray/windows.zip`
3. After deploy, the bundles are served statically at `/tray/{macos|linux|windows}.zip`
4. Installer scripts auto-download from these static URLs

## Code Signing (Required for Distribution)

**Without code signing, users will see security warnings and may be blocked from installing.**

### macOS Code Signing & Notarization

**Prerequisites:**
1. Apple Developer account ($99/year)
2. Developer ID Application certificate installed
3. App-specific password for notarization

**Setup:**
```bash
# 1. Download certificate from Apple Developer portal
# 2. Install in Keychain (double-click .cer file)
# 3. Store notarization credentials
xcrun notarytool store-credentials "notarytool-profile" \
  --apple-id "your@email.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "app-specific-password"
```

**Build & Sign:**
```bash
cd agent-tray/build
./pyinstaller-mac.sh      # Build the app
./sign-mac.sh             # Sign and notarize (takes 5-10 minutes)
./zip-mac.sh              # Package signed app
```

**Environment Variables (optional):**
- `SIGNING_IDENTITY`: Specific certificate name (auto-detected if not set)
- `NOTARY_PROFILE`: Keychain profile name (defaults to "notarytool-profile")

### Windows Code Signing

**Prerequisites:**
1. Authenticode certificate (.pfx file or EV certificate)
2. Windows SDK installed (for SignTool)

**Setup:**
```powershell
# Option 1: Using .pfx file
$env:CERTIFICATE_PATH = "C:\path\to\certificate.pfx"
$env:CERTIFICATE_PASSWORD = "your-password"

# Option 2: Using certificate from store
# List your certificates:
Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert
# Use the thumbprint:
$env:CERTIFICATE_THUMBPRINT = "SHA1_THUMBPRINT_HERE"
```

**Build & Sign:**
```powershell
cd agent-tray\build
.\pyinstaller-win.ps1     # Build the app
.\sign-win.ps1            # Sign the executable
.\zip-win.ps1             # Package signed app
```

### Linux

Linux doesn't require code signing, but you can GPG-sign your packages for verification:
```bash
gpg --detach-sign --armor dist/linux.zip
```

## Directory Structure

```
build/
├── pyinstaller-mac.sh          # macOS PyInstaller build
├── pkgbuild-mac.sh             # macOS .pkg creator
├── zip-mac.sh                  # Zip macOS bundle
├── pyinstaller-linux.sh        # Linux PyInstaller build
├── zip-linux.sh                # Zip Linux bundle
├── pyinstaller-win.ps1         # Windows PyInstaller build
├── zip-win.ps1                 # Zip Windows bundle
├── inno-setup-template.iss     # Inno Setup installer template
├── build-all.sh                # Build all platforms
└── autostart/                  # Autostart templates
    ├── macos/
    ├── linux/
    └── windows/
```

## Troubleshooting

- **"dist not found"**: Run the PyInstaller script first
- **PyInstaller errors**: Ensure all dependencies in `requirements.txt` are installed
- **Permission denied**: Make scripts executable with `chmod +x *.sh`
- **Windows build issues**: Run PowerShell as Administrator

### Code Signing Issues

**macOS:**
- **"No identity found"**: Ensure Developer ID certificate is installed in Keychain
  - Check: `security find-identity -v -p codesigning`
- **Notarization timeout**: Usually takes 5-10 minutes. Check status:
  - `xcrun notarytool history --keychain-profile notarytool-profile`
- **"Invalid entitlements"**: Ensure `entitlements.plist` is present in build directory
- **Gatekeeper still blocks**: Clear quarantine flag:
  - `xattr -cr dist/KuaminiAgentTray.app`

**Windows:**
- **"SignTool not found"**: Install Windows SDK from Microsoft
- **"No certificate specified"**: Set `CERTIFICATE_PATH` or `CERTIFICATE_THUMBPRINT` environment variables
- **SmartScreen warning persists**: Ensure timestamp server is reached (requires internet)
- **Invalid timestamp**: Try alternative timestamp servers:
  - `http://timestamp.digicert.com`
  - `http://timestamp.sectigo.com`
  - `http://timestamp.comodoca.com`
