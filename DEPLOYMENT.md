# Production Deployment & Operations Guide

**Status**: ✅ Production Ready  
**Last Updated**: February 8, 2026  
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

Set these in your Vercel/hosting platform's secret settings:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-instance.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_REDIRECT_URL=https://kuaminisystems.com/securityAgent/auth/callback
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-KEEP-SECRET

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://kuaminisystems.com/api/agent

# Installer Security
INSTALLER_TOKEN_SECRET=your-long-random-secret-key-32-chars
INSTALLER_TOKEN_TTL_SECONDS=604800  # 7 days
INSTALLER_RATE_LIMIT_WINDOW_MS=600000  # 10 minutes
INSTALLER_RATE_LIMIT_MAX=60

# Database
DATABASE_URL=postgresql://user:password@host:5432/db

# Environment
NODE_ENV=production
DEBUG=false
```

### Environment Variable Details

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase public client URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (KEEP SECRET) | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_REDIRECT_URL` | OAuth callback URL | ✅ Yes |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL for agents | ✅ Yes |
| `INSTALLER_TOKEN_SECRET` | Secret for token generation | ✅ Yes |
| `DATABASE_URL` | Direct PostgreSQL connection | ✅ Yes |
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

### Vercel Configuration

**File**: `vercel.json`

```json
{
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install --frozen-lockfile",
  "env": {
    "NODE_ENV": "production"
  },
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
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
- [ ] Database triggers working correctly
- [ ] License counting triggers verified
- [ ] RLS (Row Level Security) policies enabled
- [ ] Database backup taken before deployment

### Agents & Installers
- [ ] Windows MSI built and code-signed
- [ ] macOS PKG built and code-signed
- [ ] Linux DEB/RPM packages built
- [ ] All installers published to `public/tray/`
- [ ] Installer scripts updated with new URLs

### Security
- [ ] Supabase auth settings configured
- [ ] OAuth redirect URLs whitelisted
- [ ] CORS policies correctly configured
- [ ] Rate limiting enabled on API routes
- [ ] Secrets not committed to repository
- [ ] Code signing certificates valid

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
npm version patch  # or minor/major
# This updates package.json and creates git tag

# 3. Update CHANGELOG
# Edit CHANGELOG.md with new changes

# 4. Build installers (if needed)
cd agent-tray
pip install -r requirements.txt
python build_installers.py

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

### Step 4: Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
# Login to Vercel
vercel login

# Deploy to production
vercel deploy --prod

# Verify deployment
curl https://kuaminisystems.com/api/health
```

**Option B: GitHub Integration**
```bash
# Push to main branch (if using GitHub)
git push origin main

# Vercel automatically deploys on push to main
# Monitor deployment in https://vercel.com/dashboard
```

**Option C: Manual via Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Deployments** tab
4. Click **Deploy** button or push to main

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
# Check in Supabase dashboard - verify recent queries

# Authentication
# Log in to console: https://kuaminisystems.com/securityAgent
# Verify Login works correctly
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

1. Go to https://vercel.com/dashboard
2. Click on project
3. Check **Analytics** tab
4. Verify response times normal
5. Check for error rate spikes

### Step 5: Database Verification

1. Log into Supabase dashboard
2. Check **Statistics** tab
3. Verify query performance
4. Review logs for errors
5. Check storage usage

---

## Production Operations

### Daily Operations

#### Morning Check
```bash
# Check API is healthy
curl https://kuaminisystems.com/api/health

# Check for errors in logs
# (View in Vercel dashboard → Logs)

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
# Via Vercel CLI
vercel logs

# Via dashboard
# https://vercel.com/dashboard → Logs tab
```

### Routine Maintenance

#### Database Maintenance (Weekly)
```sql
-- Run ANALYZE on tables (Supabase does this automatically)
-- Check for dead tuples
-- Review slow queries in logs
```

#### Cache Cleanup (Weekly)
```bash
# Clear Vercel cache if needed
vercel env pull production
```

#### Log Rotation (Monthly)
- Supabase automatically rotates logs
- Archive old logs for compliance

---

## Monitoring & Alerting

### Uptime Monitoring

Use a service like Uptime Robot, Pingdom, or New Relic:

