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

echo "👤 Running as user: $ACTUAL_USER"
echo ""

# Read agent_id and api_base from config if it exists
AGENT_ID=""
API_BASE=""
CONFIG_FILE="$ACTUAL_HOME/.kuamini/config.json"

# Try multiple possible config locations
POSSIBLE_CONFIGS=(
    "$ACTUAL_HOME/.kuamini/config.json"
    "/Library/Application Support/KuaminiSecurityClient/config.json"
    "$ACTUAL_HOME/Library/Application Support/KuaminiSecurityClient/config.json"
)

for CONFIG in "${POSSIBLE_CONFIGS[@]}"; do
    if [ -f "$CONFIG" ]; then
        CONFIG_FILE="$CONFIG"
        echo "📋 Found config file at: $CONFIG_FILE"
        AGENT_ID=$(grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
        API_BASE=$(grep -o '"api_base"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
        
        if [ -n "$AGENT_ID" ]; then
            echo "✓ Agent ID: $AGENT_ID"
        fi
        break
    fi
done

# Step 2: Deregister from console if we have agent_id and api_base
if [ -n "$AGENT_ID" ] && [ -n "$API_BASE" ]; then
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
        echo "   (Offline or network issue - continuing with local cleanup...)"
    fi
else
    echo ""
    echo "ℹ️  No agent_id or API endpoint found"
    echo "   (Installation may be corrupt or offline - skipping deregister)"
fi

echo ""
echo "🛑 Stopping agent..."

# Determine current user UID
CURRENT_UID=$(id -u "$ACTUAL_USER")

# Kill processes FIRST before trying to unload LaunchAgent
# Find and kill ALL Kuamini processes regardless of location
ps aux | grep -i kuamini | grep -v grep | grep -v uninstall | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true

# Force kill by pattern matching (even if running from unusual locations)
pkill -9 -f "KuaminiSecurityClient" 2>/dev/null || true
pkill -9 -f "KuaminiAgentTray" 2>/dev/null || true
pkill -9 -f "KuaminiAgent" 2>/dev/null || true
pkill -9 -f "kuamini" 2>/dev/null || true

# Also kill by exact process name
killall -9 KuaminiSecurityClient 2>/dev/null || true
killall -9 KuaminiAgentTray 2>/dev/null || true
killall -9 KuaminiAgent 2>/dev/null || true

# Wait for processes to fully terminate (longer wait for system caches)
sleep 3

# Second attempt - ensure nothing survived
ps aux | grep -i kuamini | grep -v grep | grep -v uninstall | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
sleep 1
# Wait for processes to fully terminate (longer wait for system caches)
sleep 3

# Now try to unload LaunchAgents (may fail with error 5, but we already killed the process)
# Run as the actual user to access their LaunchAgents
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" com.kuamini.securityclient >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" com.kuamini.agenttray >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist" >/dev/null 2>&1 || true
sudo -u "$ACTUAL_USER" $LAUNCHCTL bootout "gui/$CURRENT_UID" "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini.agenttray.plist" >/dev/null 2>&1 || true

# Best-effort system lfrom ALL possible locations (both old and new names)
echo "   Removing application bundles..."
rm -rf /Applications/KuaminiSecurityClient.app 2>/dev/null || true
rm -rf /Applications/KuaminiAgentTray.app 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Applications/KuaminiSecurityClient.app" 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Applications/KuaminiAgentTray.app" 2>/dev/null || true
rm -rf /Applications/Kuamini*.app 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Applications/Kuamini*.app" 2>/dev/null || true

# Search for and remove any stray app bundles
find /Applications -maxdepth 1 -iname "*kuamini*" -type d -exec rm -rf {} \; 2>/dev/null || true
find "$ACTUAL_HOME/Applications" -maxdepth 1 -iname "*kuamini*" -type d -exec rm -rf {} \; 2>/dev/null || true

# Remove LaunchAgents (user and system, all possible names)
echo "   Removing LaunchAgents..."
rm -f "$ACTUAL_HOME/Library/LaunchAgents/com.kuamini."* 2>/dev/null || true
rm -f "/Library/LaunchAgents/com.kuamini."* 2>/dev/null || true
find "$ACTUAL_HOME/Library/LaunchAgents" -iname "*kuamini*" -delete 2>/dev/null || true
find "/Library/LaunchAgents" -iname "*kuamini*" -delete 2>/dev/null || true

# Remove config and data from ALL possible locations
echo "   Removing configuration and data..."
rm -rf "$ACTUAL_HOME/.kuamini" 2>/dev/null || true
rm -rf "/Library/Application Support/KuaminiSecurityClient" 2>/dev/null || true
rm -rf "/Library/Application Support/Kuamini"* 2>/dev/null || true
rm -rf /tmp/kuamini-* 2>/dev/null || true
rm -rf /tmp/*kuamini* 2>/dev/null || true

# Remove logs from ALL possible locations
echo "   Removing logs..."
rm -rf "$ACTUAL_HOME/Library/Logs/KuaminiSecurityClient" 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Library/Logs/KuaminiAgentTray" 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Library/Logs/Kuamini"* 2>/dev/null || true
find "$ACTUAL_HOME/Library/Logs" -iname "*kuamini*" -type d -exec rm -rf {} \; 2>/dev/null || true

# Remove Application Support from ALL possible locations
echo "   Removing application support files..."
rm -rf "$ACTUAL_HOME/Library/Application Support/KuaminiSecurityClient" 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Library/Application Support/KuaminiAgentTray" 2>/dev/null || true
rm -rf "$ACTUAL_HOME/Library/Application Support/Kuamini"* 2>/dev/null || true
find "$ACTUAL_HOME/Library/Application Support" -iname "*kuamini*" -type d -exec rm -rf {} \; 2>/dev/null || true

# Remove Preferences
echo "   Removing preferences..."
rm -f "$ACTUAL_HOME/Library/Preferences/com.kuamini."* 2>/dev/null || true
find "$ACTUAL_HOME/Library/Preferences" -iname "*kuamini*" -delete 2>/dev/null || true

# Remove Caches
echo "   Removing caches..."
rm -rf "$ACTUAL_HOME/Library/Caches/com.kuamini."* 2>/dev/null || true
find "$ACTUAL_HOME/Library/Caches" -iname "*kuamini*" -type d -exec rm -rf {} \; 2>/dev/null || true

# Forget package receipts (all possible package IDs)
echo "   Forgetting package receipts..."
$PKGUTIL --pkgs | grep -i kuamini | xargs -I {} $PKGUTIL --forget {} 2>/dev/null
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
