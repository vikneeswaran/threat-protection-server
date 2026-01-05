#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Use python3 instead of python
python3 -m PyInstaller \
  --noconfirm \
  --onedir \
  --windowed \
  --name KuaminiSecurityClient \
  --osx-bundle-identifier com.kuamini.securityclient \
  main.py

echo "Built: dist/KuaminiSecurityClient.app"
