#!/bin/bash
# Linux Shell Installer Builder for Kuamini Security Client
# This script creates a self-extracting shell installer

set -e

echo "===== Building Linux Shell Installer ====="

# Configuration
APP_NAME="KuaminiSecurityClient"
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/../dist"
EXE_DIR="$DIST_DIR/$APP_NAME"
INSTALLER_FILE="$DIST_DIR/$APP_NAME-$VERSION.sh"

# Check if dist/KuaminiSecurityClient exists
if [ ! -d "$EXE_DIR" ]; then
    echo "ERROR: $EXE_DIR not found. Run PyInstaller first!"
    exit 1
fi

echo "✓ Found executable directory: $EXE_DIR"

# Create tarball of the app
echo "Creating application tarball..."
cd "$DIST_DIR"
tar -czf "$APP_NAME.tar.gz" "$APP_NAME"
echo "✓ Created tarball"

# Create self-extracting installer script
echo "Creating self-extracting installer..."

cat > "$INSTALLER_FILE" << 'EOF'
#!/bin/bash
# Kuamini Security Client Installer for Linux
# Self-extracting installer

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
echo ""

# Extract payload
echo "Extracting files..."
ARCHIVE=$(awk '/^__ARCHIVE_BELOW__/ {print NR + 1; exit 0; }' "$0")
tail -n+$ARCHIVE "$0" | tar xz -C /tmp

# Create installation directory
mkdir -p "$INSTALL_DIR"
cp -r "/tmp/$APP_NAME"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/$APP_NAME"

echo "✓ Files extracted"

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

[Install]
WantedBy=multi-user.target
SERVICEEOF

echo "✓ Service created"

# Enable and start service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo "✓ Service started"

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
echo ""

exit 0

__ARCHIVE_BELOW__
EOF

# Append the tarball to the script
cat "$APP_NAME.tar.gz" >> "$INSTALLER_FILE"
chmod +x "$INSTALLER_FILE"

# Cleanup
rm "$APP_NAME.tar.gz"

echo "✓ Created self-extracting installer"
echo ""
echo "===== Build Complete! ====="
echo "Installer: $INSTALLER_FILE"
echo "Size: $(du -h "$INSTALLER_FILE" | cut -f1)"
