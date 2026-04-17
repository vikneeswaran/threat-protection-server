# Production Deployment & Operations Guide

**Status**: ✅ Production Ready  
**Last Updated**: April 16, 2026  
**Version**: 2.1

Complete guide for deploying to production and managing operations.

---

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Build & Deployment](#build--deployment)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Production Operations](#production-operations)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Incident Response](#incident-response)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)

---

## Environment Configuration

### Production Environment Variables

Set these in your AWS EC2 instance environment or GitHub Actions secrets:

```bash
# AWS & Database Configuration
DATABASE_URL=postgres://user:password@threat-db.rds.amazonaws.com:5432/threat_db
DATABASE_SSL=true
AWS_REGION=us-east-1

# Session & Security
SESSION_SECRET=your-long-random-secret-key-32-chars
COOKIE_SECURE=true
COOKIE_HTTPONLY=true

# Installer Security
INSTALLER_TOKEN_SECRET=your-long-random-secret-key-32-chars
INSTALLER_TOKEN_TTL_SECONDS=604800  # 7 days
INSTALLER_RATE_LIMIT_WINDOW_MS=600000  # 10 minutes
INSTALLER_RATE_LIMIT_MAX=60

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://kuaminisystems.com/api/agent

# Environment
NODE_ENV=production
DEBUG=false
```

### Environment Variable Details

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | AWS RDS PostgreSQL connection string | ✅ Yes |
| `DATABASE_SSL` | Enable SSL for database connection | ✅ Yes |
| `AWS_REGION` | AWS region for services | ✅ Yes |
| `SESSION_SECRET` | Session encryption secret | ✅ Yes |
| `COOKIE_SECURE` | Set secure flag on cookies | ✅ Yes |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL for agents | ✅ Yes |
| `INSTALLER_TOKEN_SECRET` | Secret for token generation | ✅ Yes |
| `NODE_ENV` | Set to `production` | ✅ Yes |

### Generating Secure Secrets

```bash
# Generate 32-character random secret
# macOS/Linux:
openssl rand -base64 32

# Windows PowerShell:
[System.Convert]::ToBase64String([System.Guid]::NewGuid().ToByteArray())

# Or Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### AWS EC2 & GitHub Actions Setup

**Deploy via GitHub Actions:**
1. Set environment variables in GitHub repository secrets
2. Push to `main` branch to trigger automatic deployment
3. Monitor GitHub Actions workflows tab

**EC2 Instance Setup:**
```bash
# Install Node.js, PM2, nginx
sudo apt update && sudo apt install -y nodejs npm
npm install -g pm2 pnpm

# Clone repository and install dependencies
git clone https://github.com/kuamini/threat-protection-agent.git
cd threat-protection-agent
pnpm install --frozen-lockfile

# Build and start with PM2
pnpm run build
pm2 start "pnpm start" --name "threat-agent"
pm2 save && pm2 startup
```

---

## Pre-Deployment Checklist

Use this checklist before every production deployment:

### Code Quality
- [ ] All tests passing locally and in CI/CD
- [ ] All TypeScript errors resolved
- [ ] ESLint passes with no critical issues
- [ ] Code review approved
- [ ] All changes committed and pushed

### Application
- [ ] Version number updated in package.json
- [ ] CHANGELOG.md updated with changes
- [ ] All new dependencies documented
- [ ] No security vulnerabilities (npm audit clean)

### Infrastructure
- [ ] SSL/TLS certificate valid for kuaminisystems.com
- [ ] DNS records pointing to deployment platform
- [ ] Environment variables configured on deployment platform
- [ ] Database backups scheduled and tested
- [ ] Logging and monitoring configured

### Database
- [ ] Database schema migrations tested locally
- [ ] Session table and indexes created
- [ ] Database backups configured and tested
- [ ] SSL/TLS connection verified
- [ ] Database credentials in secrets manager

### Agents & Installers
- [ ] Windows MSI built and code-signed
- [ ] macOS PKG built and code-signed
- [ ] Linux DEB/RPM packages built
- [ ] All installers published to `public/tray/`
- [ ] Installer scripts updated with new URLs

### Security
- [ ] Session management configured correctly
- [ ] OAuth/token validation working
- [ ] CORS policies correctly configured
- [ ] Rate limiting enabled on API routes
- [ ] Secrets not committed to repository
- [ ] Code signing certificates valid
- [ ] Database credentials in AWS Secrets Manager or encrypted .env

### Monitoring
- [ ] Alerts configured for API errors
- [ ] Dashboard monitoring setup
- [ ] Log aggregation configured
- [ ] Performance monitoring enabled
- [ ] Alert recipients updated

### Support & Documentation
- [ ] INSTALLATION.md updated
- [ ] API documentation current
- [ ] Runbook created for common issues
- [ ] Support team briefed on changes
- [ ] Rollback plan documented

---

## Build & Deployment

### Step 1: Prepare Release

```bash
# 1. Checkout main branch
git checkout main
git pull origin main

# 2. Update version number
pnpm version patch  # or minor/major
# This updates package.json and creates git tag

# 3. Update CHANGELOG
# Edit CHANGELOG.md with new changes

# 4. Build installers (if needed)
# Windows installer from repo root:
pnpm run build:installer

# Optional Windows installer flow with registration token handling:
pnpm run build:agent:token

# Optional cross-platform binaries (run from agent-tray/):
cd agent-tray
pip install -r requirements.txt
pyinstaller KuaminiSecurityClient-win.spec
pyinstaller KuaminiSecurityClient-mac.spec
pyinstaller KuaminiSecurityClient-linux.spec
cd ..

# 5. Code sign installers
# (See CODE_SIGNING_GUIDE.md for details)

# 6. Copy to public/tray/
cp *.msi ../public/tray/
cp *.pkg ../public/tray/
cp *.deb ../public/tray/

# 7. Commit and tag
git add .
git commit -m "release: v1.2.3"
git tag v1.2.3
git push origin main --tags
```

### Step 2: Build Application

```bash
# Ensure dependencies are installed
pnpm install --frozen-lockfile

# Run production build
pnpm run build

# Check build output
ls -la .next
ls -la public/tray/
```

### Step 3: Run Pre-Deployment Tests

```bash
# Run full validation suite
pnpm run validate

# Build verification
pnpm run build && echo "✅ Build successful"

# Test API endpoints locally
pnpm run dev &
sleep 3
curl http://localhost:3000/api/health
kill %1
```

### Step 4: Deploy to AWS EC2

**Automatic Deployment via GitHub Actions:**
```bash
# Push to main branch
git push origin main

# GitHub Actions workflow automatically:
# 1. Builds the application
# 2. Runs tests
# 3. Deploys to AWS EC2 via SSH
# 4. Restarts PM2 process
# 5. Verifies health

# Monitor deployment in GitHub Actions tab
# Repository → Actions → Latest workflow run
```

**Manual Deployment to AWS EC2:**
```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Pull latest code
cd /home/ubuntu/threat-protection-agent
git pull origin main
pnpm install --frozen-lockfile

# Build
pnpm run build

# Restart service with PM2
pm2 restart threat-agent
pm2 save

# Verify logs
pm2 logs threat-agent
```

### Step 5: Verify Deployment

```bash
# Check API health
curl https://kuaminisystems.com/api/health

# Expected response:
# {"ok":true,"env":"production"}

# Test registration endpoint
curl -X POST https://kuaminisystems.com/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test-token",
    "hostname": "test-machine",
    "os": "windows",
    "os_version": "10.0.19045",
    "agent_version": "1.0.0"
  }'
