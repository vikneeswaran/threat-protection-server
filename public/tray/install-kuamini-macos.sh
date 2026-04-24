#!/bin/bash

##########################################################
# Kuamini Security Client - macOS Installer
# Supports token-aware install for one-line curl flow.
##########################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Kuamini Security Client Installer"
echo "===================================="
echo ""

TOKEN=""
PKG_FILE=""
BASE_URL="${KUAMINI_BASE_URL:-https://kuaminisystems.com}"

version_is_greater_or_equal() {
    local left="$1"
    local right="$2"
    local left_parts right_parts
    local left_len right_len max_len i left_part right_part

    IFS='.' read -r -a left_parts <<< "$left"
    IFS='.' read -r -a right_parts <<< "$right"

    left_len=${#left_parts[@]}
    right_len=${#right_parts[@]}
    max_len=$left_len
    if [ "$right_len" -gt "$max_len" ]; then
        max_len=$right_len
    fi

    for ((i = 0; i < max_len; i++)); do
        left_part=${left_parts[i]:-0}
        right_part=${right_parts[i]:-0}

        if ((10#$left_part > 10#$right_part)); then
            return 0
        fi
        if ((10#$left_part < 10#$right_part)); then
            return 1
        fi
    done

    return 0
}

find_latest_pkg() {
    local search_dir="$1"
    local latest_version=""
    local latest_file=""
    local file base version

    while IFS= read -r -d '' file; do
        base="$(basename "$file")"
        if [[ "$base" =~ ^KuaminiSecurityClient-([0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?)\.pkg$ ]]; then
            version="${BASH_REMATCH[1]}"
            if [ -z "$latest_version" ] || version_is_greater_or_equal "$version" "$latest_version"; then
                latest_version="$version"
                latest_file="$file"
            fi
        fi
    done < <(find "$search_dir" -maxdepth 1 -type f -name "KuaminiSecurityClient-*.pkg" -print0 2>/dev/null)

    printf '%s' "$latest_file"
}

# Parse arguments:
#   install-kuamini-macos.sh <TOKEN>
#   install-kuamini-macos.sh <PKG_PATH>
#   install-kuamini-macos.sh <TOKEN> <PKG_PATH>
if [ $# -ge 1 ]; then
    if [[ "$1" == *.pkg ]] || [ -f "$1" ]; then
        PKG_FILE="$1"
    else
        TOKEN="$1"
    fi
fi

if [ $# -ge 2 ]; then
    PKG_FILE="$2"
fi

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo "This installer requires root privileges."
    echo "Re-running with sudo..."
    SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"

    TEMP_SCRIPT="/tmp/kuamini-install.$$.$(date +%s).sh"
    CLEANUP_TEMP=1
    trap '[ "${CLEANUP_TEMP:-0}" -eq 1 ] && rm -f "$TEMP_SCRIPT" 2>/dev/null || true' EXIT

    # If script was launched from a real file, copy it.
    # If launched via process substitution (<(curl ...)), /dev/fd is a stream and
    # copying it from current read position produces a truncated script.
    if [ -f "$SCRIPT_SELF" ] && [ -r "$SCRIPT_SELF" ]; then
        cp "$SCRIPT_SELF" "$TEMP_SCRIPT"
    else
        INSTALLER_URL="$BASE_URL/tray/install-kuamini-macos.sh"
        if ! /usr/bin/curl -fsSL "$INSTALLER_URL" -o "$TEMP_SCRIPT"; then
            echo -e "${RED}❌ Error: Unable to fetch installer for sudo re-run.${NC}"
            echo -e "${YELLOW}ℹ️  Save the script to a local file and run: sudo ./install-kuamini-macos.sh <TOKEN>${NC}"
            exit 1
        fi
    fi

    chmod 700 "$TEMP_SCRIPT"
    CLEANUP_TEMP=0
    exec sudo "$TEMP_SCRIPT" "$@"
fi

# Get the console user (the user who initiated sudo, not root)
if [ -n "${SUDO_USER:-}" ]; then
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

if [ -n "$TOKEN" ]; then
    echo "🔑 Registration token provided"
else
    echo -e "${YELLOW}⚠️  No registration token provided.${NC}"
    echo -e "${YELLOW}   Agent may fail to register unless default account auto-registration is available.${NC}"
fi

echo ""

# CRITICAL: Write config IMMEDIATELY after determining console user and before any PKG discovery
# This ensures token is persisted even if PKG discovery fails or installer exits early.
echo "🔧 Preparing configuration..."
CONFIG_DIR="$ACTUAL_HOME/.kuamini"
/bin/mkdir -p "$CONFIG_DIR"
/usr/sbin/chown "$CONSOLE_USER:staff" "$CONFIG_DIR" || true
/bin/chmod 755 "$CONFIG_DIR" || true
CONFIG_FILE="$CONFIG_DIR/config.json"
AGENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
if [ -n "$TOKEN" ]; then
    cat > "$CONFIG_FILE" << EOF
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60,
  "agent_id": "$AGENT_ID",
  "registration_token": "$TOKEN"
}
EOF
else
    cat > "$CONFIG_FILE" << EOF
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60,
  "agent_id": "$AGENT_ID"
}
EOF
fi
/usr/sbin/chown "$CONSOLE_USER:staff" "$CONFIG_FILE" || true
/bin/chmod 644 "$CONFIG_FILE" || true
echo ""


# The PKG file should be in the same directory as this script, or passed as argument
if [ -z "$PKG_FILE" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Pick latest versioned PKG in script directory first, then /tmp fallback.
    # Use Bash comparison instead of GNU sort -V because macOS ships BSD sort.
    PKG_FILE="$(find_latest_pkg "$SCRIPT_DIR")"

    if [ -z "$PKG_FILE" ] || [ ! -f "$PKG_FILE" ]; then
        PKG_FILE="$(find_latest_pkg /tmp)"
    fi

    # One-line curl installs usually don't have a local PKG. Download from server.
    if [ -z "$PKG_FILE" ] || [ ! -f "$PKG_FILE" ]; then
        PKG_FILE="/tmp/KuaminiSecurityClient-latest.pkg"

        # Enumerate versioned PKG files on the server (add new versions here as they are released)
        DOWNLOAD_URLS=(
            "$BASE_URL/tray/KuaminiSecurityClient-1.0.0.pkg"
        )

        echo "⬇️  Downloading macOS package..."
        DOWNLOADED=0
        for url in "${DOWNLOAD_URLS[@]}"; do
            if /usr/bin/curl -fsSL "$url" -o "$PKG_FILE"; then
                DOWNLOADED=1
                break
            fi
        done

        if [ "$DOWNLOADED" -ne 1 ]; then
            echo -e "${RED}❌ Error: Failed to download macOS installer package.${NC}"
            echo -e "${YELLOW}ℹ️  Checked URLs:${NC}"
            for url in "${DOWNLOAD_URLS[@]}"; do
                echo "   - $url"
            done
            exit 1
        fi
    fi
fi

if [ ! -f "$PKG_FILE" ]; then
    echo -e "${RED}❌ Error: PKG file not found: $PKG_FILE${NC}"
    exit 1
fi

echo "📦 Installing from: $PKG_FILE"
echo ""

# Install the PKG with Apple's installer
/usr/sbin/installer -pkg "$PKG_FILE" -target /

# Verify the app exists. Some environments report install success but do not materialize
# the app bundle under /Applications; in that case, extract payload manually as fallback.
if [ ! -f /Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient ]; then
    echo -e "${YELLOW}⚠️  App bundle not found after installer step. Trying fallback extraction...${NC}"
    # Clean up any stale temp dirs from previous failed runs
    rm -rf /tmp/kuamini-pkg-expand.* 2>/dev/null || true
    TMP_EXPAND_DIR="/tmp/kuamini-pkg-expand.$$"
    rm -rf "$TMP_EXPAND_DIR"
    trap 'rm -rf "$TMP_EXPAND_DIR"' EXIT

    if /usr/sbin/pkgutil --expand-full "$PKG_FILE" "$TMP_EXPAND_DIR" 2>/tmp/kuamini-pkgutil-err.log; then
        APP_SOURCE=""

        # Preferred known location
        if [ -d "$TMP_EXPAND_DIR/Payload/Applications/KuaminiSecurityClient.app" ]; then
            APP_SOURCE="$TMP_EXPAND_DIR/Payload/Applications/KuaminiSecurityClient.app"
        else
            # Fallback: search entire expanded directory for the app bundle
            APP_SOURCE=$(find "$TMP_EXPAND_DIR" -type d -name "KuaminiSecurityClient.app" 2>/dev/null | head -n 1 || true)
        fi

        if [ -n "$APP_SOURCE" ] && [ -d "$APP_SOURCE" ]; then
            rm -rf /Applications/KuaminiSecurityClient.app
            /usr/bin/ditto "$APP_SOURCE" /Applications/KuaminiSecurityClient.app
            echo -e "${GREEN}✅ Restored app bundle from package payload${NC}"
        else
            echo -e "${YELLOW}⚠️  Expanded package but could not locate KuaminiSecurityClient.app${NC}"
            find "$TMP_EXPAND_DIR" -maxdepth 4 -print 2>/dev/null | sed -n '1,50p'
        fi
    else
        echo -e "${YELLOW}⚠️  pkgutil --expand-full failed for fallback extraction${NC}"
        cat /tmp/kuamini-pkgutil-err.log 2>/dev/null || true
    fi

    if [ ! -f /Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient ]; then
        echo -e "${RED}❌ Error: Application bundle not found after install${NC}"
        echo -e "${YELLOW}ℹ️  Check whether the PKG contains the app with:${NC}"
        echo "   pkgutil --expand-full \"$PKG_FILE\" /tmp/kuamini_pkg_expanded && ls /tmp/kuamini_pkg_expanded/Payload/Applications"
        exit 1
    fi
fi

# Remove quarantine attribute that macOS Gatekeeper adds to unsigned app bundles
# (on macOS 13+ / Sequoia this silently prevents the binary from running otherwise)
/usr/bin/xattr -dr com.apple.quarantine /Applications/KuaminiSecurityClient.app 2>/dev/null || true

# Fix permissions
/bin/chmod -R 755 /Applications/KuaminiSecurityClient.app
/usr/sbin/chown -R root:wheel /Applications/KuaminiSecurityClient.app

echo "✅ Application installed to /Applications/KuaminiSecurityClient.app"
echo ""

# Config was written above before the installer ran.
# Ensure ownership is correct in case postinstall script modified it.
/usr/sbin/chown "$CONSOLE_USER:staff" "$CONFIG_FILE" || true
/bin/chmod 644 "$CONFIG_FILE" || true

# Install LaunchAgent
echo "🚀 Installing launch agent..."
/bin/mkdir -p "$ACTUAL_HOME/Library/LaunchAgents"

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

/usr/sbin/chown "$CONSOLE_USER:staff" "$PLIST_FILE" || true
/bin/chmod 644 "$PLIST_FILE" || true

# Get numeric UID and reload agent cleanly
USER_UID=$(id -u "$CONSOLE_USER")

echo "⚡ Starting security agent..."
sudo -u "$CONSOLE_USER" launchctl bootout "gui/$USER_UID" "$PLIST_FILE" 2>/dev/null || true
sudo -u "$CONSOLE_USER" launchctl bootstrap "gui/$USER_UID" "$PLIST_FILE"
sudo -u "$CONSOLE_USER" launchctl kickstart -k "gui/$USER_UID/com.kuamini.securityclient" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "The Kuamini Security Client has been installed successfully."
echo ""
echo "Next steps:"
echo "1. The security agent will start automatically"
echo "2. Check the menu bar for the Kuamini icon (top right)"
echo "3. Verify endpoint appears online in console"
echo ""
echo "For support, visit: https://kuaminisystems.com"

exit 0
