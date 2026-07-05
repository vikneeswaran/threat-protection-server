# AWS Deployment Documentation Index

Welcome! This directory contains comprehensive guides for deploying the Threat Protection Server to AWS EC2.

---

## 📚 Documentation Files

### Quick Reference (Start Here!)
- **[DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)** ⭐ **START HERE**
  - Your auto-deployment status (manual-only confirmed)
  - Workflow overview (4 workflows explained)
  - Quick deployment steps
  - Key facts and FAQ

### Getting Started
- **[AWS_DEPLOYMENT_QUICK_START.md](AWS_DEPLOYMENT_QUICK_START.md)**
  - Step-by-step quick start guide
  - EC2 setup script (copy-paste ready)
  - GitHub secrets configuration
  - Deployment verification
  - Troubleshooting common issues

### Comprehensive Guide
- **[AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)**
  - Prerequisites checklist
  - EC2 instance detailed setup
  - GitHub secrets explained
  - Environment variables
  - Database setup (PostgreSQL/RDS)
  - Deployment workflow explained
  - Rollback procedures
  - Performance tuning
  - Maintenance guide

### Architecture & Workflows
- **[DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md)**
  - System architecture diagrams
  - Deployment workflow timeline
  - Data flow visualization
  - Network security setup
  - Key components explained
  - Manual vs Auto deployment comparison

### GitHub Workflows
- **[.github/workflows/README.md](.github/workflows/README.md)**
  - GitHub Actions workflows overview
  - Trigger explanations
  - Deployment strategy
  - Workflow configuration details

---

## 🚀 Quick Deployment Path

### Path 1: New to AWS (30 minutes)
1. Read: **DEPLOYMENT_STATUS.md** (2 min)
2. Follow: **AWS_DEPLOYMENT_QUICK_START.md** - Steps 1-2 (10 min)
3. Execute: **AWS_DEPLOYMENT_QUICK_START.md** - Step 3 (15 min)
4. Verify: **AWS_DEPLOYMENT_QUICK_START.md** - Step 4 (3 min)

### Path 2: Already Have EC2 (10 minutes)
1. Read: **DEPLOYMENT_STATUS.md** - "Step 2 section" (2 min)
2. Add GitHub secrets (5 min)
3. Trigger deployment (3 min)

### Path 3: Need Deep Dive (1-2 hours)
1. Read: **DEPLOYMENT_STATUS.md** (5 min)
2. Study: **DEPLOYMENT_ARCHITECTURE.md** (10 min)
3. Review: **AWS_DEPLOYMENT_GUIDE.md** (15 min)
4. Execute: **AWS_DEPLOYMENT_QUICK_START.md** (20 min)
5. Monitor & verify: (10 min)

---

## ✅ What's Configured

### Auto-Deployment Status
```
❌ Auto-deployment: DISABLED
✅ Manual-only deployment: ENABLED
✅ Quality gate: ACTIVE on PRs
✅ Production-ready: YES
```

### Current Workflows
```
1. Deploy to AWS EC2          → Manual trigger (workflow_dispatch)
2. Quality and Release Gate   → PR checks (automatic)
3. Benchmark Baseline         → Performance tracking
4. Copilot Cloud Agent        → AI integration
```

### Key Features
- ✅ No automatic deployments on code push
- ✅ Requires code review before merge
- ✅ Manual approval before deployment
- ✅ Real-time deployment logs
- ✅ Easy rollback procedures

---

## 🔑 GitHub Secrets Required

```
AWS_EC2_HOST_PROD           (Your EC2 IP/hostname)
AWS_EC2_USER                (SSH user, usually "ubuntu")
AWS_EC2_SSH_KEY             (Private SSH key contents)
DATABASE_URL                (PostgreSQL connection string)
NEXTAUTH_SECRET             (Generated random secret)
NEXTAUTH_URL                (Your application URL)
```

See **AWS_DEPLOYMENT_QUICK_START.md - Step 2** for detailed setup.

---

## 📋 Deployment Checklist

### Before First Deployment
- [ ] EC2 instance created (Ubuntu 22.04 LTS)
- [ ] Node.js v20+ installed on EC2
- [ ] pnpm installed globally
- [ ] PM2 installed and configured
- [ ] Application directory created
- [ ] Environment variables set on EC2
- [ ] GitHub secrets added (6 secrets)
- [ ] SSH key configured

### Before Each Deployment
- [ ] Code merged to main branch
- [ ] Quality gate passed (lint, type, test)
- [ ] Database migrations applied (if needed)
- [ ] Team is aware of deployment