```

---

## Post-Deployment Verification

### Step 1: Health Checks

```bash
# API Health
curl https://kuaminisystems.com/api/health

# Database Connection
# SSH into EC2 and check:
psql $DATABASE_URL -c "SELECT version();"

# PM2 Process Status
pm2 status
pm2 logs threat-agent

# Authentication
# Log in to console: https://kuaminisystems.com/securityAgent
# Verify session management and login works
```

### Step 2: Functionality Tests

```bash
# 1. Test Registration Endpoint
ACCOUNT_ID="test-account"
TOKEN="test-token"

curl -X POST https://kuaminisystems.com/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$TOKEN'",
    "hostname": "test-endpoint",
    "os": "macos",
    "os_version": "15.5",
    "agent_version": "1.0.0"
  }'

# 2. Test Config Endpoint
curl "https://kuaminisystems.com/api/agent/installers/config?accountId=$ACCOUNT_ID&registrationToken=$TOKEN"

# 3. Test Heartbeat
curl -X POST https://kuaminisystems.com/api/agent/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent-id",
    "hostname": "test-machine"
  }'
```

### Step 3: User Interface Tests

1. Open https://kuaminisystems.com/securityAgent
2. Test login functionality
3. Navigate to Endpoints dashboard
4. Verify no console errors (F12 Developer Tools)
5. Test installer download

### Step 4: Monitoring Dashboard

1. SSH into EC2 and check system status:
   ```bash
   top
   free -h
   df -h
   pm2 status
   ```
2. Check nginx status:
   ```bash
   sudo systemctl status nginx
   sudo tail -f /var/log/nginx/access.log
   ```
3. Check PM2 logs:
   ```bash
   pm2 logs threat-agent
   ```

### Step 5: Database Verification

1. Verify database connectivity:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM endpoints;"
   ```
