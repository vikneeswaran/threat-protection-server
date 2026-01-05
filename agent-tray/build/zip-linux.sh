#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d "dist/KuaminiSecurityClient" ]; then
  echo "dist/KuaminiSecurityClient not found. Run pyinstaller-linux.sh first." >&2
  exit 1
fi

cd dist
zip -r linux.zip KuaminiSecurityClient
echo "Created: dist/linux.zip"
