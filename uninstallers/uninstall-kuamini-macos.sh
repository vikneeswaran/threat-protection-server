#!/bin/bash
# Kuamini Security Client Uninstaller for macOS
# Removes all traces and deregisters from console

# Note: Removed 'set -e' to allow script to continue even if individual commands fail
# This ensures all cleanup operations run even if some fail

echo "🗑️  Kuamini Security Client Uninstaller"
echo "======================================="
echo ""

# Ensure sudo access for root operations
if [ "$EUID" -ne 0 ]; then
    echo "This script requires elevated privileges to remove system files."
    echo "You may be prompted for your password."
    echo ""
    # Restart script with sudo, preserving all arguments
    exec sudo "$0" "$@"
fi

# Tool paths (avoid "command not found" on sudo env)
LAUNCHCTL="/bin/launchctl"
PKGUTIL="/usr/sbin/pkgutil"

# Find the actual user (when running with sudo)
if [ -n "$SUDO_USER" ]; then
    ACTUAL_USER="$SUDO_USER"
    ACTUAL_HOME=$(eval echo ~"$SUDO_USER")
else
    ACTUAL_USER=$(whoami)
    ACTUAL_HOME="$HOME"
fi

# Read agent_id and api_base from config if it exists
AGENT_ID=""
API_BASE=""
CONFIG_FILE="$ACTUAL_HOME/.kuamini/config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "📋 Found config file, reading agent configuration..."
    AGENT_ID=$(grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    API_BASE=$(grep -o '"api_base"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    
    if [ -n "$AGENT_ID" ]; then
        echo "✓ Agent ID: $AGENT_ID"
    fi
    if [ -n "$API_BASE" ]; then
        echo "✓ API Base: $API_BASE"
    fi
fi

# Fallback to environment variable or production URL if not found in config
if [ -z "$API_BASE" ]; then
    API_BASE="${API_BASE:-https://kuaminisystems.com/api/agent}"
    echo "ℹ️  Using default API: $API_BASE"
fi

# Deregister from console
if [ -n "$AGENT_ID" ]; then
    echo ""
    echo "📡 Deregistering from console..."
    # Use --insecure flag for curl to handle certificate issues, with timeout
    RESPONSE=$(curl -s --insecure -m 5 -X POST "$API_BASE/deregister" \
        -H "Content-Type: application/json" \
        -d "{\"agent_id\":\"$AGENT_ID\"}" \
        -w "\n%{http_code}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        echo "✓ Successfully deregistered from console"
    else
        echo "⚠️  Deregister returned HTTP $HTTP_CODE"
        echo "   (Continuing with local cleanup...)"
    fi
else
    echo "ℹ️  No agent_id found, skipping deregister"
fi

echo ""
echo "🛑 Stopping agent..."

# Determine current user UID
CURRENT_UID=$(id -u "$ACTUAL_USER")

# Kill processes FIRST before trying to unload LaunchAgent
echo "   Terminating running processes..."

# Force kill immediately (LaunchAgent bootout often fails with error 5)
pkill -9 -f "KuaminiSecurityClient" 2>/dev/null || true
pkill -9 -f "KuaminiAgentTray" 2>/dev/null || true
pkill -9 -f "KuaminiAgent" 2>/dev/null || true

# Also kill by exact process name
killall -9 KuaminiSecurityClient 2>/dev/null || true
killall -9 KuaminiAgentTray 2>/dev/null || true
killall -9 KuaminiAgent 2>/dev/null || true
 (longer wait for system caches)
sleep 3for processes to fully terminate
sleep 2

# Now try to unload LaunchAgents (may fail with error 5, but we already killed the process)
# Run as the actual user to access their LaunchAgents
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" com.kuamini.securityclient >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" com.kuamini.agenttray >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist" >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.agenttray.plist" >/dev/null 2>&1 || true

# Best-effort system locations (older installs)
$LAUNCHCTL bootout "gui/$CURRENT_UID" "/Library/LaunchAgents/com.kuamini.securityclient.plist" >/dev/null 2>&1 || true
$LAUNCHCTL bootout "gui/$CURRENT_UID" "/Library/LaunchAgents/com.kuamini.agenttray.plist" >/dev/null 2>&1 || true

# Disable to prevent immediate relaunch
sudo -u "$ACTUAL_USER" $LAUNCHCTL disable "gui/$CURRENT_UID"/com.kuamini.securityclient >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL disable "gui/$CURRENT_UID"/com.kuamini.agenttray >/dev/null 2>&1 || true

echo "🗑️  Removing files..."

# Remove applications (both old and new names)
rm -rf /Applications/KuaminiSecurityClient.app 2>/dev/null || true
rm -rf /Applications/KuaminiAgentTray.app 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Applications/KuaminiSecurityClient.app" 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Applications/KuaminiAgentTray.app" 2>/dev/null || true

# Remove LaunchAgents (user and system)
rm -f "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist"
rm -f "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.agenttray.plist"
rm -f "/Library/LaunchAgents/com.kuamini.securityclient.plist" 2>/dev/null || true
rm -f "/Library/LaunchAgents/com.kuamini.agenttray.plist" 2>/dev/null || true

# Remove config and data
rm -rf "$ACTUAL_HOME/.kuamini"
rm -rf /tmp/kuamini-* 2>/dev/null || true

# Remove logs
rm -rf "$ACTUAL_HOME/Library/Logs/KuaminiSecurityClient"
rm -rf "$ACTUAL_HOME/Library/Logs/KuaminiAgentTray"

# Remove Application Support
rm -rf "$ACTUAL_HOME/Library/Application Support/KuaminiSecurityClient"
rm -rf "$ACTUAL_HOME/Library/Application Support/KuaminiAgentTray"

# Remove Preferences
rm -f "$ACTUAL_HOME/Library/Preferences/com.kuamini.securityclient.plist"
rm -f "$ACTUAL_HOME/Library/Preferences/com.kuamini.agenttray.plist"

# Remove Caches
rm -rf "$ACTUAL_HOME/Library/Caches/com.kuamini.securityclient"
rm -rf "$ACTUAL_HOME/Library/Caches/com.kuamini.agenttray"

# Forget package receipts
$PKGUTIL --forget com.kuamini.securityclient >/dev/null 2>&1 || true
$PKGUTIL --forget com.kuamini.agenttray >/dev/null 2>&1 || true

# Final cleanup: Restart the Dock to clear any ghost tray icons
echo ""
echo "🔄 Clearing menu bar icons..."
sleep 1

# Kill and restart Dock as the actual user (this clears all menu bar icons and caches)
sudo -u "$ACTUAL_USER" killall Dock 2>/dev/null || true

# Wait longer for Dock to restart and processes to fully clean up
sleep 4

# Final verification: Check if any processes are still running
REMAINING=$(ps aux | grep -i kuamini | grep -v grep | grep -v uninstall || true)

echo ""
if [ -n "$REMAINING" ]; then
    echo "⚠️  Warning: Some processes may still be running:"
    echo "$REMAINING"
    echo ""
    echo "Please try:"
    echo "  1. Log out and back in"
    echo "  2. Or restart your Mac"
else
    echo "✅ Kuamini Security Client has been completely removed"
    echo "   ✓ All files and configurations deleted"
    echo "   ✓ All processes terminated"
    echo "   ✓ Menu bar icons cleared"
    echo ""
    echo "The uninstallation is complete! Your system is clean."
fi
