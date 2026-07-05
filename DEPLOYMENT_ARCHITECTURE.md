# AWS Deployment Architecture & Workflow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                        │
│  (threat-protection-server)                                     │
│                                                                 │
│  ├─ Main Branch (Production-ready code)                         │
│  ├─ Feature Branches (Development)                              │
│  └─ .github/workflows/ (CI/CD automation)                       │
│      ├─ deploy-aws.yml (Manual deployment)                      │
│      ├─ quality-and-release-gate.yml (PR checks)                │
│      └─ benchmark-baseline.yml (Performance tests)              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ (Manual trigger)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runner                         │
│  - Checks out code                                               │
│  - Installs dependencies                                         │
│  - Builds Next.js app                                            │
│  - Connects to EC2 via SSH                                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ (SSH connection)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      AWS EC2 Instance                            │
│  (Ubuntu 22.04 LTS)                                              │
│                                                                  │
│  ├─ Node.js (v20+)                                               │
│  ├─ pnpm (package manager)                                       │
│  ├─ PM2 (process manager)                                        │
│  │                                                               │
│  └─ Application Directory: /home/ubuntu/apps/kuamini-prod        │
│     ├─ Source code                                               │
│     ├─ Build artifacts (.next/)                                  │
│     ├─ node_modules/                                             │
│     └─ .env.production (secrets)                                 │
│                                                                  │
│  ├─ Process: kuamini-prod (running via PM2)                      │
│  │  └─ Listening on port 3000                                    │
│  │                                                               │
│  └─ Reverse Proxy (Optional)                                     │
│     └─ nginx → port 3000                                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ (Network)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      AWS RDS Database                            │
│  (PostgreSQL)                                                    │
│                                                                  │
│  ├─ Database: threat_protection_db                               │
│  ├─ Automated backups                                            │
│  └─ Multi-AZ replication (production)                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ (HTTPS)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Internet Users                              │
│  (your-domain.com)                                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Deployment Workflow Timeline

```
Step 1: Developer Commits Code
└─ Push to feature branch
└─ Create Pull Request to main

                ↓ (Automatic)

Step 2: Quality Gate Runs
├─ ESLint (code style check)
├─ TypeScript (type checking)
└─ Vitest (unit tests)
   └─ If ANY check fails → PR blocked
   └─ If all pass → PR ready to merge

                ↓ (Manual)

Step 3: Code Review & Approval
├─ Team reviews code
├─ Approves changes
└─ Merge to main branch

                ↓ (Manual)

Step 4: Developer Triggers Deployment
├─ Go to GitHub Actions tab
├─ Select "Deploy to AWS EC2"
├─ Click "Run workflow" button
└─ Select target branch (main)

                ↓ (Automatic via GitHub Actions)

Step 5: Pre-Deployment Cleanup (EC2)
├─ Remove old .next build
├─ Clean node_modules cache
├─ Free disk space
└─ Verify git repository health

                ↓

Step 6: Code Pull & Build
├─ Fetch latest code from GitHub
├─ Checkout selected branch
├─ Install dependencies (pnpm)
├─ Run Next.js build
└─ Allocate memory as needed

                ↓

Step 7: Application Restart
├─ Stop old PM2 process
├─ Start new application
├─ Verify startup
└─ Update PM2 configuration

                ↓

Step 8: Post-Deployment Verification (Manual)
├─ SSH into EC2
├─ Check PM2 status: pm2 status
├─ View logs: pm2 logs kuamini-prod
└─ Test endpoint: curl http://localhost:3000/api/health

                ↓

Complete ✅
Application is now running with latest code
```

---

## Data Flow During Deployment

```
GitHub
   │
   ├─ Source Code
   │   ├─ package.json (dependencies)
   │   ├─ next.config.mjs (build config)
   │   ├─ app/ (React components)
   │   ├─ lib/ (utilities)
   │   └─ public/ (static assets)
   │
   └─ Secrets (via GitHub Actions)
       ├─ AWS_EC2_HOST_PROD
       ├─ AWS_EC2_SSH_KEY
       └─ (other credentials)
           │
           │ SSH Connection
           ▼
EC2 Instance
   │
   ├─ Clone/Pull Repository
   │   └─ /home/ubuntu/apps/kuamini-prod/
   │
   ├─ Install Dependencies
   │   ├─ node_modules/
   │   ├─ .pnpm-store/
   │   └─ pnpm-lock.yaml
   │
   ├─ Build Application
   │   ├─ TypeScript compilation
   │   ├─ React component bundling
   │   ├─ Code optimization
   │   ├─ Static export
   │   └─ .next/ (build output)
   │
   ├─ Load Environment Variables
   │   └─ .env.production
   │       ├─ DATABASE_URL
   │       ├─ NEXTAUTH_SECRET
   │       └─ etc.
   │
   └─ Start Application (PM2)
       ├─ Process: kuamini-prod
       ├─ Port: 3000
       └─ Status: online
           │
           │ HTTP/HTTPS
           ▼
        Users
        │
        └─ Browser requests to https://your-domain.com
```

