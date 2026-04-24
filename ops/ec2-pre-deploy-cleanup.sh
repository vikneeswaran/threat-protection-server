#!/usr/bin/env bash
# ============================================================
# EC2 Pre-Deploy Cleanup Script
# Run this on the EC2 instance before triggering a deployment.
# Usage: bash ops/ec2-pre-deploy-cleanup.sh
# ============================================================
set -euo pipefail

APP_DIR="/home/ubuntu/apps/kuamini-prod"

echo "=== EC2 Pre-Deploy Cleanup ==="
echo "Disk before cleanup:"
df -h /

echo ""
echo "[1/6] Removing Next.js build output and caches..."
rm -rf "$APP_DIR/.next"
rm -rf "$APP_DIR/node_modules/.cache"

echo "[2/6] Removing node_modules (pnpm install will restore)..."
rm -rf "$APP_DIR/node_modules"

echo "[3/6] Flushing PM2 logs..."
pm2 flush || true
find /home/ubuntu/.pm2/logs -type f -name "*.log" -size +10M -delete 2>/dev/null || true

echo "[4/6] Cleaning apt cache..."
sudo apt-get clean -y || true

echo "[5/6] Vacuuming systemd journal logs (keep last 50MB)..."
sudo journalctl --vacuum-size=50M || true

echo "[6/6] Cleaning /tmp..."
sudo find /tmp -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "=== Disk after cleanup ==="
df -h /
echo ""
echo "Done. You can now trigger the GitHub Actions deploy workflow."
