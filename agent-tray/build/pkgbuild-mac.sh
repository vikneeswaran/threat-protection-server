#!/usr/bin/env bash
# Don't use set -euo pipefail - causes issues during postinstall in installer environment
cd "$(dirname "$0")/.."

APP_NAME=KuaminiSecurityClient.app
PKG_NAME=KuaminiSecurityClient-1.0.0.pkg

if [ ! -d "dist/$APP_NAME" ]; then
  echo "dist/$APP_NAME not found. Run pyinstaller first." >&2
  exit 1
fi

# Create a temporary directory for PKG scripts
SCRIPTS_DIR=$(mktemp -d)
trap "rm -rf $SCRIPTS_DIR" EXIT

# Create postinstall script with improved LaunchAgent handling
cat > "$SCRIPTS_DIR/postinstall" << 'EOF'
#!/bin/bash
# Use +e to allow errors - macOS installer environment
set +euo pipefail

# Set explicit PATH for macOS installer environment
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Determine the active console user (not root)
CONSOLE_USER=$(/usr/bin/stat -f %Su /dev/console)
if [ -z "$CONSOLE_USER" ] || [ "$CONSOLE_USER" = "root" ]; then
    echo "Could not determine console user; continuing without per-user setup"
    CONSOLE_USER="$(/usr/bin/id -un 2>/dev/null || echo root)"
