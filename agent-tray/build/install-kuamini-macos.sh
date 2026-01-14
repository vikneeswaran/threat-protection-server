#!/bin/bash

##########################################################
# Kuamini Security Client - Macintosh Installer
# This script extracts and installs the Kuamini Security Client
##########################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Kuamini Security Client Installer"
echo "===================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo "This installer requires root privileges."
    echo "Re-running with sudo..."
    exec sudo "$0" "$@"
fi

# Get the console user (the user who initiated sudo, not root)
if [ -n "$SUDO_USER" ]; then
    CONSOLE_USER="$SUDO_USER"
    ACTUAL_HOME=$(eval echo ~"$SUDO_USER")
else
    CONSOLE_USER="$(who | grep '(console)' | awk '{print $1}')"
    ACTUAL_HOME="$HOME"
fi

if [ -z "$CONSOLE_USER" ]; then
    echo -e "${RED}❌ Error: Could not determine console user${NC}"
    exit 1
fi

echo "👤 Installing for user: $CONSOLE_USER"
echo ""

# The PKG file should be in the same directory as this script, or passed as argument
if [ $# -eq 1 ]; then
    PKG_FILE="$1"
else
    # Try to find the PKG in common locations
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    PKG_FILE="$SCRIPT_DIR/KuaminiSecurityClient-1.0.0.pkg"
    
    if [ ! -f "$PKG_FILE" ]; then
        PKG_FILE="/tmp/KuaminiSecurityClient-1.0.0.pkg"
    fi
fi

if [ ! -f "$PKG_FILE" ]; then
    echo -e "${RED}❌ Error: PKG file not found: $PKG_FILE${NC}"
    exit 1
fi

echo "📦 Installing from: $PKG_FILE"
echo ""

# Create a temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "🔧 Extracting package..."
pkgutil --expand-full "$PKG_FILE" "$TEMP_DIR/pkg"

# Check if extraction was successful
if [ ! -d "$TEMP_DIR/pkg/Payload" ]; then
    echo -e "${RED}❌ Error: Could not extract package payload${NC}"
    exit 1
fi

# Check if app exists in payload
if [ ! -d "$TEMP_DIR/pkg/Payload/Applications/KuaminiSecurityClient.app" ]; then
    echo -e "${RED}❌ Error: App bundle not found in package${NC}"
    exit 1
fi

echo "📁 Copying application bundle..."
# Remove any existing installation first
rm -rf /Applications/KuaminiSecurityClient.app

# Extract the Payload to the root filesystem
cd "$TEMP_DIR/pkg/Payload"
tar -cf - . | tar -xf - -C / 2>/dev/null || true

# Verify the copy was successful
if [ ! -f /Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient ]; then
    echo -e "${RED}❌ Error: Failed to copy application bundle${NC}"
    exit 1
fi

# Fix permissions
chmod -R 755 /Applications/KuaminiSecurityClient.app
chown -R root:wheel /Applications/KuaminiSecurityClient.app

echo "✅ Application installed to /Applications/KuaminiSecurityClient.app"
echo ""

# Create config directory for the user
CONFIG_DIR="$ACTUAL_HOME/.kuamini"
if [ ! -d "$CONFIG_DIR" ]; then
    echo "🔧 Creating configuration directory..."
    mkdir -p "$CONFIG_DIR"
    chown "$CONSOLE_USER:staff" "$CONFIG_DIR"
    chmod 755 "$CONFIG_DIR"
fi

# Create default config if it doesn't exist
CONFIG_FILE="$CONFIG_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "🔧 Creating default configuration..."
    cat > "$CONFIG_FILE" << 'EOF'
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60
}
EOF
    chown "$CONSOLE_USER:staff" "$CONFIG_FILE"
    chmod 644 "$CONFIG_FILE"
fi

# Install LaunchAgent
echo "🚀 Installing launch agent..."
mkdir -p "$ACTUAL_HOME/Library/LaunchAgents"

PLIST_FILE="$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist"
cat > "$PLIST_FILE" << EOF
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
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/kuamini-agent-out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/kuamini-agent-err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>$ACTUAL_HOME</string>
    </dict>
</dict>
</plist>
EOF

chown "$CONSOLE_USER:staff" "$PLIST_FILE"
chmod 644 "$PLIST_FILE"

# Get the numeric UID for the user
USER_UID=$(id -u "$CONSOLE_USER")

# Load the LaunchAgent
echo "⚡ Starting security agent..."
sudo -u "$CONSOLE_USER" launchctl bootstrap "gui/$USER_UID" "$PLIST_FILE" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "The Kuamini Security Client has been installed successfully."
echo ""
echo "Next steps:"
echo "1. The security agent will start automatically"
echo "2. Check the menu bar for the Kuamini icon (top right)"
echo "3. Visit the console to manage your security settings"
echo ""
echo "The agent is running in the background and will:"
echo "• Automatically register with the console"
echo "• Send periodic status updates"
echo "• Protect your system from threats"
echo ""
echo "For support, visit: https://kuaminisystems.com"

exit 0
