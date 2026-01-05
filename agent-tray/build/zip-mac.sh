#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d "dist/KuaminiSecurityClient.app" ]; then
  echo "dist/KuaminiSecurityClient.app not found. Run pyinstaller-mac.sh first." >&2
  exit 1
fi

cd dist
zip -r macos.zip KuaminiSecurityClient.app
echo "Created: dist/macos.zip"