fi
CONSOLE_UID=$(/usr/bin/id -u "$CONSOLE_USER" 2>/dev/null || echo 0)
USER_HOME=$(dscl . -read "/Users/$CONSOLE_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
if [ -z "${USER_HOME:-}" ]; then
    USER_HOME="/Users/$CONSOLE_USER"
fi

echo "Postinstall running as $(id -un) for console user: $CONSOLE_USER ($CONSOLE_UID) home: $USER_HOME"

# Config directory for the console user
CONFIG_DIR="$USER_HOME/.kuamini"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"

# Initialize default config
DEFAULT_API_BASE="${KUAMINI_API_BASE:-https://kuaminisystems.com/api/agent}"
DEFAULT_CONSOLE_URL="${KUAMINI_CONSOLE_URL:-https://kuaminisystems.com/securityAgent}"

# If config doesn't exist, create a default one
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Creating default configuration at $CONFIG_FILE"
    cat > "$CONFIG_FILE" << EOFCONFIG
{
  "api_base": "$DEFAULT_API_BASE",
  "console_url": "$DEFAULT_CONSOLE_URL",
  "auto_register": true,
  "heartbeat_interval": 60
}
EOFCONFIG
    chmod 644 "$CONFIG_FILE"
fi

# If KUAMINI_INSTALL_URL is set, try to download and merge the config
if [ -n "${KUAMINI_INSTALL_URL:-}" ]; then
    echo "Downloading config from: $KUAMINI_INSTALL_URL"
    TEMP_CONFIG="/tmp/kuamini_config_$$.json"
    if /usr/bin/curl -fsSL -o "$TEMP_CONFIG" "$KUAMINI_INSTALL_URL" 2>/dev/null; then
        echo "Config downloaded successfully, merging with existing config"
        /usr/bin/python3 << PYPYTHON
import json
try:
    with open('$TEMP_CONFIG', 'r') as f:
        downloaded = json.load(f)
    with open('$CONFIG_FILE', 'r') as f:
        existing = json.load(f)
    
    existing.update({
        k: v for k, v in downloaded.items() 
        if k in ['registration_token', 'account_id', 'agent_id']
    })
    existing['api_base'] = downloaded.get('api_base', '$DEFAULT_API_BASE')
    existing['console_url'] = downloaded.get('console_url', '$DEFAULT_CONSOLE_URL')
    existing['auto_register'] = True
    
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(existing, f, indent=2)
    print("Configuration merged successfully")
except Exception as e:
    print(f"Warning: Could not merge config: {e}")
PYPYTHON
        rm -f "$TEMP_CONFIG"
    else
        echo "Warning: Failed to download config from $KUAMINI_INSTALL_URL; using defaults"
    fi
fi

# Set ownership and permissions for the console user
/usr/sbin/chown -R "$CONSOLE_USER":"staff" "$CONFIG_DIR" 2>/dev/null || true
/bin/chmod 755 "$CONFIG_DIR" 2>/dev/null || true
/bin/chmod 644 "$CONFIG_FILE" 2>/dev/null || true

# Extract app bundle from Scripts directory
# We embed the app directly in PKG Scripts for reliable installation
APP_BUNDLE="/Applications/KuaminiSecurityClient.app"

echo "Installing application bundle..."
echo "  Scripts directory: $2"

# $2 is the path to the Scripts directory during postinstall
if [ -d "$2/KuaminiSecurityClient.app" ]; then
    echo "  Found app bundle in Scripts directory"
    mkdir -p /Applications
    cp -r "$2/KuaminiSecurityClient.app" "$APP_BUNDLE"
    echo "✅ App successfully installed to /Applications"
else
    echo "⚠️  App bundle not found in Scripts directory"
fi

# LaunchAgent setup (optional - only if app is installed)
if [ -d "$APP_BUNDLE" ]; then
    echo "Setting up LaunchAgent..."
    PLIST_SRC=""
    
    # First, look in standard locations
    if [ -f "$APP_BUNDLE/Contents/Resources/com.kuamini.securityclient.plist" ]; then
        PLIST_SRC="$APP_BUNDLE/Contents/Resources/com.kuamini.securityclient.plist"
    elif [ -f "$APP_BUNDLE/Contents/com.kuamini.securityclient.plist" ]; then
        PLIST_SRC="$APP_BUNDLE/Contents/com.kuamini.securityclient.plist"
    fi
    
    # If still not found, create a LaunchAgent plist dynamically
    if [ -z "$PLIST_SRC" ]; then
        echo "  Creating LaunchAgent plist"
        PLIST_SRC="/tmp/com.kuamini.securityclient.plist.$$"
        
        # Create the plist with proper path to the executable
        cat > "$PLIST_SRC" << EOFPLIST
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
        <string>$USER_HOME</string>
    </dict>
</dict>
</plist>
EOFPLIST
    fi
    
    # Copy LaunchAgent plist to user's LaunchAgents directory
    PLIST_DST="$USER_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist"
    
    if [ -f "$PLIST_SRC" ]; then
        mkdir -p "$USER_HOME/Library/LaunchAgents"
        cp "$PLIST_SRC" "$PLIST_DST"
        chown "$CONSOLE_USER:staff" "$PLIST_DST" 2>/dev/null || true
        chmod 644 "$PLIST_DST" 2>/dev/null || true
        
        echo "✅ LaunchAgent plist installed"
        
        # Try to load the LaunchAgent
        sudo -u "$CONSOLE_USER" launchctl bootstrap "gui/$CONSOLE_UID" "$PLIST_DST" 2>/dev/null || \
        sudo -u "$CONSOLE_USER" launchctl enable "gui/$CONSOLE_UID/com.kuamini.securityclient" 2>/dev/null || \
        echo "  (Will load on next login)"
        
        # Clean up temporary plist if we created one
        if [ "$PLIST_SRC" != "$APP_BUNDLE/Contents/Resources/com.kuamini.securityclient.plist" ] && [ "$PLIST_SRC" != "$APP_BUNDLE/Contents/com.kuamini.securityclient.plist" ]; then
            rm -f "$PLIST_SRC"
        fi
    fi
else
    echo "⚠️  App not installed; skipping LaunchAgent setup"
fi

echo "✅ Installation complete!"
exit 0
EOF

chmod +x "$SCRIPTS_DIR/postinstall"

# Store the app bundle inside the Scripts directory
# This ensures it's available to postinstall
echo "Copying app bundle to Scripts directory..."
cp -r "dist/$APP_NAME" "$SCRIPTS_DIR/"

# Create a minimal root directory (required by pkgbuild even if empty)
TEMP_ROOT=$(mktemp -d)

# Build PKG with app bundle in Scripts directory
# postinstall will extract it from there
sudo pkgbuild \
  --identifier com.kuamini.securityclient \
  --version 1.0.0 \
  --root "$TEMP_ROOT" \
  --scripts "$SCRIPTS_DIR" \
  dist/$PKG_NAME

# Fix permissions
sudo /usr/sbin/chown "$USER" dist/$PKG_NAME

# Cleanup
rm -rf "$SCRIPTS_DIR" "$TEMP_ROOT"

echo "✅ Built pkg: dist/$PKG_NAME"
ls -lh dist/$PKG_NAME# Fix permissions
sudo /usr/sbin/chown "$USER" dist/$PKG_NAME

echo "✅ Built pkg: dist/$PKG_NAME"
ls -lh dist/$PKG_NAME
