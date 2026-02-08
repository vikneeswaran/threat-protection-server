# Linux Installation & Deployment Guide

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

The Kuamini Security Client for Linux provides enterprise-grade endpoint protection with centralized management. This guide covers complete installation, configuration, and deployment procedures for Linux environments.

### Key Features
- **Systemd Service**: Standard Linux system service
- **Auto-registration**: Automatic endpoint registration with management console
- **System Tray Integration**: Visual status indicator (for desktop environments)
- **Auto-start**: Runs automatically on system boot
- **Silent Installation**: Supports unattended deployment
- **Multi-distribution Support**: Works on Ubuntu, Debian, CentOS, RHEL, Fedora, and more

### System Requirements
- **OS**: Ubuntu 20.04+, Debian 10+, CentOS 8+, RHEL 8+, Fedora 34+
- **Init System**: systemd (required)
- **Privileges**: Root/sudo access for installation
- **Network**: HTTPS access to kuaminisystems.com
- **Disk Space**: ~50 MB minimum
- **Memory**: 100 MB RAM minimum

---

## Installation Methods

### Method 1: One-Line Shell Script (Recommended)

**Best for**: Quick deployment, console UI workflows

```bash
# Download and run installer
curl -sSL https://kuaminisystems.com/tray/install-kuamini-linux.sh | sudo bash

# Or with registration token
curl -sSL https://kuaminisystems.com/tray/install-kuamini-linux.sh | \
  sudo bash -s -- --token "YOUR_REGISTRATION_TOKEN"
```

### Method 2: Download and Execute

**Best for**: Review before execution, offline installation

```bash
# Download installer
curl -O https://kuaminisystems.com/tray/install-kuamini-linux.sh
chmod +x install-kuamini-linux.sh

# Review script
less install-kuamini-linux.sh

# Install
sudo ./install-kuamini-linux.sh
```

### Method 3: Manual Binary Installation

**Best for**: Custom installations, air-gapped environments

```bash
# Download agent binary
wget https://kuaminisystems.com/tray/linux.zip
unzip linux.zip -d /opt/kuamini-agent-tray

# Create service
sudo cp kuamini-agent-tray.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kuamini-agent-tray
sudo systemctl start kuamini-agent-tray
```

### Method 4: Package Manager (DEB/RPM)

**Best for**: Standard package management workflows

```bash
# Ubuntu/Debian
wget https://kuaminisystems.com/tray/kuamini-security-client_1.0.0_amd64.deb
sudo dpkg -i kuamini-security-client_1.0.0_amd64.deb

# CentOS/RHEL/Fedora
wget https://kuaminisystems.com/tray/kuamini-security-client-1.0.0-1.x86_64.rpm
sudo rpm -i kuamini-security-client-1.0.0-1.x86_64.rpm
```

---

## Prerequisites

### 1. Root/Sudo Access
Installation requires root privileges for:
- Installing to `/opt/kuamini-agent-tray`
- Creating systemd service
- Managing system users

### 2. Systemd Init System
Verify systemd is available:
```bash
systemctl --version
```

### 3. Network Access
Ensure firewall allows HTTPS connections:
```bash
# Test connectivity
curl -I https://kuaminisystems.com/api/health

# Configure firewall (if needed)
# UFW (Ubuntu/Debian)
sudo ufw allow out 443/tcp

# firewalld (CentOS/RHEL/Fedora)
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 4. Required Packages
Install dependencies:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y curl wget unzip systemd
```

**CentOS/RHEL/Fedora:**
```bash
sudo yum install -y curl wget unzip systemd
# Or for newer versions:
sudo dnf install -y curl wget unzip systemd
```

### 5. Registration Token (Optional)
Obtain token from console:
1. Log into https://kuaminisystems.com/securityAgent
2. Go to **Installers** section
3. Copy the registration token

---

## Installation Steps

### Complete Installation Flow

