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

# Unload LaunchAgent (both old and new names)
launchctl unload ~/Library/LaunchAgents/com.kuamini.securityclient.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.kuamini.agenttray.plist 2>/dev/null || true

# Kill any running processes
pkill -f "KuaminiSecurityClient" 2>/dev/null || true
pkill -f "KuaminiAgentTray" 2>/dev/null || true

sleep 1

echo "🗑️  Removing files..."

# Remove applications (both old and new names)
rm -rf /Applications/KuaminiSecurityClient.app
rm -rf /Applications/KuaminiAgentTray.app
rm -rf ~/Applications/KuaminiSecurityClient.app
rm -rf ~/Applications/KuaminiAgentTray.app

# Remove LaunchAgents
rm -f ~/Library/LaunchAgents/com.kuamini.securityclient.plist
rm -f ~/Library/LaunchAgents/com.kuamini.agenttray.plist

# Remove config and data
rm -rf ~/.kuamini

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
sudo pkgutil --forget com.kuamini.securityclient 2>/dev/null || true
sudo pkgutil --forget com.kuamini.agenttray 2>/dev/null || true

echo ""
echo "✅ Kuamini Security Client has been completely removed"
echo "   All configuration, logs, and caches have been deleted"
echo ""
