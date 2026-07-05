# AWS Deployment Quick Start

## Prerequisites Checklist

- [ ] AWS account with EC2 access
- [ ] EC2 instance running (Ubuntu 22.04 LTS recommended)
- [ ] Static **public** IP assigned to EC2 instance (Elastic IP)
- [ ] SSH key pair created and saved locally

> Important: Use the instance **public IPv4 / Elastic IP** for SSH and GitHub secret `AWS_EC2_HOST_PROD`. Do not use private VPC IPs like `172.31.x.x`.

---

## Step 1: Configure EC2 Instance (One-time setup)

### SSH into your instance:
```bash
ssh -i /path/to/your/key.pem ubuntu@YOUR_EC2_IP
```

### Run setup script:
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
sudo npm install -g pnpm@10

# Install PM2
sudo npm install -g pm2
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup -u ubuntu --hp /home/ubuntu

# Create app directory
mkdir -p /home/ubuntu/apps/kuamini-prod

# Create swap space
sudo swapon --show
# If /swapfile is NOT already active, create it:
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Create environment file:
```bash
cat > /home/ubuntu/apps/kuamini-prod/.env.production << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://user:password@rds-host:5432/dbname
NEXTAUTH_SECRET=generate-a-secret-here
NEXTAUTH_URL=https://your-domain.com
PORT=3000
EOF

chmod 600 /home/ubuntu/apps/kuamini-prod/.env.production
```

### How to get each `.env.production` value

| Variable | How to get it | Example |
|------|------|------|
| `NODE_ENV` | Fixed for production deployments. Always use `production`. | `production` |
| `DATABASE_URL` | Build this from your PostgreSQL details (usually AWS RDS endpoint + DB user + DB name). | `postgresql://app_user:strongpass@mydb.abc123.ap-south-1.rds.amazonaws.com:5432/threat_protection_db?sslmode=require` |
| `NEXTAUTH_SECRET` | Generate a random secret string once and reuse it. | `openssl rand -base64 32` output |
| `NEXTAUTH_URL` | Public URL where users access your app (domain preferred). | `https://app.example.com` |
| `PORT` | App listen port on EC2. Keep `3000` unless you intentionally change PM2/app port. | `3000` |

#### Detailed steps for `DATABASE_URL`

1. In AWS Console, open **RDS** → **Databases**.
2. Select your PostgreSQL instance.
3. In **Connectivity & security**, copy the **Endpoint** (host).
4. Use port `5432` (default PostgreSQL port).
5. Use the DB name you created (for example `threat_protection_db`).
6. Use the DB username/password you created for the app.
7. Construct URL:

```text
postgresql://<db_user>:<db_password>@<rds_endpoint>:5432/<db_name>?sslmode=require
```

Important:
- If password has special characters (`@`, `#`, `/`, `:`), URL-encode it.
- Ensure RDS security group allows inbound PostgreSQL from your EC2 security group.

#### Detailed steps for `NEXTAUTH_SECRET`

Generate once (local machine or EC2):

```bash
openssl rand -base64 32
```

Copy the full output into:
- `/home/ubuntu/apps/kuamini-prod/.env.production`
- GitHub Actions secret `NEXTAUTH_SECRET`

Do not rotate this unless required (rotation invalidates active sessions).

#### Detailed steps for `NEXTAUTH_URL`

Use the exact public base URL that users open in browser:

- Preferred: domain with HTTPS, for example `https://security.example.com`
- Temporary test (before domain/SSL): `http://<EC2_PUBLIC_IP>:3000`

Rules:
- No trailing slash
- Must match the real protocol (`http` vs `https`)

#### Detailed steps for `PORT`

Set:

```text
PORT=3000
```

Keep this as-is unless you intentionally change:
- reverse proxy config (nginx)
- PM2 start command
- health checks

#### Recommended final `.env.production`

```bash
cat > /home/ubuntu/apps/kuamini-prod/.env.production << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://<db_user>:<db_password>@<rds_endpoint>:5432/<db_name>?sslmode=require
NEXTAUTH_SECRET=<openssl_generated_secret>
NEXTAUTH_URL=https://<your-domain>
PORT=3000
EOF

chmod 600 /home/ubuntu/apps/kuamini-prod/.env.production
```

---

## Step 2: Add GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Name | Value |
|------|-------|
| `AWS_EC2_HOST_PROD` | Your EC2 **public** IP or public hostname (not private `172.31.x.x`) |
| `AWS_EC2_USER` | `ubuntu` |
| `AWS_EC2_SSH_KEY` | Copy entire contents of your SSH private key (`.pem` or other private key file) |
| `DATABASE_URL` | Your PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your application's public URL |