```
1. User downloads installer script
2. User runs: sudo ./install-kuamini-linux.sh
3. Script checks prerequisites (systemd, curl, etc.)
4. Script downloads agent bundle from CDN
5. Script extracts to /opt/kuamini-agent-tray
6. Script creates configuration in /etc/kuamini/config.json
7. Script creates systemd service file
8. Script enables and starts service
9. Agent generates agent_id on first run
10. Agent registers with console via API
11. Agent starts sending heartbeats every 60 seconds
12. Endpoint appears in console as "Online"
```

### Step-by-Step Instructions

#### Step 1: Prepare Environment
```bash
# Update system
sudo apt-get update  # Ubuntu/Debian
sudo yum update      # CentOS/RHEL

# Create temp directory
mkdir -p /tmp/kuamini-install
cd /tmp/kuamini-install
```

#### Step 2: Download Installer Script
```bash
# Download installer
wget https://kuaminisystems.com/tray/install-kuamini-linux.sh

# Make executable
chmod +x install-kuamini-linux.sh

# Review script (optional but recommended)
less install-kuamini-linux.sh
```

#### Step 3: Run Installer
```bash
# Basic installation
sudo ./install-kuamini-linux.sh

# Or with registration token
sudo ./install-kuamini-linux.sh --token "eyJ...your-token-here...QI="
```

#### Step 4: Verify Service Started
```bash
# Check service status
sudo systemctl status kuamini-agent-tray

# Expected output:
# ● kuamini-agent-tray.service - Kuamini Security Client
#      Loaded: loaded (/etc/systemd/system/kuamini-agent-tray.service; enabled)
#      Active: active (running)
```

---

## Configuration

### File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| **Executable** | `/opt/kuamini-agent-tray/KuaminiSecurityClient` | Main agent binary |
| **Configuration** | `/etc/kuamini/config.json` | Runtime configuration |
| **Logs** | `/var/log/kuamini/agent.log` | Agent activity logs |
| **Systemd Service** | `/etc/systemd/system/kuamini-agent-tray.service` | Service definition |
| **User Config** | `~/.local/share/KuaminiSecurityClient/config.json` | Per-user config (if running as user) |

### Configuration File Format

**Location**: `/etc/kuamini/config.json`

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

### Systemd Service Configuration

**Location**: `/etc/systemd/system/kuamini-agent-tray.service`

```ini
[Unit]
Description=Kuamini Security Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/kuamini-agent-tray/KuaminiSecurityClient
Restart=on-failure
RestartSec=10
User=root
Group=root
StandardOutput=journal
StandardError=journal

# Security settings
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/kuamini /etc/kuamini

[Install]
WantedBy=multi-user.target
```

### Modifying Configuration

```bash
# Edit configuration
sudo nano /etc/kuamini/config.json

# Example: Change heartbeat interval
sudo jq '.heartbeat_interval = 120' /etc/kuamini/config.json > /tmp/config.json
sudo mv /tmp/config.json /etc/kuamini/config.json

# Restart service to apply changes
sudo systemctl restart kuamini-agent-tray
```

---

## Verification

### Verify Installation

#### 1. Check Service Status
```bash
# Check if service is running
sudo systemctl status kuamini-agent-tray

# Check service logs
sudo journalctl -u kuamini-agent-tray -f
```

#### 2. Check Process
```bash
# Check if process is running
ps aux | grep KuaminiSecurityClient | grep -v grep

# Check process details
pgrep -af KuaminiSecurityClient
```

#### 3. Check Installation Files
```bash
# Verify binary exists
ls -la /opt/kuamini-agent-tray/KuaminiSecurityClient

# Verify configuration
cat /etc/kuamini/config.json

# Check permissions
ls -la /etc/kuamini
ls -la /var/log/kuamini
```

#### 4. Check System Tray Icon (Desktop Environments)
For systems with GUI:
- Look for Kuamini icon in system tray
- **Green**: Online and connected
- **Red**: Disconnected or error
- **Yellow**: Connecting/updating

