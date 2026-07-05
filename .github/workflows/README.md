# GitHub Actions Workflows

## Overview

This project uses 4 GitHub Actions workflows for quality assurance and deployment.

---

## 1. ✅ Deploy to AWS EC2

**File**: `.github/workflows/deploy-aws.yml`

### Trigger
- **Manual only** (`workflow_dispatch`) - ✓ No auto-deployment

### What it does
1. Cleans up disk space on EC2 instance
2. Validates git repository integrity
3. Pulls latest code from selected branch
4. Installs dependencies with pnpm
5. Builds Next.js application
6. Restarts PM2 process
7. Logs deployment status

### How to use
1. Go to **Actions** tab in GitHub
2. Select **"Deploy to AWS EC2"**
3. Click **"Run workflow"**
4. Select branch (default: main)
5. Click **"Run workflow"**

### Required Secrets
- `AWS_EC2_HOST_PROD` - EC2 instance IP/hostname
- `AWS_EC2_USER` - SSH user (usually `ubuntu`)
- `AWS_EC2_SSH_KEY` - Private SSH key
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret
- `NEXTAUTH_URL` - Application URL

---

## 2. Quality and Release Gate

Workflow file: `.github/workflows/quality-and-release-gate.yml`

### Trigger

- Runs on pull requests targeting `main` branch
- Manual run supported via workflow dispatch

### What it does

1. Runs `lint` - Validates code style with eslint
2. Runs `type-check` - Validates TypeScript types
3. Runs `test` - Runs test suite

### Purpose
Ensures code quality before merging to main branch. Enforces production readiness standards.

---

## 3. Benchmark Baseline

Workflow file: `.github/workflows/benchmark-baseline.yml`

### Trigger

- Manual dispatch (supports `base_url` and `runs` inputs)
- Weekly scheduled run (Monday 04:00 UTC)

### What it does

1. Runs API baseline script
2. Evaluates against threshold file in `ops/benchmark/api-baseline-thresholds.json`
3. Uploads benchmark artifacts from `ops/benchmark/reports/`

### Purpose
Tracks API performance over time to detect regressions.

---

## 4. Copilot Cloud Agent

Purpose: Cloud-based AI agent integration.

---

## Deployment Strategy

### Current: Manual-Only Production Deployment
```
Code Review & QA → Merge to main → Manual AWS Deployment Trigger
```

✅ **Advantages**:
- No accidental production deployments
- Controlled rollout with explicit approval
- Time to verify changes before deployment

---

## Auto-Deployment Status

**Current**: ❌ **Disabled** - Deployment is manual (`workflow_dispatch`)

**Why**: Production stability and control. This follows AWS best practices.

**If you want to enable auto-deployment to staging**: Create a separate workflow file that auto-deploys on `main` push to a staging environment.

---

## Setup Instructions

See `AWS_DEPLOYMENT_GUIDE.md` for:
- EC2 instance setup
- GitHub secrets configuration
- Environment variables
- Deployment checklist
- Troubleshooting

