#!/bin/bash
# Kuamini Agent Debug Script for macOS
# Run this to diagnose installation and agent issues

set -e

echo "🔍 Kuamini Agent Debug Diagnostics"
echo "===================================="
echo ""

# Get current user and home
CURRENT_USER=$(whoami)
CURRENT_HOME=$HOME
CURRENT_UID=$(id -u)

echo "📋 System Information"
echo "  User: $CURRENT_USER"
echo "  UID: $CURRENT_UID"
echo "  Home: $CURRENT_HOME"
echo "  macOS Version: $(sw_vers -productVersion)"
echo ""

# 1. Check if app is installed
echo "📦 Checking Application Installation"
if [ -d "/Applications/KuaminiSecurityClient.app" ]; then
    echo "  ✅ App found at /Applications/KuaminiSecurityClient.app"
    ls -lh /Applications/KuaminiSecurityClient.app/Contents/MacOS/ 2>/dev/null || echo "  ⚠️  Could not list MacOS directory"
else
    echo "  ❌ App NOT found at /Applications/KuaminiSecurityClient.app"
fi
echo ""

# 2. Check LaunchAgent
echo "🚀 Checking LaunchAgent"
PLIST_PATH="$CURRENT_HOME/Library/LaunchAgents/com.kuamini.securityclient.plist"
if [ -f "$PLIST_PATH" ]; then
    echo "  ✅ LaunchAgent plist found"
    echo "  📄 Location: $PLIST_PATH"
    echo "  📋 Contents:"
    cat "$PLIST_PATH" | head -20
else
    echo "  ❌ LaunchAgent plist NOT found at $PLIST_PATH"
    echo "  💡 Run: sudo /usr/sbin/installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /"
fi
echo ""

# 3. Check configuration
echo "⚙️  Checking Configuration"
CONFIG_FILE="$CURRENT_HOME/.kuamini/config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "  ✅ Config file found"
    echo "  📄 Location: $CONFIG_FILE"
    echo "  📋 Contents:"
    cat "$CONFIG_FILE"
else
    echo "  ❌ Config file NOT found at $CONFIG_FILE"
    echo "  💡 Config should be created by installer postinstall script"
fi
echo ""

# 4. Check if agent process is running
echo "⚙️  Checking Running Processes"
if pgrep -f "KuaminiSecurityClient" > /dev/null; then
    echo "  ✅ Agent process is RUNNING"
    ps aux | grep -i kuamini | grep -v grep
else
    echo "  ❌ Agent process is NOT running"
    echo "  💡 Check LaunchAgent is loaded:"
    /bin/launchctl list | grep com.kuamini.securityclient || echo "  ❌ Not in launchctl list"
fi
echo ""

# 5. Check LaunchAgent status
echo "📊 LaunchAgent Status"
if /bin/launchctl list "com.kuamini.securityclient" >/dev/null 2>&1; then
    echo "  ✅ LaunchAgent is LOADED"
    /bin/launchctl list "com.kuamini.securityclient" | head -5 || true
else
    echo "  ❌ LaunchAgent is NOT loaded"
    echo "  💡 Try loading manually:"
    echo "    launchctl bootstrap gui/$CURRENT_UID \"$PLIST_PATH\""
fi
echo ""

# 6. Check agent logs
echo "📝 Agent Logs"
LOG_DIR="$CURRENT_HOME/Library/Logs/KuaminiSecurityClient"
if [ -d "$LOG_DIR" ]; then
    echo "  ✅ Log directory found"
    if [ -f "$LOG_DIR/agent.log" ]; then
        echo "  📄 Latest logs:"
        tail -20 "$LOG_DIR/agent.log"
    else
        echo "  ⚠️  agent.log not found"
    fi
else
    echo "  ❌ Log directory not found at $LOG_DIR"
    echo "  💡 Logs should be created when agent first runs"
fi
echo ""

# 7. Network connectivity test
echo "🌐 Network Connectivity"
API_BASE="https://kuaminisystems.com/api/agent"
echo "  Testing: $API_BASE/health"
if curl -s -I "$API_BASE/health" 2>/dev/null | head -1; then
    echo "  ✅ API endpoint is reachable"
else
    echo "  ❌ Could not reach API endpoint"
    echo "  💡 Check your internet connection and firewall"
fi
echo ""

# 8. Permissions check
echo "🔐 File Permissions"
if [ -f "$CONFIG_FILE" ]; then
    echo "  Config file: $(ls -l "$CONFIG_FILE" | awk '{print $1, $3, $4}')"
fi
if [ -f "$PLIST_PATH" ]; then
    echo "  Plist file: $(ls -l "$PLIST_PATH" | awk '{print $1, $3, $4}')"
fi
echo ""

# 9. Recommendations
echo "💡 Next Steps"
if [ -f "$PLIST_PATH" ] && [ -f "$CONFIG_FILE" ]; then
    echo "  1. Check if LaunchAgent is loaded:"
    echo "     launchctl list | grep com.kuamini"
    echo ""
    echo "  2. If not loaded, load it manually:"
    echo "     launchctl bootstrap gui/$CURRENT_UID \"$PLIST_PATH\""
    echo ""
    echo "  3. Check for agent process:"
    echo "     ps aux | grep KuaminiSecurityClient"
    echo ""
    echo "  4. Check logs:"
    echo "     tail -50 \"$LOG_DIR/agent.log\""
    echo ""
    echo "  5. Force-start agent (for testing):"
    echo "     /Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient"
else
    echo "  1. Reinstall the agent:"
    echo "     sudo /usr/sbin/installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /"
    echo ""
    echo "  2. Log out and back in (to load LaunchAgent)"
    echo ""
    echo "  3. Check installation completed:"
    echo "     bash $0"
fi
echo ""

echo "✅ Diagnostics complete!"