#### 5. Check Logs
```bash
# View systemd logs
sudo journalctl -u kuamini-agent-tray -n 50

# View agent log file
sudo tail -f /var/log/kuamini/agent.log
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
   - **OS**: Linux (with distribution)
   - **Last Seen**: Within last 2 minutes

### Verify Auto-start

```bash
# Check if service is enabled
sudo systemctl is-enabled kuamini-agent-tray
# Should output: enabled

# Reboot and verify service starts automatically
sudo reboot

# After reboot, check status
sudo systemctl status kuamini-agent-tray
```

---

## Uninstallation

### Method 1: Automated Uninstaller (Recommended)

```bash
# Download uninstaller
curl -sSL https://kuaminisystems.com/tray/uninstall-kuamini-linux.sh | sudo bash

# Or download and execute
wget https://kuaminisystems.com/tray/uninstall-kuamini-linux.sh
chmod +x uninstall-kuamini-linux.sh
sudo ./uninstall-kuamini-linux.sh
```

### Method 2: Package Manager

```bash
# Ubuntu/Debian
sudo dpkg -r kuamini-security-client

# CentOS/RHEL/Fedora
sudo rpm -e kuamini-security-client
```

### Method 3: Manual Uninstallation

Complete step-by-step manual cleanup:

```bash
# 1. Stop service
sudo systemctl stop kuamini-agent-tray

# 2. Disable service
sudo systemctl disable kuamini-agent-tray

# 3. Remove service file
sudo rm -f /etc/systemd/system/kuamini-agent-tray.service

# 4. Reload systemd
sudo systemctl daemon-reload

# 5. Kill any remaining processes
sudo pkill -9 KuaminiSecurityClient

# 6. Remove installation directory
sudo rm -rf /opt/kuamini-agent-tray

# 7. Remove configuration
sudo rm -rf /etc/kuamini

# 8. Remove logs
sudo rm -rf /var/log/kuamini

# 9. Remove user data (if exists)
rm -rf ~/.local/share/KuaminiSecurityClient

# 10. Remove cache
rm -rf ~/.cache/kuamini

# 11. Verify removal
systemctl status kuamini-agent-tray
# Should show: Unit kuamini-agent-tray.service could not be found
```

### Deregister from Console

After uninstalling:
1. Log into https://kuaminisystems.com/securityAgent
2. Go to **Endpoints**
3. Find the uninstalled endpoint
4. Click "⋮" menu → **Uninstall/Remove**
5. Endpoint will be marked as offline

---

## Building from Source

### Prerequisites for Building

- Python 3.10 or later
- PyInstaller: `pip3 install pyinstaller`
- Build tools: `sudo apt-get install build-essential`

### Build Agent Binary

```bash
# Navigate to agent directory
cd agent-tray

# Install Python dependencies
pip3 install -r requirements.txt

# Clean previous builds
rm -rf dist build

# Build with PyInstaller
pyinstaller KuaminiSecurityClient-linux.spec

# Output: dist/KuaminiSecurityClient
```

### Create Distribution Package

**DEB Package (Ubuntu/Debian):**
```bash
# Install packaging tools
sudo apt-get install dpkg-dev fakeroot

# Create package structure
mkdir -p kuamini-package/opt/kuamini-agent-tray
mkdir -p kuamini-package/etc/systemd/system
mkdir -p kuamini-package/DEBIAN

# Copy files
cp dist/KuaminiSecurityClient kuamini-package/opt/kuamini-agent-tray/
cp kuamini-agent-tray.service kuamini-package/etc/systemd/system/

# Create control file
cat > kuamini-package/DEBIAN/control << EOF
Package: kuamini-security-client
Version: 1.0.0
Architecture: amd64
Maintainer: Kuamini Systems <support@kuaminisystems.com>
Description: Kuamini Security Client for endpoint protection
Depends: systemd
EOF

# Build package
dpkg-deb --build kuamini-package
mv kuamini-package.deb kuamini-security-client_1.0.0_amd64.deb
```

**RPM Package (CentOS/RHEL/Fedora):**
```bash
# Install packaging tools
sudo yum install rpm-build

