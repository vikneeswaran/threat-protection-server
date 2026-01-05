#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt pyinstaller

pyinstaller \
  --noconfirm \
  --onedir \
  --windowed \
  --name KuaminiSecurityClient \
  main.py

echo "Built: dist/KuaminiSecurityClient"
