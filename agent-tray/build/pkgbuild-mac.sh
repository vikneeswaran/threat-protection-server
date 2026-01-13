#!/usr/bin/env bash
set -euo pipefail
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

# Create postinstall script
cat > "$SCRIPTS_DIR/postinstall" << 'EOF'
#!/bin/bash
set -euo pipefail

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
    # Export system CA certificates for curl
    /usr/bin/security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > /tmp/cacert.pem || true
    
    # Download config.json to temporary file
    TEMP_CONFIG="/tmp/kuamini_config_$$.json"
    if /usr/bin/curl --cacert /tmp/cacert.pem -fsSL -o "$TEMP_CONFIG" "$KUAMINI_INSTALL_URL" 2>/dev/null; then
        echo "Config downloaded successfully, merging with existing config"
        # Use Python to merge configs (registration_token from downloaded, api_base/console_url from local defaults if needed)
        /usr/bin/python3 << PYPYTHON
import json
try:
    with open('$TEMP_CONFIG', 'r') as f:
        downloaded = json.load(f)
    with open('$CONFIG_FILE', 'r') as f:
        existing = json.load(f)
    
    # Merge: keep defaults, override with downloaded values
    existing.update({
        k: v for k, v in downloaded.items() 
        if k in ['registration_token', 'account_id', 'agent_id']
    })
    existing['api_base'] = downloaded.get('api_base', '$DEFAULT_API_BASE')
    existing['console_url'] = downloaded.get('console_url', '$DEFAULT_CONSOLE_URL')
    existing['auto_register'] = True  # Always enable auto-register
    
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
    rm -f /tmp/cacert.pem || true
else
    echo "KUAMINI_INSTALL_URL not set, using default configuration"
fi

# Set ownership and permissions for the console user
/usr/sbin/chown -R "$CONSOLE_USER":"staff" "$CONFIG_DIR" 2>/dev/null || true
/bin/chmod 755 "$CONFIG_DIR" 2>/dev/null || true
/bin/chmod 644 "$CONFIG_FILE" 2>/dev/null || true

# Install and load LaunchAgent for the console user
PLIST_SRC="/Applications/KuaminiSecurityClient.app/Contents/MacOS/com.kuamini.securityclient.plist"
if [ ! -f "$PLIST_SRC" ]; then
    # Try Resources folder as fallback
    PLIST_SRC="/Applications/KuaminiSecurityClient.app/Contents/Resources/com.kuamini.securityclient.plist"
fi
PLIST_DST="$USER_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist"

if [ -f "$PLIST_SRC" ]; then
    mkdir -p "$USER_HOME/Library/LaunchAgents"
    cp "$PLIST_SRC" "$PLIST_DST"
    chown "$CONSOLE_USER:staff" "$PLIST_DST"
    chmod 644 "$PLIST_DST"
    
    # Try to load the LaunchAgent
    # Use su to run as the console user if not already them
    if [ "$(id -un)" = "$CONSOLE_USER" ]; then
        if /bin/launchctl bootstrap gui/$CONSOLE_UID "$PLIST_DST" 2>/dev/null; then
            echo "✅ LaunchAgent loaded successfully for $CONSOLE_USER"
        else
            echo "⚠️  Warning: Failed to bootstrap LaunchAgent for $CONSOLE_USER. You may need to log out/in or load it manually."
        fi
    else
        echo "⚠️  Warning: Failed to bootstrap LaunchAgent for $CONSOLE_USER. You may need to log out/in or load it manually."
    fi
else
    echo "❌ Warning: LaunchAgent plist not found. Tried:"
    echo "   - /Applications/KuaminiSecurityClient.app/Contents/MacOS/"
    echo "   - /Applications/KuaminiSecurityClient.app/Contents/Resources/"
fi

echo "Installation complete!"
exit 0
EOF

chmod +x "$SCRIPTS_DIR/postinstall"

# Create temporary root directory for packaging
# Note: pkgbuild with --root is more reliable than --component
TEMP_ROOT=$(mktemp -d)
trap "rm -rf $SCRIPTS_DIR $TEMP_ROOT" EXIT
mkdir -p "$TEMP_ROOT/Applications"
cp -r "dist/$APP_NAME" "$TEMP_ROOT/Applications/"

# Build PKG - use sudo to ensure correct permissions are preserved
sudo pkgbuild \
  --identifier com.kuamini.securityclient \
  --version 1.0.0 \
  --root "$TEMP_ROOT" \
  --scripts "$SCRIPTS_DIR" \
  --ownership preserve \
  dist/$PKG_NAME

# Fix permissions since sudo was used (use absolute path for chown)
sudo /usr/sbin/chown "$USER" dist/$PKG_NAME

echo "✅ Built pkg: dist/$PKG_NAME"
ls -lh dist/$PKG_NAME