# Create RPM spec file and build
# (Simplified - full spec file needed for production)
rpmbuild -ba kuamini-security-client.spec
```

### Deployment to CDN

```bash
# Copy built binary to public directory
cp dist/KuaminiSecurityClient ../public/tray/linux.zip

# Commit and push
git add public/tray/
git commit -m "chore: Update Linux installer to v1.0.0"
git push origin main

# Vercel will auto-deploy
```

---

## Troubleshooting

### Issue: Service fails to start

**Cause**: Permissions, missing dependencies, or configuration error

**Diagnostic Steps**:
```bash
# Check service status
sudo systemctl status kuamini-agent-tray

# Check detailed logs
sudo journalctl -u kuamini-agent-tray -n 100 --no-pager

# Check if binary is executable
ls -la /opt/kuamini-agent-tray/KuaminiSecurityClient

# Try running manually
sudo /opt/kuamini-agent-tray/KuaminiSecurityClient
```

**Solution**:
```bash
# Fix permissions
sudo chmod +x /opt/kuamini-agent-tray/KuaminiSecurityClient

# Reload systemd
sudo systemctl daemon-reload

# Restart service
sudo systemctl restart kuamini-agent-tray
```

### Issue: Agent not registering with console

**Cause**: Network issues, invalid token, or firewall blocking

**Diagnostic Steps**:
```bash
# 1. Check configuration
sudo cat /etc/kuamini/config.json

# 2. Test API connectivity
curl -v https://kuaminisystems.com/api/health

# 3. Check firewall
sudo iptables -L -n | grep 443
# Or for firewalld:
sudo firewall-cmd --list-all

# 4. Check logs for registration errors
sudo journalctl -u kuamini-agent-tray | grep -i "error\|fail\|register"
```

**Solution**:
1. Verify token in config.json
2. Check firewall rules
3. Review logs for specific error
4. Reinstall with fresh token

### Issue: "Failed to load shared libraries" error

**Cause**: Missing system libraries

**Solution**:
```bash
# Check missing libraries
ldd /opt/kuamini-agent-tray/KuaminiSecurityClient

# Install missing dependencies (Ubuntu/Debian)
sudo apt-get install -y libgtk-3-0 libappindicator3-1

# Install missing dependencies (CentOS/RHEL)
sudo yum install -y gtk3 libappindicator-gtk3
```

### Issue: Service keeps restarting

**Cause**: Application crash or configuration error

**Diagnostic**:
```bash
# Check restart count
systemctl show kuamini-agent-tray | grep NRestarts

# Check logs for errors
sudo journalctl -u kuamini-agent-tray -f
```

**Solution**:
```bash
# Review configuration
sudo nano /etc/kuamini/config.json

# Check permissions
sudo chown -R root:root /opt/kuamini-agent-tray
sudo chmod +x /opt/kuamini-agent-tray/KuaminiSecurityClient

# Restart service
sudo systemctl restart kuamini-agent-tray
```

### Issue: High CPU usage

**Cause**: Scanning large files or configuration issue

**Diagnostic**:
```bash
# Check CPU usage
top -p $(pgrep KuaminiSecurityClient)

# Check configuration
sudo cat /etc/kuamini/config.json
```

**Solution**:
```bash
# Adjust scan intervals
sudo nano /etc/kuamini/config.json
# Increase scan_interval value

# Restart service
sudo systemctl restart kuamini-agent-tray
```

### Issue: Permission denied errors in logs

**Cause**: Incorrect file permissions or SELinux/AppArmor restrictions

**Solution**:
```bash
# Fix permissions
sudo chown -R root:root /opt/kuamini-agent-tray
sudo chown -R root:root /etc/kuamini
sudo chown -R root:root /var/log/kuamini

# SELinux (if applicable)
sudo setenforce 0  # Temporarily disable
sudo ausearch -m avc -ts recent  # Check denials

