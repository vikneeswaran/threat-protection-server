# AWS EC2 Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the Threat Protection Server to AWS EC2. The deployment is **manual-only** (no auto-deployment) and uses GitHub Actions for remote deployment via SSH.

---

## Prerequisites

### 1. AWS EC2 Instance Setup
- **Instance Type**: t3.medium or higher (t3.large recommended for production)
- **OS**: Ubuntu 22.04 LTS
- **Storage**: 30GB+ root volume (for builds and dependencies)
- **Security Group**: Allow inbound SSH (port 22) from your admin IP and GitHub runners
- **Elastic IP**: Assign static IP to the instance

Important: use the instance **public IPv4 / Elastic IP** for SSH and for `AWS_EC2_HOST_PROD`. Do not use private VPC IPs (for example `172.31.x.x`).

### 2. EC2 Instance Configuration

#### Connect to your EC2 instance:
```bash
ssh -i /path/to/your/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

#### Update system packages:
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

#### Install Node.js and pnpm:
```bash
# Install Node.js (v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
sudo npm install -g pnpm@10

# Verify installations
node --version  # Should be v20+
pnpm --version  # Should be 10.0.0+
```

#### Install PM2 (process manager):
```bash
sudo npm install -g pm2
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup -u ubuntu --hp /home/ubuntu
```

#### Create application directory:
```bash
mkdir -p /home/ubuntu/apps/kuamini-prod
cd /home/ubuntu/apps/kuamini-prod
```

#### Install PostgreSQL client (if using RDS):
```bash
sudo apt-get install -y postgresql-client
```

#### Create swap space (for reliable builds):
```bash
sudo swapon --show
if ! sudo swapon --show | grep -q '/swapfile'; then
   sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
fi

# Make permanent
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## GitHub Secrets Configuration

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Required Secrets:

| Secret Name | Description | Example |
|---|---|---|
| `AWS_EC2_HOST_PROD` | Public IP or hostname of your EC2 instance (not private VPC IP) | `203.0.113.45` |
| `AWS_EC2_USER` | SSH username for EC2 (usually `ubuntu`) | `ubuntu` |
| `AWS_EC2_SSH_KEY` | Private SSH key for EC2 access | (copy entire private key content) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `NEXTAUTH_SECRET` | NextAuth.js secret (generate: `openssl rand -base64 32`) | (32+ char random string) |
| `NEXTAUTH_URL` | Your application's public URL | `https://your-domain.com` |

### Optional Secrets (if applicable):

| Secret Name | Description |
|---|---|
| `SMTP_HOST` | Email service host (if email sending needed) |
| `SMTP_PORT` | Email service port |
| `SMTP_USER` | Email service username |
| `SMTP_PASS` | Email service password |
| `SLACK_WEBHOOK_URL` | Slack notifications (optional) |

---

## Environment Variables

### Create `.env.production` on EC2

SSH into your instance and create the production env file:

```bash
cat > /home/ubuntu/apps/kuamini-prod/.env.production << 'EOF'
# Database
DATABASE_URL=postgresql://user:password@rds-endpoint:5432/threat_protection_db

# NextAuth Configuration
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=https://your-domain.com

# Application
NODE_ENV=production
PORT=3000

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: External Services
API_TIMEOUT=30000
LOG_LEVEL=info

EOF
```

**Important**: Set proper permissions:
```bash
chmod 600 /home/ubuntu/apps/kuamini-prod/.env.production
```

---

## Manual Deployment Steps

### Step 1: Trigger Deployment from GitHub

1. Go to your GitHub repository
2. Click **"Actions"** tab
3. Select **"Deploy to AWS EC2"** workflow
4. Click **"Run workflow"** button
5. Select the branch to deploy (usually `main` or `production`)
6. Click **"Run workflow"**

The workflow will:
- Clean up old builds and logs
- Pull latest code from your selected branch
- Install dependencies
- Build the Next.js application
- Restart PM2 process
- Show deployment status

### Step 2: Monitor Deployment

Watch the GitHub Actions log for progress:
- Building dependencies (~3-5 minutes)
- Building application (~5-10 minutes depending on changes)
- Starting application (~1 minute)

### Step 3: Verify Deployment

After workflow completes, verify the application is running:

```bash
# SSH into your instance
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Check PM2 status
pm2 status

# View logs
pm2 logs kuamini-prod

# Check application health
curl http://localhost:3000/api/health
```

---

## Database Setup

### PostgreSQL on AWS RDS

1. **Create RDS instance**:
   - Engine: PostgreSQL 15+
   - Instance class: db.t3.micro (development) or db.t3.small+ (production)
   - Storage: 20GB+ with auto-scaling
   - Multi-AZ: Enabled (production)
   - Publicly accessible: No (use security groups)
   - Backup retention: 7 days minimum

2. **Create database and user**:
   ```sql
   CREATE DATABASE threat_protection_db;
   CREATE USER app_user WITH PASSWORD 'strong-password-here';
   GRANT ALL PRIVILEGES ON DATABASE threat_protection_db TO app_user;
   ```

