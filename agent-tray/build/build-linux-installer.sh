#!/bin/bash
# Build Linux Installer
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="1.0.0"
INSTALLER_NAME="KuaminiSecurityClient-${VERSION}.sh"
APP_DIR="dist/KuaminiSecurityClient"

if [ ! -f "$APP_DIR/KuaminiSecurityClient" ]; then
  echo "Error: $APP_DIR/KuaminiSecurityClient not found. Run PyInstaller first." >&2
  exit 1
fi

# Create self-extracting installer script
cat > "dist/$INSTALLER_NAME" << 'INSTALLER_SCRIPT'
#!/bin/bash
set -euo pipefail

# Self-extracting installer for KuaminiSecurityClient
VERSION="1.0.0"
INSTALL_DIR="/opt/kuamini-security-client"
CONFIG_DIR="$HOME/.kuamini"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
LAUNCHER_SCRIPT="/usr/local/bin/kuamini-security-client"

echo "=== Kuamini Security Client Installer v$VERSION ==="
echo "Installation directory: $INSTALL_DIR"
echo "Config directory: $CONFIG_DIR"
echo ""

# Check if running with proper permissions
if [ ! -w "/opt" ] 2>/dev/null; then
  echo "Error: Need write permissions to /opt. Please run with sudo or check permissions."
  exit 1
fi

# Create installation directory
echo "Creating installation directory..."
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$CONFIG_DIR"

# Extract files
echo "Extracting files..."
PAYLOAD_START=$(grep -na '^__PAYLOAD_START__$' "$0" | cut -d: -f1)
PAYLOAD_START=$((PAYLOAD_START + 1))
tail -n +$PAYLOAD_START "$0" | sudo tar -xz -C "$INSTALL_DIR"

# Set permissions
echo "Setting permissions..."
sudo chmod +x "$INSTALL_DIR/KuaminiSecurityClient"
sudo chown -R "$USER:$USER" "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

# Create systemd service for user
echo "Setting up autostart..."
mkdir -p "$SYSTEMD_USER_DIR"
cat > "$SYSTEMD_USER_DIR/kuamini-security-client.service" << 'SYSTEMD_SERVICE'
[Unit]
Description=Kuamini Security Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/kuamini-security-client/KuaminiSecurityClient
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
SYSTEMD_SERVICE

# Enable and start service
systemctl --user daemon-reload
systemctl --user enable kuamini-security-client
systemctl --user restart kuamini-security-client

# Create launcher script
echo "Creating launcher script..."
cat > "$LAUNCHER_SCRIPT" << 'LAUNCHER'
#!/bin/bash
/opt/kuamini-security-client/KuaminiSecurityClient "$@"
LAUNCHER
sudo chmod +x "$LAUNCHER_SCRIPT"

echo ""
echo "=== Installation Complete ==="
echo "The Kuamini Security Client has been installed successfully!"
echo ""
echo "To verify installation, run:"
echo "  systemctl --user status kuamini-security-client"
echo ""
echo "To view logs:"
echo "  journalctl --user -u kuamini-security-client -f"
echo ""
echo "To uninstall, run:"
echo "  bash /opt/kuamini-security-client/uninstall.sh"
echo ""

exit 0

__PAYLOAD_START__
INSTALLER_SCRIPT

# Create uninstall script to be included in the payload
mkdir -p dist/payload
cat > dist/payload/uninstall.sh << 'UNINSTALL_SCRIPT'
#!/bin/bash
set -euo pipefail

echo "=== Kuamini Security Client Uninstaller ==="
echo "This will uninstall the Kuamini Security Client."
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Uninstall cancelled."
  exit 0
fi

INSTALL_DIR="/opt/kuamini-security-client"
CONFIG_DIR="$HOME/.kuamini"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
LAUNCHER_SCRIPT="/usr/local/bin/kuamini-security-client"

echo "Stopping service..."
systemctl --user stop kuamini-security-client 2>/dev/null || true
systemctl --user disable kuamini-security-client 2>/dev/null || true

echo "Removing installation files..."
sudo rm -rf "$INSTALL_DIR"
sudo rm -f "$LAUNCHER_SCRIPT"
rm -f "$SYSTEMD_USER_DIR/kuamini-security-client.service"

echo ""
echo "=== Uninstallation Complete ==="
echo "Config files remain in: $CONFIG_DIR"
echo "To remove them, run: rm -rf $CONFIG_DIR"
echo ""
UNINSTALL_SCRIPT

chmod +x dist/payload/uninstall.sh

# Copy app files to payload
cp -r "$APP_DIR"/* dist/payload/ 2>/dev/null || true

# Create tar archive
echo "Creating archive..."
tar -czf dist/payload.tar.gz -C dist/payload .

# Append to installer
cat dist/payload.tar.gz >> "dist/$INSTALLER_NAME"

# Make installer executable
chmod +x "dist/$INSTALLER_NAME"

# Clean up
rm -rf dist/payload dist/payload.tar.gz

echo "✅ Built installer: dist/$INSTALLER_NAME"
ls -lh "dist/$INSTALLER_NAME"