2. Check session table:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM app_sessions;"
   ```
3. Review database logs for errors

---

## Production Operations

### Daily Operations

#### Morning Check
```bash
# Check API is healthy
curl https://kuaminisystems.com/api/health

# Check for errors in logs
pm2 logs threat-agent --lines 50

# Check endpoint status
# (View in https://kuaminisystems.com/securityAgent → Endpoints)
```

#### Update Agent Versions

```bash
# When new agent version released:
# 1. Update installers in public/tray/
# 2. Deploy application to publish new installers
# 3. Verify agents download updated version
```

#### Monitor Deployment Status
```bash
# Check GitHub Actions status
# Repository → Actions → Latest workflow

# Check PM2 status
pm2 status

# Check nginx reverse proxy
curl -i https://kuaminisystems.com/api/health
```

### Routine Maintenance

#### Database Maintenance (Weekly)
```bash
# Connect to AWS RDS and run:
psql $DATABASE_URL -c "ANALYZE;"

# Check for dead tuples
psql $DATABASE_URL -c "SELECT schemaname, tablename, n_dead_tup FROM pg_stat_user_tables WHERE n_dead_tup > 1000;"

# Vacuum if needed
psql $DATABASE_URL -c "VACUUM ANALYZE endpoints;"
```

#### EC2 System Maintenance
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Check disk space
df -h /

# Rotate logs
sudo logrotate -f /etc/logrotate.d/nginx
pm2 flush
```

#### SSL Certificate Renewal
```bash
# If using Let's Encrypt with nginx
sudo certbot renew --dry-run

# Verify certificate
sudo openssl x509 -in /etc/letsencrypt/live/kuaminisystems.com/fullchain.pem -text -noout
```

#### Log Rotation (Monthly)
```bash
# EC2 logs rotate automatically
# Check PM2 log retention:
pm2 show threat-agent | grep "log size"

# Archive old logs manually if needed
tar czf /backup/logs-$(date +%Y%m%d).tar.gz /var/log/nginx/
```

---

## Monitoring & Alerting

### Uptime Monitoring

Use AWS CloudWatch or third-party service:

```bash
# Monitor endpoint
https://kuaminisystems.com/api/health

# Expected: HTTP 200 OK response
# Check interval: Every 5 minutes

# Or use AWS CloudWatch:
# AWS Console → CloudWatch → Alarms → Create Alarm
```

### Error Tracking

**Sentry Integration (recommended)**:
```javascript
// In production app
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
  tracesSampleRate: 0.1,
});
```

### Performance Monitoring

**Key Metrics to Monitor:**
- API response time (target: <200ms)
- Database query time (target: <50ms)
- Error rate (target: <0.1%)
- Agent registration success rate (target: >99%)

### Alert Recipients

- **Critical Issues**: Ops team (immediat)
- **Warnings**: Dev team (within 1 hour)
- **Info**: Archive to logs (review weekly)

---

## Incident Response

### Response Process

1. **Detect**: Monitoring alerts fire or user reports issue
2. **Assess**: Check API health, database, logs, PM2 status
3. **Communicate**: Notify status page, users
4. **Resolve**: Fix issue or roll back deployment
5. **Verify**: Confirm resolution
6. **Document**: Write incident report

### Common Issues

#### API Responding Slowly

```bash
# 1. SSH into EC2 and check system status
top  # Check CPU/memory usage
free -h  # Check available memory
df -h /  # Check disk space

# 2. Check database connection
psql $DATABASE_URL -c "SELECT version();"

# 3. Check recent deployments
# GitHub Actions → Workflows → Latest run

# 4. Check error logs
pm2 logs threat-agent --lines 100
sudo tail -f /var/log/nginx/error.log

# 5. Possible causes:
# - Database query inefficiency
# - Stuck PM2 process
# - High traffic spike
# - SSL certificate issue
```

#### Registration Failures

```bash
# 1. Verify endpoint is accessible
curl https://kuaminisystems.com/api/agent/register

# 2. Check database for errors
psql $DATABASE_URL -c "SELECT * FROM endpoints LIMIT 5;"

# 3. Check PM2 logs
pm2 logs threat-agent

# 4. Verify token generation working
# Test with known-good token
```

#### Database Connection Issues

```bash
# 1. Check AWS RDS status
# AWS Console → RDS → Instances → Check status

# 2. Verify environment variables
echo $DATABASE_URL
echo $DATABASE_SSL

# 3. Test connection
psql $DATABASE_URL -c "SELECT 1;" 

# 4. Check security groups
# AWS Console → EC2 → Security Groups → Allow 5432 inbound
```

### Rollback Procedure

If deployment causes critical issues:

