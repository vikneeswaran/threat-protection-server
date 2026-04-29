#!/bin/bash
# cleanup-ec2-disk.sh
# Safely remove old logs, caches, and common build artifacts to free up disk space on EC2
# Usage: sudo bash scripts/cleanup-ec2-disk.sh

set -e

# Remove old log files
sudo find /var/log -type f -name "*.gz" -delete
sudo find /var/log -type f -name "*.1" -delete
sudo find /var/log -type f -name "*.old" -delete
sudo find /var/log -type f -name "*.log" -size +10M -delete
sudo journalctl --vacuum-size=50M || true

# Remove npm, pnpm, and yarn caches
rm -rf ~/.npm/_cacache
rm -rf ~/.npm/_logs
rm -rf ~/.cache/yarn
rm -rf ~/.yarn-cache
rm -rf ~/.pnpm-store
rm -rf ~/.pnpm/_cacache
rm -rf ~/.pnpm/_logs

# Remove node_modules/.cache in all projects
find ~/ -type d -name ".cache" -path "*/node_modules/.cache" -prune -exec rm -rf {} +

# Remove .next, dist, build, coverage folders in all projects
find ~/ -type d \( -name ".next" -o -name "dist" -o -name "build" -o -name "coverage" \) -prune -exec rm -rf {} +

# Remove old node_modules in unused folders (customize as needed)
# Example: find ~/old_projects -type d -name "node_modules" -prune -exec rm -rf {} +

# Remove large files in /tmp older than 1 day
sudo find /tmp -type f -mtime +1 -size +50M -delete
sudo find /tmp -type d -empty -delete

# Remove PM2 logs larger than 10MB
find ~/.pm2/logs -type f -name "*.log" -size +10M -delete

# Remove orphaned Docker data if Docker is installed
if command -v docker &> /dev/null; then
  docker system prune -af || true
fi

echo "Cleanup complete. Run 'df -h' to check free space."
