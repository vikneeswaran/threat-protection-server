#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME=KuaminiAgentTray.app
PKG_NAME=KuaminiAgentTray-1.0.0.pkg

if [ ! -d "dist/$APP_NAME" ]; then
  echo "dist/$APP_NAME not found. Run pyinstaller first." >&2
  exit 1
fi

pkgbuild \
  --identifier com.kuamini.agenttray \
  --version 1.0.0 \
  --install-location /Applications \
  --component dist/$APP_NAME \
  --scripts build/scripts \
  dist/$PKG_NAME

echo "Built pkg: dist/$PKG_NAME"
