# macOS Installation & Deployment Guide

**Last Updated**: February 8, 2026  
**Status**: ✅ Production Ready  
**Version**: 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Installation Methods](#installation-methods)
3. [Prerequisites](#prerequisites)
4. [Installation Steps](#installation-steps)
5. [Configuration](#configuration)
6. [Verification](#verification)
7. [Uninstallation](#uninstallation)
8. [Building from Source](#building-from-source)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Kuamini Security Client for macOS provides enterprise-grade endpoint protection with centralized management. This guide covers complete installation, configuration, and deployment procedures for macOS environments.

### Key Features
- **Native .app Bundle**: Standard macOS application package
- **Auto-registration**: Automatic endpoint registration with management console
- **Menu Bar Integration**: Visual status indicator and quick access menu
- **LaunchAgent**: Runs automatically on user login
- **Silent Installation**: Supports unattended deployment
- **Complete Cleanup**: Full uninstallation with no leftoversapplication

### System Requirements
- **OS**: macOS 11 (Big Sur) or later
- **Architecture**: Apple Silicon (M1/M2/M3) or Intel
- **Privileges**: Administrator rights required for installation
- **Network**: HTTPS access to kuaminisystems.com
- **Disk Space**: ~65 MB minimum
- **Memory**: 100 MB RAM minimum

---

## Installation Methods

### Method 1: Shell Script Installer (Recommended)

**Best for**: Quick deployment, console UI workflows

```bash
# Download and run installer
curl -sSL https://kuaminisystems.com/tray/install-kuamini-macos.sh -o install-kuamini-macos.sh
chmod +x install-kuamini-macos.sh

# Install (will prompt for sudo password)
./install-kuamini-macos.sh
```

### Method 2: PKG Installer (Manual)

**Best for**: Distributing to multiple endpoints, custom workflows

1. Log into https://kuaminisystems.com/securityAgent
2. Navigate to **Installers** → **macOS**
3. Download `KuaminiSecurityClient-1.0.0.pkg`
4. Download `install-kuamini-macos.sh`
5. Run:
   ```bash
   ./install-kuamini-macos.sh /path/to/KuaminiSecurityClient-1.0.0.pkg
   ```

### Method 3: One-Line Installation with Token

**Best for**: Automated registration with pre-configured token

```bash
curl -sSL https://kuaminisystems.com/tray/install-kuamini-macos.sh | \
  bash -s -- --token "YOUR_REGISTRATION_TOKEN"
```

### Method 4: Manual PKG Extraction (Advanced)

**Best for**: Custom deployment, troubleshooting macOS Sequoia PKG bug

```bash
# Extract PKG manually
pkgutil --expand-full KuaminiSecurityClient-1.0.0.pkg extracted_pkg
cd extracted_pkg/Payload

# Copy to Applications
sudo cp -R KuaminiSecurityClient.app /Applications/

# Create configuration
mkdir -p ~/.kuamini
cat > ~/.kuamini/config.json << 'EOF'
{
  "api_base_url": "https://kuaminisystems.com/api/agent",
  "heartbeat_interval": 60,
  "agent_id": ""
}
EOF

# Create LaunchAgent
# See Configuration section for LaunchAgent plist
```

---

## Prerequisites

### 1. Administrator Privileges
Installation requires administrator (sudo) access for:
- Copying app bundle to `/Applications`
- Creating LaunchAgent
- Installing system-level components

### 2. Network Access
Ensure firewall allows HTTPS connections to:
- `kuaminisystems.com` (port 443)
- Agent API endpoints: `/api/agent/*`

Test connectivity:
```bash
curl -I https://kuaminisystems.com/api/health
```

### 3. Registration Token (Optional)
For automatic registration, obtain token from console:
1. Log into https://kuaminisystems.com/securityAgent
2. Go to **Installers** section
3. Copy the registration token

### 4. Security & Privacy Settings
macOS may require approval for:
- Non-App Store application (Gatekeeper)
- Background agent execution
- Network connections

---

## Installation Steps

### Complete Installation Flow

```
1. User downloads installer script and PKG
2. User runs: ./install-kuamini-macos.sh
3. Script extracts PKG → Payload directory
4. Script copies Payload to /Applications/KuaminiSecurityClient.app
5. Script creates ~/.kuamini/config.json with defaults
6. Script creates ~/Library/LaunchAgents/com.kuamini.securityclient.plist
7. Script runs: launchctl bootstrap gui/$UID <plist-path>
8. Agent starts, generates agent_id, saves to config
9. Agent calls /api/agent/register → Gets endpoint_id
10. Agent starts sending heartbeats every 60 seconds
11. Endpoint appears in console as "Online"
```

### Step-by-Step Instructions

#### Step 1: Download Components

```bash
# Create temp directory
mkdir -p ~/Downloads/kuamini-install
cd ~/Downloads/kuamini-install

# Download installer script
curl -O https://kuaminisystems.com/tray/install-kuamini-macos.sh

# Download PKG (if not using direct download from script)
curl -O https://kuaminisystems.com/tray/KuaminiSecurityClient-1.0.0.pkg

# Make script executable
chmod +x install-kuamini-macos.sh
```

#### Step 2: Run Installer

**Interactive Installation:**
```bash
# Basic installation (will prompt for sudo password)
./install-kuamini-macos.sh

# Or with PKG path
./install-kuamini-macos.sh KuaminiSecurityClient-1.0.0.pkg
```

**With Registration Token:**
```bash
# Installation with auto-registration
./install-kuamini-macos.sh --token "eyJ...your-token-here...QI="
```

#### Step 3: Grant Permissions

macOS may display security prompts:

1. **Gatekeeper Warning**:
   - Click "Open" when prompted
   - Or: System Preferences → Security & Privacy → "Allow anyway"

2. **Network Permission**:
   - Allow network access when prompted

3. **Background Agent**:
   - macOS may ask to allow background execution

#### Step 4: Wait for Registration

```
Installer output will show:
✓ PKG extracted successfully
✓ App copied to /Applications
✓ Configuration created
✓ LaunchAgent installed
✓ Agent started
✓ Registration successful
✓ Endpoint online in console
```

---

## Configuration

### File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| **Application** | `/Applications/KuaminiSecurityClient.app` | Main app bundle |
| **Configuration** | `~/.kuamini/config.json` | Runtime configuration |
| **Logs** | `~/.kuamini/logs/agent.log` | Agent activity logs |
| **LaunchAgent** | `~/Library/LaunchAgents/com.kuamini.securityclient.plist` | Auto-start configuration |
| **Token File** | `~/.kuamini/registration.token` | Registration token (optional) |

### Configuration File Format

**Location**: `~/.kuamini/config.json`

```json
{
  "api_base_url": "https://kuaminisystems.com/api/agent",
  "agent_id": "generated-uuid-on-first-run",
  "registration_token": "optional-token-for-auto-registration",
  "heartbeat_interval": 60,
  "scan_interval": 3600,
  "log_level": "INFO",
  "enable_auto_start": true
}
```

### LaunchAgent Configuration

**Location**: `~/Library/LaunchAgents/com.kuamini.securityclient.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kuamini.securityclient</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/.kuamini/logs/stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/.kuamini/logs/stderr.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>/Users/USERNAME</string>
    </dict>
</dict>
</plist>
```

### Modifying Configuration

```bash
# Edit configuration
nano ~/.kuamini/config.json

# Example: Change heartbeat interval
cat ~/.kuamini/config.json | \
  python3 -c "import sys, json; d=json.load(sys.stdin); d['heartbeat_interval']=120; print(json.dumps(d, indent=2))" \
  > ~/.kuamini/config.json.tmp
mv ~/.kuamini/config.json.tmp ~/.kuamini/config.json

# Restart agent to apply changes
launchctl bootout gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist
```

---

## Verification

### Verify Installation

#### 1. Check Application
```bash
# Verify app exists
ls -la /Applications/KuaminiSecurityClient.app

# Check app signature (if code signed)
codesign -vv /Applications/KuaminiSecurityClient.app
```

#### 2. Check Process
```bash
# Check if agent is running
ps aux | grep -i kuamini | grep -v grep

# Or using pgrep
pgrep -af KuaminiSecurityClient
```

#### 3. Check LaunchAgent
```bash
# List LaunchAgents
launchctl list | grep kuamini

# Check LaunchAgent status
launchctl print gui/$UID/com.kuamini.securityclient
```

#### 4. Check Menu Bar Icon
Look for Kuamini icon in macOS menu bar (top-right):
- **Green shield**: Online and connected
- **Red shield**: Disconnected or error
- **Yellow shield**: Connecting/updating

#### 5. Check Logs
```bash
# View recent log entries
tail -f ~/.kuamini/logs/agent.log

# Or check LaunchAgent logs
tail -f ~/.kuamini/logs/stdout.log
tail -f ~/.kuamini/logs/stderr.log
```

Look for:
```
[INFO] Agent started successfully
[INFO] Registration successful (endpoint_id: xxx)
[INFO] Heartbeat sent successfully
```

#### 6. Check Console Dashboard
1. Log into https://kuaminisystems.com/securityAgent
2. Navigate to **Endpoints**
3. Verify endpoint shows:
   - **Status**: Online (green)
   - **Hostname**: Correct computer name
   - **OS**: macOS (with version)
   - **Last Seen**: Within last 2 minutes

### Verify Auto-start

```bash
# Reboot and verify agent starts automatically
sudo reboot

# After reboot, check process
ps aux | grep KuaminiSecurityClient | grep -v grep
```

---

## Uninstallation

### Method 1: Automated Uninstaller (Recommended)

```bash
# Download uninstaller
curl -sSL https://kuaminisystems.com/tray/uninstall-kuamini-macos.sh -o uninstall-kuamini-macos.sh
chmod +x uninstall-kuamini-macos.sh

# Run uninstaller (will prompt for sudo password)
sudo ./uninstall-kuamini-macos.sh
```

### Method 2: Manual Uninstallation

Complete step-by-step manual cleanup:

```bash
# 1. Stop LaunchAgent
launchctl bootout gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# 2. Kill any running processes
pkill -9 KuaminiSecurityClient

# 3. Remove application
sudo rm -rf /Applications/KuaminiSecurityClient.app

# 4. Remove LaunchAgent plist
rm -f ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# 5. Remove configuration and logs
rm -rf ~/.kuamini

# 6. Remove cache files
rm -rf ~/Library/Caches/com.kuamini.*
rm -rf ~/Library/Application\ Support/KuaminiSecurityClient

# 7. Remove preferences
rm -f ~/Library/Preferences/com.kuamini.securityclient.plist

# 8. Remove package receipts (if PKG was used)
sudo pkgutil --forget com.kuamini.securityclient

# 9. Restart Dock to clear menu bar
killall Dock
```

### Deregister from Console

After uninstalling:
1. Log into https://kuaminisystems.com/securityAgent
2. Go to **Endpoints**
3. Find the uninstalled endpoint
4. Click "⋮" menu → **Uninstall/Remove**
5. Endpoint will be marked as offline

Alternatively, the uninstaller script automatically deregisters via API if network is available.

---

## Building from Source

### Prerequisites for Building

- **Xcode Command Line Tools**: `xcode-select --install`
- **Python 3.10+**: `brew install python@3.10`
- **PyInstaller**: `pip3 install pyinstaller`
- **pkgbuild**: Included with Xcode Command Line Tools

### Build App Bundle

```bash
# Navigate to agent directory
cd agent-tray

# Install Python dependencies
pip3 install -r requirements.txt

# Clean previous builds
rm -rf dist build

# Build with PyInstaller
pyinstaller KuaminiSecurityClient-mac.spec

# Output: dist/KuaminiSecurityClient.app
```

### Build PKG Installer

```bash
# Navigate to build directory
cd agent-tray/build

# Run PKG build script
./pkgbuild-mac.sh

# Output: dist/KuaminiSecurityClient-1.0.0.pkg

# Copy to distribution directory
cp ../dist/KuaminiSecurityClient-1.0.0.pkg ../../public/tray/
```

### Code Signing & Notarization (Recommended)

**Prerequisites:**
- Apple Developer Account ($99/year)
- Developer ID Application certificate
- App-specific password for notarization

**Sign App Bundle:**
```bash
# Sign the app
codesign --force --deep --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements entitlements.plist \
  dist/KuaminiSecurityClient.app

# Verify signature
codesign -vv dist/KuaminiSecurityClient.app
spctl -a -vv dist/KuaminiSecurityClient.app
```

**Notarize App:**
```bash
# Create ZIP for notarization
ditto -c -k --keepParent dist/KuaminiSecurityClient.app dist/KuaminiSecurityClient.zip

# Submit for notarization
xcrun notarytool submit dist/KuaminiSecurityClient.zip \
  --apple-id "you@example.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password" \
  --wait

# Staple ticket to app
xcrun stapler staple dist/KuaminiSecurityClient.app
```

**Sign PKG:**
```bash
# Sign PKG installer
productsign --sign "Developer ID Installer: Your Name (TEAM_ID)" \
  dist/KuaminiSecurityClient-1.0.0.pkg \
  dist/KuaminiSecurityClient-1.0.0-signed.pkg

# Verify signature
pkgutil --check-signature dist/KuaminiSecurityClient-1.0.0-signed.pkg
```

### Deployment to CDN

```bash
# Copy built PKG to public directory
cp dist/KuaminiSecurityClient-1.0.0.pkg ../public/tray/

# Copy installer script
cp build/install-kuamini-macos.sh ../public/tray/

# Commit and push
git add public/tray/
git commit -m "chore: Update macOS installer to v1.0.0"
git push origin main

# Vercel will auto-deploy
```

---

## Troubleshooting

### Issue: "App is damaged and can't be opened" (Gatekeeper)

**Cause**: Unsigned app or quarantine flag set by macOS

**Solution**:
```bash
# Remove quarantine attribute
sudo xattr -rd com.apple.quarantine /Applications/KuaminiSecurityClient.app

# Or bypass Gatekeeper temporarily (not recommended for production)
sudo spctl --master-disable

# Re-enable after installation
sudo spctl --master-enable
```

### Issue: Agent not appearing in menu bar

**Cause**: LaunchAgent not starting or GUI permissions issue

**Diagnostic Steps**:
```bash
# 1. Check if process is running
ps aux | grep KuaminiSecurityClient | grep -v grep

# 2. Check LaunchAgent status
launchctl print gui/$UID/com.kuamini.securityclient

# 3. Check LaunchAgent logs
cat ~/.kuamini/logs/stderr.log

# 4. Try starting manually
/Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient
```

**Solution**:
```bash
# Unload and reload LaunchAgent
launchctl bootout gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# Or restart system
sudo reboot
```

### Issue: Agent not registering with console

**Cause**: Network issues, invalid token, or API unreachable

**Diagnostic Steps**:
```bash
# 1. Check configuration
cat ~/.kuamini/config.json

# 2. Check logs for registration errors
grep -i "error\|fail\|register" ~/.kuamini/logs/agent.log

# 3. Test API connectivity
curl -v https://kuaminisystems.com/api/health

# 4. Verify token format
cat ~/.kuamini/registration.token
```

**Solution**:
1. Verify token is correct in config.json
2. Check firewall settings
3. Review agent logs for specific error
4. Reinstall with fresh token

### Issue: LaunchAgent bootstrap fails with Error 5

**Cause**: Incorrect permissions or invalid plist configuration

**Solution**:
```bash
# 1. Check plist syntax
plutil ~/.kuamini/Library/LaunchAgents/com.kuamini.securityclient.plist

# 2. Fix permissions
chmod 644 ~/Library/LaunchAgents/com.kuamini.securityclient.plist

# 3. Ensure HOME variable is set correctly in plist
# Edit plist and replace USERNAME with actual username

# 4. Use legacy launchctl load as fallback
launchctl unload ~/Library/LaunchAgents/com.kuamini.securityclient.plist
launchctl load ~/Library/LaunchAgents/com.kuamini.securityclient.plist
```

### Issue: PKG installer doesn't extract files (macOS Sequoia Bug)

**Cause**: Known bug in macOS Sequoia where `installer` command fails silently

**Solution**: Use the shell script wrapper provided
```bash
# Don't use: sudo installer -pkg ... -target /
# Instead use:
./install-kuamini-macos.sh KuaminiSecurityClient-1.0.0.pkg
```

The script manually extracts PKG using `pkgutil` and `tar`, bypassing the bug.

### Issue: Agent consuming high CPU

**Cause**: Scanning large files or configuration issue

**Diagnostic**:
```bash
# Check CPU usage
ps aux | grep KuaminiSecurityClient | grep -v grep

# Check configuration
cat ~/.kuamini/config.json
```

**Solution**:
```bash
# Adjust scan intervals
# Edit config.json and increase scan_interval

# Restart agent
launchctl bootout gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.kuamini.securityclient.plist
```

### Issue: Reinstalling after uninstall fails

**Cause**: Incomplete cleanup or cached files

**Solution**:
```bash
# Complete cleanup
sudo pkill -9 KuaminiSecurityClient
sudo rm -rf /Applications/KuaminiSecurityClient.app
rm -rf ~/.kuamini
rm -f ~/Library/LaunchAgents/com.kuamini.securityclient.plist
rm -rf ~/Library/Caches/com.kuamini.*
rm -rf ~/Library/Application\ Support/KuaminiSecurityClient
sudo pkgutil --forget com.kuamini.securityclient

# Reboot
sudo reboot

# Retry installation after reboot
```

### Getting Diagnostic Information

Run this diagnostic script:

```bash
#!/bin/bash
echo "=== Kuamini Agent Diagnostics ==="

# 1. Process status
echo -e "\n[Process Status]"
ps aux | grep KuaminiSecurityClient | grep -v grep

# 2. Application
echo -e "\n[Application]"
ls -la /Applications/KuaminiSecurityClient.app

# 3. Configuration
echo -e "\n[Configuration]"
if [ -f ~/.kuamini/config.json ]; then
  echo "Config exists:"
  cat ~/.kuamini/config.json
else
  echo "Config NOT found"
fi

# 4. LaunchAgent
echo -e "\n[LaunchAgent]"
launchctl print gui/$UID/com.kuamini.securityclient 2>&1

# 5. Logs
echo -e "\n[Recent Logs]"
if [ -f ~/.kuamini/logs/agent.log ]; then
  tail -20 ~/.kuamini/logs/agent.log
else
  echo "Log file NOT found"
fi

# 6. Network
echo -e "\n[Network Test]"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://kuaminisystems.com/api/health

echo -e "\n=== End Diagnostics ==="
```

---

## Advanced Topics

### Silent Installation for Mass Deployment

```bash
# Create deployment script
#!/bin/bash
TOKEN="YOUR_REGISTRATION_TOKEN"

# Download and install silently
curl -sSL https://kuaminisystems.com/tray/install-kuamini-macos.sh | \
  bash -s -- --token "$TOKEN" --silent

# Verify installation
if pgrep -f KuaminiSecurityClient > /dev/null; then
  echo "Installation successful"
  exit 0
else
  echo "Installation failed"
  exit 1
fi
```

### Remote Deployment via SSH

```bash
# Deploy to multiple Macs
for host in mac1.local mac2.local mac3.local; do
  ssh user@$host "curl -sSL https://kuaminisystems.com/tray/install-kuamini-macos.sh | bash -s -- --token 'YOUR_TOKEN'"
done
```

### MDM/Jamf Deployment

1. Upload PKG to Jamf Pro or other MDM
2. Create policy to install PKG
3. Use script to add registration token:
```bash
#!/bin/bash
TOKEN="YOUR_TOKEN"
mkdir -p ~/.kuamini
echo "$TOKEN" > ~/.kuamini/registration.token
```

### Custom Registration Endpoint

```bash
# Edit configuration for custom API
cat > ~/.kuamini/config.json << EOF
{
  "api_base_url": "https://custom-domain.com/api/agent",
  "registration_token": "YOUR_TOKEN",
  "heartbeat_interval": 60
}
EOF
```

---

## Support & Resources

- **Documentation**: https://kuaminisystems.com/docs
- **Support Portal**: https://kuaminisystems.com/support
- **Console**: https://kuaminisystems.com/securityAgent
- **GitHub Issues**: Report bugs and feature requests

For installation issues, gather diagnostic information using the script above and contact support.

---

**Document Version**: 1.0.0  
**Last Updated**: February 8, 2026  
**Platform**: macOS 11+ (Big Sur, Monterey, Ventura, Sonoma, Sequoia)  
**Architectures**: Apple Silicon (M1/M2/M3) and Intel