---

## Key Components

### 1. GitHub Actions Workflow (`deploy-aws.yml`)
- Runs on: Manual trigger (`workflow_dispatch`)
- Environment: Ubuntu Linux (GitHub's runner)
- Duration: ~15-20 minutes
- Stages:
  - Checkout code
  - SSH to EC2
  - Run deployment script on EC2
  - Report status

### 2. EC2 Instance
- OS: Ubuntu 22.04 LTS
- Runtime: Node.js v20+
- Package Manager: pnpm v10
- Process Manager: PM2
- Storage: 30GB+
- Memory: 4GB+ (2GB swap recommended)

### 3. Application Runtime (Next.js)
- Framework: Next.js 14+
- Language: TypeScript + React
- Build Output: .next/ directory
- Process: Runs as `kuamini-prod` PM2 app
- Port: 3000 (internal)
- Port: 443/80 (external via reverse proxy)

### 4. Database (PostgreSQL)
- Provider: AWS RDS (recommended)
- Version: 15+
- Connection: DATABASE_URL env var
- Backups: Automated (7 days)
- High Availability: Multi-AZ (production)

### 5. Secrets Management
- GitHub Secrets: Store credentials
- Environment Variables: Consumed by app
- .env.production: On EC2 (not in git)
- Rotation: Manual (update GitHub secret + redeploy)

---

## Network Security

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet                                 │
│  (HTTPS requests from users)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ (Port 443/80)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              AWS Security Group (Ingress)                   │
│  Rule 1: Allow HTTPS (443) from 0.0.0.0/0                   │
│  Rule 2: Allow HTTP (80) from 0.0.0.0/0                     │
│  Rule 3: Allow SSH (22) from GitHub Actions IPs             │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   EC2 Instance                              │
│  ├─ nginx (reverse proxy)                                   │
│  │  └─ Listens on 443 (SSL/TLS)                             │
│  │  └─ Forwards to localhost:3000                           │
│  │                                                          │
│  └─ Node.js (Next.js app)                                   │
│     └─ Listens on 3000 (localhost only)                     │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              RDS Security Group (Ingress)                   │
│  Rule: Allow PostgreSQL (5432) from EC2 only                │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                        │
│  (AWS RDS)                                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Deployment Comparison: Manual vs Auto

```
╔═══════════════════════════════════════════════════════════╗
║            MANUAL (Your Current Setup) ✓                  ║
╠═══════════════════════════════════════════════════════════╣
║ Trigger    │ Manual button click in GitHub UI              ║
║ Frequency  │ On-demand (developer decides)                 ║
║ Timing     │ Scheduled maintenance window                  ║
║ Safety     │ ⭐⭐⭐⭐⭐ (highest)                              ║
║ QA Gate    │ ✓ Required before merge                       ║
║ Rollback   │ Manual, controlled                            ║
║ Team Sign- │ ✓ Implicit (via code review)                  ║
║ off        │                                              ║
║ Production │ ✓ Recommended                                 ║
║ Ready      │                                              ║
╚═══════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════╗
║          AUTO-DEPLOY (Not Recommended)                     ║
╠═══════════════════════════════════════════════════════════╣
║ Trigger    │ Automatic on main branch push                 ║
║ Frequency  │ Every merge to main                           ║
║ Timing     │ Immediate (no control)                        ║
║ Safety     │ ⭐⭐ (risky)                                    ║
║ QA Gate    │ ✓ Still required                              ║
║ Rollback   │ Automatic (if configured)                     ║
║ Team Sign- │ ✗ No explicit approval                        ║
║ off        │                                              ║
║ Production │ ✗ Not recommended                             ║
║ Ready      │                                              ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Summary

Your deployment architecture:
- ✅ Uses manual triggering (no auto-deploy)
- ✅ Requires code review before deployment
- ✅ Includes automated quality gates
- ✅ Supports one-click deployment when ready
- ✅ Allows monitoring before going live
- ✅ Follows AWS best practices

This is the **recommended approach for production systems**.

