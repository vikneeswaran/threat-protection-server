#!/bin/bash
# Kuamini Security Client Uninstaller for Linux
# Removes all traces and deregisters from console

set -e

echo "🗑️  Kuamini Security Client Uninstaller"
echo "======================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "⚠️  Please run as root (use sudo)"
   exit 1
fi

# API base URL (default to production, can override)
API_BASE="${API_BASE:-https://kuaminisystems.com/api/agent}"

# Find the user who installed it (check config in common locations)
AGENT_ID=""
CONFIG_FILE=""

for user_home in /home/* /root; do
    if [ -f "$user_home/.kuamini/config.json" ]; then
        CONFIG_FILE="$user_home/.kuamini/config.json"
        break
    fi
done

# Also check system location
if [ -z "$CONFIG_FILE" ] && [ -f "/etc/kuamini/config.json" ]; then
    CONFIG_FILE="/etc/kuamini/config.json"
fi

# Read agent_id from config if found
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    echo "📋 Found config file: $CONFIG_FILE"
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

# Stop and disable systemd service (both old and new names)
systemctl stop kuamini-security-client.service 2>/dev/null || true
systemctl disable kuamini-security-client.service 2>/dev/null || true
systemctl stop kuamini-agent.service 2>/dev/null || true
systemctl disable kuamini-agent.service 2>/dev/null || true

# Kill any running processes
pkill -f "KuaminiSecurityClient" 2>/dev/null || true
pkill -f "KuaminiAgentTray" 2>/dev/null || true

sleep 1

echo "🗑️  Removing files..."

# Remove installation directory (both old and new names)
rm -rf /opt/kuamini/securityclient
rm -rf /opt/kuamini/agenttray
rm -rf /opt/kuamini

# Remove systemd services (both old and new names)
rm -f /etc/systemd/system/kuamini-security-client.service
rm -f /etc/systemd/system/kuamini-agent.service
systemctl daemon-reload

# Remove config (both locations, both names)
rm -rf /etc/kuamini
for user_home in /home/* /root; do
    rm -rf "$user_home/.kuamini"
done

# Remove autostart entries (both old and new names)
for user_home in /home/*; do
    rm -f "$user_home/.config/autostart/kuamini-security-client.desktop"
    rm -f "$user_home/.config/autostart/kuamini-agent-tray.desktop"
done

# Remove logs
rm -rf /var/log/kuamini

echo ""
echo "✅ Kuamini Security Client has been completely removed"
echo "   All configuration, logs, and caches have been deleted"
echo ""
