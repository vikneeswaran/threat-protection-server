#!/bin/bash
# Kuamini Security Client Uninstaller for macOS
# Removes all traces and deregisters from console

set -e

echo "🗑️  Kuamini Security Client Uninstaller"
echo "======================================="
echo ""

# Check if running as user (not root)
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Please run as normal user (not sudo)"
    exit 1
fi

# Tool paths (avoid "command not found" on sudo env)
LAUNCHCTL="/bin/launchctl"
PKGUTIL="/usr/sbin/pkgutil"

# API base URL (default to production, can override)
API_BASE="${API_BASE:-https://kuaminisystems.com/api/agent}"

# Read agent_id from config if it exists
AGENT_ID=""
CONFIG_FILE="$HOME/.kuamini/config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "📋 Found config file, reading agent_id..."
    AGENT_ID=$(grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    if [ -n "$AGENT_ID" ]; then
        echo "✓ Agent ID: $AGENT_ID"
    fi
fi

# Deregister from console
if [ -n "$AGENT_ID" ]; then
    echo ""
    echo "📡 Deregistering from console..."
    RESPONSE=$(curl -s -X POST "$API_BASE/deregister" \
        -H "Content-Type: application/json" \
        -d "{\"agent_id\":\"$AGENT_ID\"}" \
        -w "\n%{http_code}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✓ Successfully deregistered from console"
    else
        echo "⚠️  Deregister returned HTTP $HTTP_CODE: $BODY"
        echo "   (Continuing with local cleanup...)"
    fi
else
    echo "ℹ️  No agent_id found, skipping deregister"
fi

echo ""
echo "🛑 Stopping agent..."

# Determine current user UID
CURRENT_UID=$(id -u)

# Proactively bootout and disable LaunchAgents (new and old labels)
$LAUNCHCTL bootout "gui/$CURRENT_UID" com.kuamini.securityclient >/dev/null 2>&1 || true
$LAUNCHCTL bootout "gui/$CURRENT_UID" com.kuamini.agenttray >/dev/null 2>&1 || true
$LAUNCHCTL bootout "gui/$CURRENT_UID" "$HOME/Library/LaunchAgents/com.kuamini.securityclient.plist" >/dev/null 2>&1 || true
$LAUNCHCTL bootout "gui/$CURRENT_UID" "$HOME/Library/LaunchAgents/com.kuamini.agenttray.plist" >/dev/null 2>&1 || true

# Best-effort system locations (older installs)
sudo $LAUNCHCTL bootout "gui/$CURRENT_UID" "/Library/LaunchAgents/com.kuamini.securityclient.plist" >/dev/null 2>&1 || true
sudo $LAUNCHCTL bootout "gui/$CURRENT_UID" "/Library/LaunchAgents/com.kuamini.agenttray.plist" >/dev/null 2>&1 || true

# Disable to prevent immediate relaunch by launchd if a plist lingers
$LAUNCHCTL disable "gui/$CURRENT_UID"/com.kuamini.securityclient >/dev/null 2>&1 || true
$LAUNCHCTL disable "gui/$CURRENT_UID"/com.kuamini.agenttray >/dev/null 2>&1 || true
sudo $LAUNCHCTL disable "gui/$CURRENT_UID"/com.kuamini.securityclient >/dev/null 2>&1 || true
sudo $LAUNCHCTL disable "gui/$CURRENT_UID"/com.kuamini.agenttray >/dev/null 2>&1 || true

# Kill any running processes
pkill -f "KuaminiSecurityClient" 2>/dev/null || true
pkill -f "KuaminiAgentTray" 2>/dev/null || true
pkill -f "KuaminiAgent" 2>/dev/null || true

sleep 1

echo "🗑️  Removing files..."

# Remove applications (both old and new names)
rm -rf /Applications/KuaminiSecurityClient.app
rm -rf /Applications/KuaminiAgentTray.app
rm -rf ~/Applications/KuaminiSecurityClient.app
rm -rf ~/Applications/KuaminiAgentTray.app

# Remove LaunchAgents
rm -f "$HOME/Library/LaunchAgents/com.kuamini.securityclient.plist"
rm -f "$HOME/Library/LaunchAgents/com.kuamini.agenttray.plist"
sudo rm -f "/Library/LaunchAgents/com.kuamini.securityclient.plist" 2>/dev/null || true
sudo rm -f "/Library/LaunchAgents/com.kuamini.agenttray.plist" 2>/dev/null || true

# Remove config and data
rm -rf ~/.kuamini
rm -rf /tmp/kuamini-* 2>/dev/null || true

# Remove logs
rm -rf ~/Library/Logs/KuaminiSecurityClient
rm -rf ~/Library/Logs/KuaminiAgentTray

# Remove Application Support
rm -rf ~/Library/Application\ Support/KuaminiSecurityClient
rm -rf ~/Library/Application\ Support/KuaminiAgentTray

# Remove Preferences
rm -f ~/Library/Preferences/com.kuamini.securityclient.plist
rm -f ~/Library/Preferences/com.kuamini.agenttray.plist

# Remove Caches
rm -rf ~/Library/Caches/com.kuamini.securityclient
rm -rf ~/Library/Caches/com.kuamini.agenttray

# Forget package receipts
sudo $PKGUTIL --forget com.kuamini.securityclient >/dev/null 2>&1 || true
sudo $PKGUTIL --forget com.kuamini.agenttray >/dev/null 2>&1 || true

echo ""
echo "✅ Kuamini Security Client has been completely removed"
echo "   All configuration, logs, and caches have been deleted"
echo ""
echo "If you still see a tray icon, log out and back in, or run:"
echo "  $LAUNCHCTL print gui/$CURRENT_UID | egrep 'com\\.kuamini'"
