#!/bin/bash
# Postinstall script for KuaminiSecurityClient macOS PKG

PLIST_SRC="/Applications/KuaminiSecurityClient.app/Contents/Resources/com.kuamini.agent.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.kuamini.agent.plist"

# Copy LaunchAgent plist to user LaunchAgents
if [ -f "$PLIST_SRC" ]; then
    cp "$PLIST_SRC" "$PLIST_DEST"
    # Set correct permissions
    chmod 644 "$PLIST_DEST"
    # Unload if already loaded (ignore errors)
    launchctl unload "$PLIST_DEST" 2>/dev/null
    # Load LaunchAgent so tray/status icon starts immediately
    launchctl load "$PLIST_DEST"
fi

exit 0
