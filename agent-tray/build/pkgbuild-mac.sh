#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${PROJECT_ROOT}/dist"
APP_NAME="KuaminiSecurityClient.app"
PKG_NAME="KuaminiSecurityClient-1.0.0.pkg"
PKG_OUT="${DIST_DIR}/${PKG_NAME}"
TEMP_ROOT="$(mktemp -d)"
PAYLOAD_ROOT="${TEMP_ROOT}/root"
SCRIPTS_DIR="${TEMP_ROOT}/Scripts"
SPEC_FILE="${PROJECT_ROOT}/KuaminiSecurityClient-mac.spec"

cleanup() {
  rm -rf "${TEMP_ROOT}" || true
}
trap cleanup EXIT

mkdir -p "${PAYLOAD_ROOT}/Applications" "${SCRIPTS_DIR}"

cd "${PROJECT_ROOT}"

# Build the .app with PyInstaller
if ! command -v pyinstaller >/dev/null 2>&1; then
  echo "pyinstaller not found; installing..."
  python -m pip install --upgrade pip
  python -m pip install pyinstaller
fi

pyinstaller --clean "${SPEC_FILE}"

if [ ! -d "${DIST_DIR}/${APP_NAME}" ]; then
  echo "Error: ${DIST_DIR}/${APP_NAME} not found after PyInstaller build" >&2
  exit 1
fi

# Copy app into payload Applications
cp -R "${DIST_DIR}/${APP_NAME}" "${PAYLOAD_ROOT}/Applications/"

# Postinstall script to set up config and LaunchAgent
cat >"${SCRIPTS_DIR}/postinstall" <<'POST'
#!/bin/bash
set -euo pipefail

CONSOLE_USER=$(stat -f %Su /dev/console)
CONSOLE_UID=$(id -u "$CONSOLE_USER")
APP_PATH="/Applications/KuaminiSecurityClient.app"
BIN_PATH="${APP_PATH}/Contents/MacOS/KuaminiSecurityClient"
CONFIG_DIR="/Users/${CONSOLE_USER}/.kuamini"
CONFIG_FILE="${CONFIG_DIR}/config.json"

mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_FILE" ]; then
  cat >"$CONFIG_FILE" <<'JSON'
{
  "api_base": "https://kuaminisystems.com/api/agent",
  "console_url": "https://kuaminisystems.com/securityAgent",
  "auto_register": true,
  "heartbeat_interval": 60
}
JSON
  chown "$CONSOLE_USER" "$CONFIG_FILE"
  chmod 644 "$CONFIG_FILE"
fi
chown "$CONSOLE_USER" "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

# Install LaunchAgent
PLIST_CANDIDATES=(
  "${APP_PATH}/Contents/Resources/com.kuamini.securityclient.plist"
  "${APP_PATH}/com.kuamini.securityclient.plist"
)
for src in "${PLIST_CANDIDATES[@]}"; do
  if [ -f "$src" ]; then
    DEST="/Users/${CONSOLE_USER}/Library/LaunchAgents/com.kuamini.securityclient.plist"
    mkdir -p "$(dirname "$DEST")"
    cp "$src" "$DEST"
    chown "$CONSOLE_USER" "$DEST"
    chmod 644 "$DEST"
    launchctl bootout gui/${CONSOLE_UID} "$DEST" >/dev/null 2>&1 || true
    launchctl bootstrap gui/${CONSOLE_UID} "$DEST" || true
    break
  fi
done

# Ensure the binary is executable
chmod +x "$BIN_PATH" || true

exit 0
POST
chmod +x "${SCRIPTS_DIR}/postinstall"

# Build the PKG
pkgbuild \
  --root "${PAYLOAD_ROOT}" \
  --identifier com.kuamini.securityclient \
  --version 1.0.0 \
  --scripts "${SCRIPTS_DIR}" \
  --ownership preserve \
  "${PKG_OUT}"

echo "PKG created at: ${PKG_OUT}"