```bash
# Option 1: GitHub Actions auto-rollback
# GitHub → Actions → Latest failed run → click "Re-run jobs"
# Or revert to previous commit:
git revert <commit-hash>
git push origin main
# GitHub Actions automatically deploys

# Option 2: Manual SSH rollback
ssh -i your-key.pem ubuntu@your-ec2-ip
cd /home/ubuntu/threat-protection-agent
git log --oneline | head -5  # See recent commits
git checkout <previous-commit>
pnpm install
pnpm run build
pm2 restart threat-agent
pm2 save
```

---

## Backup & Disaster Recovery

### Database Backups

**AWS RDS Automated Backups:**
- ✅ Daily automated backups (retained 35 days default)
- ✅ Point-in-time recovery available
- ✅ Multi-AZ automatic failover
- ✅ Snapshots for long-term retention

**Manual Backup:**
```bash
# Export database (SSH into EC2)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Compress backup
gzip backup-*.sql

# Upload to S3
aws s3 cp backup-*.sql.gz s3://your-backup-bucket/

# Verify backup
gunzip -t backup-*.sql.gz  # Test compression integrity
```

### Backup Verification

Test your backup restores:

```bash
# 1. Monthly backup restore test (on staging)
# AWS Console → RDS → Snapshots → Create snapshot
# Then restore snapshot to test instance

# 2. Verify schema and data match production
psql <staging-db-url> -c "SELECT COUNT(*) FROM endpoints;"

# 3. Test critical operations
# User login, agent registration, etc.

# 4. Document restore time
# Helps estimate RTO (Recovery Time Objective)
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 30-60 minutes  
**RPO (Recovery Point Objective)**: 15 minutes

**Recovery Steps:**

1. **Detect failure** (1-2 min)
   - CloudWatch alarms
   - Manual verification
   - Check EC2/RDS status

2. **Assess damage** (5-10 min)
   - Check GitHub Actions status
   - Check EC2 instance logs
   - Check RDS database status
   - Review recent changes

3. **Initiate recovery** (15-30 min)
   - Trigger rollback if deployment issue: `git revert && git push`
   - Restore RDS from snapshot if data corruption
   - Launch new EC2 instance if infrastructure failure
   - Update DNS/route53 if needed

4. **Verify recovery** (10 min)
   - Run health checks: `curl https://kuaminisystems.com/api/health`
   - Test critical functionality
   - Monitor EC2 and RDS metrics

5. **Notify stakeholders** (5 min)
   - Update status page
   - Email users
   - Slack notifications

6. **Post-incident review** (1-2 hours)
   - Document what happened
   - Identify root cause
   - Plan improvements
   - Update runbooks

### Critical Data Locations

**AWS RDS PostgreSQL:**
```
- Primary: Automatic daily backups
- Standby: Multi-AZ failover
- Snapshots: Long-term retention (S3)
- Retention: 35 days default
```

**Application Code:**
```
- GitHub: Version control (always available)
- EC2: Current deployed code and config
- Local: Developer machines
```

**Configuration:**
```
- GitHub Secrets: Environment variables
- AWS EC2: .env file (encrypted)
- AWS Secrets Manager: Optional long-term secrets
```

---

## Deployment Troubleshooting

### Build Failures

**Problem:** GitHub Actions deployment build fails

**Solutions:**
```bash
# 1. Check GitHub Actions logs
# GitHub → Actions → Latest workflow → View logs

# 2. Verify locally
pnpm run build

# 3. Check dependencies
pnpm install --frozen-lockfile

# 4. Clear cache
rm -rf .next node_modules
pnpm install
pnpm run build
```

### Environment Variables Not Working

**Problem:** App won't start due to missing env vars

**Solution:**
```bash
# 1. Verify on EC2
ssh -i your-key.pem ubuntu@your-ec2-ip
cat /home/ubuntu/threat-protection-agent/.env

# 2. Verify in GitHub Secrets
# GitHub → Settings → Secrets and variables → Actions → Repository secrets

# 3. Required variables:
DATABASE_URL
DATABASE_SSL=true
INSTALLER_TOKEN_SECRET
SESSION_SECRET
NODE_ENV=production
AWS_REGION

# 4. Redeploy
git push origin main
# Or SSH redeploy:
cd /home/ubuntu/threat-protection-agent
pnpm run build
pm2 restart threat-agent
```

### Deployment Stuck

**Problem:** GitHub Actions deployment takes >15 minutes or hangs

**Solution:**
```bash
# 1. Cancel current workflow
# GitHub → Actions → Latest run → Cancel workflow

# 2. Check for resource issues on EC2
df -h /
free -h
pm2 status

# 3. Simplify changes if needed
# Commit smaller changes

# 4. Redeploy
git push origin main
```

For comprehensive operational guides, see other markdown files in the project root.