```bash
# Monitor endpoint
https://kuaminisystems.com/api/health

# Expected: HTTP 200 OK response
# Check interval: Every 5 minutes
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
2. **Assess**: Check API health, database, logs
3. **Communicate**: Notify status page, users
4. **Resolve**: Fix issue or roll back deployment
5. **Verify**: Confirm resolution
6. **Document**: Write incident report

### Common Issues

#### API Responding Slowly

```bash
# 1. Check database connection
# Supabase dashboard → SQL Editor

# 2. Check recent deployments
# Vercel dashboard → Deployments

# 3. Check error logs
# Vercel dashboard → Logs

# 4. Possible causes:
# - Database query inefficiency
# - Stuck process
# - High traffic spike
```

#### Registration Failures

```bash
# 1. Verify endpoint is accessible
curl https://kuaminisystems.com/api/agent/register

# 2. Check database for errors
# Review logs in Supabase

# 3. Verify token generation working
# Test with known-good token
```

#### Database Connection Issues

```bash
# 1. Check Supabase dashboard status
# https://status.supabase.com

# 2. Verify environment variables
# Check SUPABASE_SERVICE_ROLE_KEY is correct

# 3. Test connection
# Supabase dashboard → SQL Editor → Run query
```

### Rollback Procedure

If deployment causes critical issues:

```bash
# Option 1: Vercel auto-rollback
# Vercel dashboard → Deployments → Click previous version → Rollback

# Option 2: Manual rollback
git revert <commit-hash>
git push origin main
# Vercel redeploys automatically

# Option 3: Instant rollback
vercel rollback
```

---

## Backup & Disaster Recovery

### Database Backups

**Supabase Automated Backups:**
- ✅ Daily backups (retained 30 days)
- ✅ Point-in-time recovery available
- ✅ Automatic replication

**Manual Backup:**
```bash
# Export database
pg_dump postgresql://user:password@host:5432/db > backup.sql

# Verify backup
wc -l backup.sql  # Should have tens of thousands of lines
```

### Backup Verification

Test your backup restores:

```bash
# 1. Monthly backup restore test
# Restore to staging database
# Verify schema and data match production

# 2. Document restore time
# Helps estimate RTO (Recovery Time Objective)

# 3. Test critical operations
# User login, agent registration, etc.
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 1 hour  
**RPO (Recovery Point Objective)**: 15 minutes

**Recovery Steps:**

1. **Detect failure** (1 min)
   - Monitoring alerts
   - Manual verification

2. **Assess damage** (5 min)
   - Check deployment status
   - Check database connectivity
   - Review recent changes

3. **Initiate recovery** (10 min)
   - Trigger rollback (if deployment issue)
   - Restore from backup (if data issue)
   - Update DNS (if infrastructure issue)

4. **Verify recovery** (10 min)
   - Run health checks
   - Test critical functionality
   - Monitor for issues

5. **Notify stakeholders** (5 min)
   - Update status page
   - Email users
   - Slack notifications

6. **Post-incident review** (1 hour)
   - Document what happened
   - Identify root cause
   - Plan improvements

### Critical Data Locations

**Supabase PostgreSQL:**
```
- Master: Automatic daily backups
- Replicas: High availability
- Retention: 30 days
```

**Application Code:**
```
- GitHub: Version control (always available)
- Vercel: Build artifacts (14 days)
- Local: Developer machines
```

---

## Deployment Troubleshooting

### Build Failures

**Problem:** Deployment build fails

**Solutions:**
```bash
# 1. Check build logs
# Vercel dashboard → Deployments → Failed build → Logs

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
# 1. Verify in Vercel
# Vercel dashboard → Settings → Environment Variables

# 2. Required variables:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_API_BASE_URL
INSTALLER_TOKEN_SECRET
DATABASE_URL
NODE_ENV=production

# 3. Redeploy
vercel deploy --prod
```

### Deployment Stuck

**Problem:** Deployment takes >15 minutes or hangs

**Solution:**
```bash
# 1. Cancel current deployment
vercel cancel

# 2. Check for resource issues
# Database connection, API timeouts

# 3. Simplify changes if needed
# Commit smaller changes

# 4. Redeploy
vercel deploy --prod
```

For comprehensive operational guides, see other markdown files in the project root.