### After Each Deployment
- [ ] Monitor GitHub Actions logs
- [ ] Verify app is running (SSH + pm2 status)
- [ ] Test application endpoints
- [ ] Check application logs for errors
- [ ] Verify database connections

---

## 🛠️ Common Commands

### Deploy via GitHub UI (Easiest)
```
1. Go to Actions tab
2. Click "Deploy to AWS EC2"
3. Click "Run workflow"
4. Select branch → Run
```

### Deploy via GitHub CLI
```bash
gh workflow run deploy-aws.yml -f ref=main
```

### Check Deployment Status (SSH)
```bash
ssh -i key.pem ubuntu@YOUR_EC2_IP
pm2 status
pm2 logs kuamini-prod --lines 50
curl http://localhost:3000/api/health
```

### Rollback to Previous Version
```bash
cd /home/ubuntu/apps/kuamini-prod
git log --oneline | head -5
git reset --hard COMMIT_HASH
pnpm install --frozen-lockfile
pnpm build
pm2 restart kuamini-prod
```

---

## 📊 Deployment Timeline

| Step | Duration | Who | What |
|------|----------|-----|------|
| Code Review | Variable | Team | Review PR, check code |
| Merge | 1 min | Reviewer | Approve and merge PR |
| Manual Trigger | 30 sec | DevOps | Click "Run workflow" |
| Build & Deploy | 15-20 min | GitHub Actions | Build app, deploy to EC2 |
| Verification | 3-5 min | DevOps | Verify app is running |
| **Total** | **20-30 min** | | |

---

## 🔒 Security Considerations

### Secrets Protection
- GitHub secrets: Encrypted at rest
- Environment variables: Stored on EC2 only
- SSH key: Never committed to git
- Database password: In DATABASE_URL only

### Network Security
- EC2 security group: SSH only from GitHub Actions
- RDS security group: Database access from EC2 only
- HTTPS/TLS: Termination at reverse proxy
- Application: Listens on localhost only

### Access Control
- EC2 SSH: Key-based auth (no passwords)
- GitHub: Use deploy keys or fine-grained tokens
- Database: Least-privilege user account
- API: Authentication via NextAuth

---

## 🆘 Getting Help

### Common Issues

**SSH Connection Failed**
→ See: AWS_DEPLOYMENT_GUIDE.md - Troubleshooting section

**Out of Disk Space**
→ See: AWS_DEPLOYMENT_QUICK_START.md - Troubleshooting

**Application Won't Start**
→ See: AWS_DEPLOYMENT_QUICK_START.md - Troubleshooting

**Database Connection Error**
→ See: AWS_DEPLOYMENT_QUICK_START.md - Troubleshooting

### Need More Help?
- AWS Documentation: https://docs.aws.amazon.com/
- GitHub Actions: https://github.com/features/actions
- Next.js: https://nextjs.org/docs
- PM2: https://pm2.keymetrics.io/docs

---

## 📈 Next Steps After Deployment

1. **Monitor Performance**
   - Set up CloudWatch metrics
   - Create alarms for errors
   - Track API response times

2. **Configure Backups**
   - Database backups (daily)
   - Application backups (weekly)
   - Log retention policies

3. **Setup Notifications**
   - Slack alerts on deployment
   - Email notifications on errors
   - PagerDuty integration (optional)

4. **Document Procedures**
   - Runbook for deployments
   - Incident response plan
   - Rollback procedures
   - On-call rotation

5. **Team Training**
   - How to deploy
   - How to monitor
   - How to rollback
   - Emergency procedures

---

## 📝 Document Versions

| Document | Version | Status | Last Updated |
|----------|---------|--------|--------------|
| DEPLOYMENT_STATUS.md | 1.0 | Current | 2026-07-04 |
| AWS_DEPLOYMENT_GUIDE.md | 1.0 | Current | 2026-07-04 |
| AWS_DEPLOYMENT_QUICK_START.md | 1.0 | Current | 2026-07-04 |
| DEPLOYMENT_ARCHITECTURE.md | 1.0 | Current | 2026-07-04 |
| .github/workflows/README.md | 1.1 | Current | 2026-07-04 |

---

## 🎯 Summary

Your deployment setup is **production-ready**:
- ✅ Auto-deployment: Disabled (manual only)
- ✅ Quality gates: Enabled (code review required)
- ✅ Workflows: Properly configured
- ✅ Security: Best practices followed
- ✅ Documentation: Complete

**Ready to deploy!** Start with [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md).