# AppArmor (if applicable)
sudo aa-status
sudo aa-complain /opt/kuamini-agent-tray/KuaminiSecurityClient
```

### Issue: System tray icon not showing (Desktop Environment)

**Cause**: Missing tray support libraries or desktop environment limitations

**Solution**:
```bash
# Install tray support (Ubuntu/Debian)
sudo apt-get install libappindicator3-1 gir1.2-appindicator3-0.1

# Install tray support (Fedora)
sudo dnf install libappindicator-gtk3

# Restart service
sudo systemctl restart kuamini-agent-tray
```

### Getting Diagnostic Information

Run this comprehensive diagnostic script:

```bash
#!/bin/bash
echo "=== Kuamini Agent Diagnostics ==="

# 1. Service status
echo -e "\n[Service Status]"
sudo systemctl status kuamini-agent-tray --no-pager

# 2. Process status
echo -e "\n[Process Status]"
ps aux | grep KuaminiSecurityClient | grep -v grep

# 3. Installation files
echo -e "\n[Installation Files]"
ls -la /opt/kuamini-agent-tray/

# 4. Configuration
echo -e "\n[Configuration]"
if [ -f /etc/kuamini/config.json ]; then
  sudo cat /etc/kuamini/config.json
else
  echo "Config NOT found"
fi

# 5. Logs
echo -e "\n[Recent Logs]"
sudo journalctl -u kuamini-agent-tray -n 30 --no-pager

# 6. Network
echo -e "\n[Network Test]"
curl -s -o /dev/null -w "Status: %{http_code}\n" https://kuaminisystems.com/api/health

# 7. System info
echo -e "\n[System Info]"
uname -a
cat /etc/os-release

echo -e "\n=== End Diagnostics ==="
```

---

## Advanced Topics

### Silent Installation for Mass Deployment

```bash
# Create deployment script
#!/bin/bash
TOKEN="YOUR_REGISTRATION_TOKEN"

# Install silently
curl -sSL https://kuaminisystems.com/tray/install-kuamini-linux.sh | \
  sudo bash -s -- --token "$TOKEN" --silent

# Verify installation
if systemctl is-active --quiet kuamini-agent-tray; then
  echo "Installation successful"
  exit 0
else
  echo "Installation failed"
  exit 1
fi
```

### Ansible Deployment

```yaml
# playbook.yml
---
- name: Deploy Kuamini Security Client
  hosts: linux_servers
  become: yes
  vars:
    registration_token: "YOUR_TOKEN"
  
  tasks:
    - name: Download installer
      get_url:
        url: https://kuaminisystems.com/tray/install-kuamini-linux.sh
        dest: /tmp/install-kuamini.sh
        mode: '0755'
    
    - name: Run installer
      shell: /tmp/install-kuamini.sh --token "{{ registration_token }}"
      args:
        creates: /opt/kuamini-agent-tray/KuaminiSecurityClient
    
    - name: Ensure service is running
      systemd:
        name: kuamini-agent-tray
        state: started
        enabled: yes
```

### Docker Container Deployment

```dockerfile
# Dockerfile
FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y curl wget systemd && \
    curl -sSL https://kuaminisystems.com/tray/install-kuamini-linux.sh | bash

CMD ["/opt/kuamini-agent-tray/KuaminiSecurityClient"]
```

### Custom systemd Configuration

```bash
# Create drop-in directory
sudo mkdir -p /etc/systemd/system/kuamini-agent-tray.service.d/

# Create override file
sudo cat > /etc/systemd/system/kuamini-agent-tray.service.d/override.conf << 'EOF'
[Service]
Environment="LOG_LEVEL=DEBUG"
Restart=always
RestartSec=5
EOF

# Reload systemd
sudo systemctl daemon-reload

# Restart service
sudo systemctl restart kuamini-agent-tray
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
**Platform**: Linux (Ubuntu, Debian, CentOS, RHEL, Fedora)  
**Init System**: systemd
