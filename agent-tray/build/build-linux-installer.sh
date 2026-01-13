#!/bin/bash
# Linux Shell Installer Builder for Kuamini Security Client
set -e

echo "===== Building Linux Shell Installer ====="

# Configuration
APP_NAME="KuaminiSecurityClient"
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/../dist"
EXE_DIR="$DIST_DIR/$APP_NAME"
INSTALLER_FILE="$DIST_DIR/$APP_NAME-$VERSION.sh"

if [ ! -d "$EXE_DIR" ]; then
    echo "ERROR: $EXE_DIR not found. Run PyInstaller first!"
    exit 1
fi

echo "[OK] Found executable directory: $EXE_DIR"

# Create tarball
echo "Creating application tarball..."
cd "$DIST_DIR"
tar -czf "$APP_NAME.tar.gz" "$APP_NAME"
echo "[OK] Created tarball"

# Create self-extracting installer
echo "Creating self-extracting installer..."

cat > "$INSTALLER_FILE" << 'EOF'
#!/bin/bash
# Kuamini Security Client Installer for Linux
set -e

APP_NAME="KuaminiSecurityClient"
INSTALL_DIR="/opt/kuamini-security-client"
SERVICE_NAME="kuamini-security-client"
CONFIG_DIR="$HOME/.kuamini"

echo "===== Kuamini Security Client Installer ====="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Please run as root (use sudo)"
    exit 1
fi

echo "Installing to: $INSTALL_DIR"

# Extract payload
echo "Extracting files..."
ARCHIVE=$(awk '/^__ARCHIVE_BELOW__/ {print NR + 1; exit 0; }' "$0")
tail -n+$ARCHIVE "$0" | tar xz -C /tmp

# Create installation directory
mkdir -p "$INSTALL_DIR"
cp -r "/tmp/$APP_NAME"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/$APP_NAME"

echo "[OK] Files extracted"

# Create systemd service
echo "Creating systemd service..."

cat > "/etc/systemd/system/$SERVICE_NAME.service" << SERVICEEOF
[Unit]
Description=Kuamini Security Client
After=network.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/$APP_NAME
Restart=always
RestartSec=10
Environment="HOME=/root"

[Install]
WantedBy=multi-user.target
SERVICEEOF

echo "[OK] Service created"

# Create default config
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.json" << CONFIGEOF
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60
}
CONFIGEOF

echo "[OK] Default config created"

# Enable and start service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo "[OK] Service started"

# Cleanup
rm -rf "/tmp/$APP_NAME"

echo ""
echo "===== Installation Complete! ====="
echo ""
echo "Service Status:"
systemctl status "$SERVICE_NAME" --no-pager || true
echo ""
echo "To uninstall, run:"
echo "  sudo systemctl stop $SERVICE_NAME"
echo "  sudo systemctl disable $SERVICE_NAME"
echo "  sudo rm -rf $INSTALL_DIR"
echo "  sudo rm /etc/systemd/system/$SERVICE_NAME.service"
echo "  sudo systemctl daemon-reload"
echo ""

exit 0

__ARCHIVE_BELOW__
EOF

# Append tarball
cat "$APP_NAME.tar.gz" >> "$INSTALLER_FILE"
chmod +x "$INSTALLER_FILE"

# Cleanup
rm "$APP_NAME.tar.gz"

echo "[OK] Created self-extracting installer"
echo ""
echo "===== Build Complete! ====="
echo "Installer: $INSTALLER_FILE"
echo "Size: $(du -h "$INSTALLER_FILE" | cut -f1)"