3. **Run migrations** (first deployment):
   ```bash
   # SSH into EC2
   cd /home/ubuntu/apps/kuamini-prod
   
   # If using Prisma:
   pnpm prisma migrate deploy
   
   # If using custom migrations:
   psql -h YOUR_RDS_ENDPOINT -U app_user -d threat_protection_db -f scripts/schema.sql
   ```

---

## Deployment Checklist

- [ ] EC2 instance created and configured
- [ ] Node.js v20+ installed
- [ ] pnpm installed globally
- [ ] PM2 installed and configured
- [ ] Application directory created (`/home/ubuntu/apps/kuamini-prod`)
- [ ] `.env.production` file created with all secrets
- [ ] GitHub secrets added to repository
- [ ] SSH key pair generated and added to EC2
- [ ] Database (PostgreSQL/RDS) configured
- [ ] Security groups allow SSH from GitHub Actions
- [ ] Swap space created (2GB)

---

## Workflow File: `deploy-aws.yml`

The workflow is configured with:
- **Trigger**: Manual only (`workflow_dispatch`)
- **Target**: Production EC2 instance
- **Branch**: Uses `${{ github.ref_name }}` (current branch)
- **Deploy Path**: `/home/ubuntu/apps/kuamini-prod`
- **PM2 App Name**: `kuamini-prod`
- **Build Environment**: 768MB Node memory + 2GB swap

### Key Features:
✅ Disk cleanup before build  
✅ Git repository health check  
✅ Automatic swap creation if needed  
✅ Atomic deployments (hard reset, clean install)  
✅ Automatic PM2 process restart  
✅ No auto-deployment (manual trigger only)

---

## Rollback Procedure

If deployment fails or causes issues:

```bash
# SSH into EC2
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# View current processes
pm2 status

# Stop the app
pm2 stop kuamini-prod

# Go to app directory
cd /home/ubuntu/apps/kuamini-prod

# Revert to previous commit
git log --oneline | head -5  # View recent commits
git reset --hard COMMIT_HASH  # Go back to previous version

# Reinstall and rebuild
pnpm install --frozen-lockfile
pnpm build

# Restart
pm2 restart kuamini-prod
pm2 logs kuamini-prod
```

---

## Troubleshooting

### Deployment fails with "Disk space full"
```bash
# On EC2:
df -h /  # Check disk usage
rm -rf /home/ubuntu/apps/kuamini-prod/.next  # Clear Next.js cache
rm -rf /home/ubuntu/apps/kuamini-prod/node_modules  # Clear dependencies
```

### Application won't start
```bash
pm2 logs kuamini-prod --lines 100  # Check detailed error logs
pm2 delete kuamini-prod  # Remove process
pm2 start "pnpm start" --name kuamini-prod  # Restart manually
```

### Database connection fails
```bash
# Verify connection string in .env.production
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Test connection
psql -h HOST -U USERNAME -d DBNAME -c "SELECT version();"
```

### SSH connection refused
- Verify security group allows port 22
- Confirm EC2 instance is running
- Check SSH key permissions: `chmod 600 your-key.pem`

### SSH timeout to private IP
- If SSH times out to `172.31.x.x`, you are using private VPC address.
- Use the instance public IPv4 / Elastic IP in your SSH command and in `AWS_EC2_HOST_PROD`.

### Cannot find `.pem` file
- Search locally: `find ~/Downloads ~/.ssh ~/Desktop -type f -name "*.pem" 2>/dev/null`
- If missing, generate a new SSH key locally and add its public key to EC2 `~/.ssh/authorized_keys`.
- Update GitHub secret `AWS_EC2_SSH_KEY` with the new private key content.

### `npm install -g pnpm@10` permission error (EACCES)
- Install with sudo: `sudo npm install -g pnpm@10`

### `fallocate failed: Text file busy`
- `/swapfile` is already present or active.
- Check with: `sudo swapon --show`.
- If active, skip swap creation.

### `/securityAgent` returns 404 after deploy
- Legacy route may be removed.
- Ensure latest deploy includes redirect rules in [next.config.mjs](next.config.mjs).
- Redeploy with current `main` branch.

---

## Performance Tuning

### Node.js Build Optimization
```bash
# In workflow or .env.production:
export NODE_OPTIONS="--max_old_space_size=1536"
```

### PM2 Cluster Mode (for multi-core):
```bash
pm2 start "pnpm start" -i max --name kuamini-prod
```

### nginx Reverse Proxy (optional):
```bash
sudo apt-get install -y nginx
# Configure nginx as reverse proxy to port 3000
sudo systemctl restart nginx
```

---

## Monitoring & Maintenance

### Weekly tasks:
```bash
# Check logs
pm2 logs kuamini-prod

# Monitor disk
df -h /

# Clean old logs (if not auto-managed)
find /home/ubuntu/.pm2/logs -name "*.log" -mtime +30 -delete
```

### Monthly tasks:
- Review database backups
- Check database size growth
- Verify log rotation
- Test rollback procedure

---

## Support & Documentation

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **PM2 Docs**: https://pm2.keymetrics.io/docs/usage/
- **AWS EC2 Guide**: https://docs.aws.amazon.com/ec2/