### If you cannot find your `.pem` file

1. Try locating it on your local machine:

```bash
find ~/Downloads ~/.ssh ~/Desktop -type f -name "*.pem" 2>/dev/null
```

2. If not found, create a new key pair locally:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kuamini-gh-actions -C "github-actions-deploy" -N ""
```

3. Add the new public key to EC2 (`~/.ssh/authorized_keys`) while logged into EC2.
4. Put the new private key content into GitHub secret `AWS_EC2_SSH_KEY`.

---

## Step 3: Deploy (Manual Trigger)

### Option A: GitHub Web UI
1. Go to **Actions** tab
2. Select **"Deploy to AWS EC2"**
3. Click **"Run workflow"** button
4. Select branch → **"Run workflow"**

### Option B: GitHub CLI
```bash
gh workflow run deploy-aws.yml -f ref=main
```

### Option C: Curl
```bash
curl -X POST \
  https://api.github.com/repos/YOUR_USERNAME/threat-protection-server/actions/workflows/deploy-aws.yml/dispatches \
  -H 'Accept: application/vnd.github.v3+raw+json' \
  -H 'Authorization: token YOUR_GITHUB_TOKEN' \
  -d '{"ref":"main"}'
```

---

## Step 4: Verify Deployment

### Monitor in GitHub Actions:
1. Go to **Actions** tab
2. Click on the running workflow
3. Watch real-time deployment logs

### Verify on EC2:
```bash
# SSH into your instance
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_IP

# Check PM2 status
pm2 status

# View application logs
pm2 logs kuamini-prod --lines 50

# Test endpoint
curl http://localhost:3000/api/health
```

---

## Deployment Summary

| Action | Who | When | How |
|--------|-----|------|-----|
| Code changes | Developer | Anytime | Push to feature branch |
| Quality check | GitHub | On PR to main | Automatic (eslint, tsc, test) |
| Merge to main | Reviewer | When ready | Manual PR approval |
| Deploy to AWS | DevOps/Dev | Planned time | Manual workflow trigger |

---

## Key Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| Deploy workflow | AWS deployment automation | `.github/workflows/deploy-aws.yml` |
| Quality gate | PR validation | `.github/workflows/quality-and-release-gate.yml` |
| Environment | Production secrets | `/home/ubuntu/apps/kuamini-prod/.env.production` (EC2) |
| Node config | Build settings | `package.json` |

---

## Troubleshooting

**Deployment fails with SSH error**:
```bash
# Verify SSH key is correct
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_IP "echo 'SSH works'"

# Check GitHub secret `AWS_EC2_SSH_KEY` is exactly the .pem file content
```

If SSH times out:
- Confirm you are using **public IP / Elastic IP**, not private `172.31.x.x`.
- Confirm security group inbound rule allows TCP 22 from your source.

**Build runs out of memory**:
```bash
# On EC2, increase swap
sudo fallocate -l 4G /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
```

If you get `EACCES` while installing pnpm globally:

```bash
sudo npm install -g pnpm@10
```

If you get `fallocate failed: Text file busy`:
- `/swapfile` already exists or is active. Check with `sudo swapon --show`.
- If active, skip creation and continue.

**Application won't start**:
```bash
# Check logs
pm2 logs kuamini-prod

# Verify environment variables
cat /home/ubuntu/apps/kuamini-prod/.env.production

# Check database connection
psql $DATABASE_URL -c "SELECT version();"
```

If `https://<domain>/securityAgent` returns 404:
- The legacy route may not exist anymore.
- Ensure latest deployment includes redirect rules in [next.config.mjs](next.config.mjs).
- Redeploy after pulling latest code.

**Disk space issues**:
```bash
# Clean up
rm -rf /home/ubuntu/apps/kuamini-prod/.next
rm -rf /home/ubuntu/apps/kuamini-prod/node_modules
docker system prune -a  # If using Docker
```

---

## Next Steps

1. ✅ Set up EC2 instance
2. ✅ Configure GitHub secrets
3. ✅ Test initial deployment
4. ✅ Set up monitoring/alerts
5. ✅ Configure CI/CD notifications (Slack/email)
6. ✅ Document runbooks for team

---

## Additional Resources

- **AWS Deployment Guide**: See `AWS_DEPLOYMENT_GUIDE.md`
- **Workflows Overview**: See `.github/workflows/README.md`
- **Next.js Docs**: https://nextjs.org/docs/deployment
- **PM2 Docs**: https://pm2.keymetrics.io/
- **GitHub Actions**: https://docs.github.com/en/actions

