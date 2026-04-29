# AWS Cloud Migration Runbook

This runbook defines the AWS production deployment path for the application.

## Scope

- Production URL: `https://www.kuaminisystems.com`
- Existing domain provider: Hostinger
- Deployment target: AWS Free Tier
- App stack: Next.js + Node.js + PostgreSQL

---

## Quick Start — New Production-Only Workflow

**No QA infrastructure required.** Direct testing on production.

### For developers:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes + commit
3. Push: `git push origin feature/your-feature`
4. Create PR into `main` on GitHub
5. Wait for validation (lint, tests, type-check)
6. Merge to `main`
7. **Automatic deployment to production** via GitHub Actions
8. Test at `https://www.kuaminisystems.com`

### CI/CD Pipeline

```
feature/New_Testing
       ↓ (create PR to main)
[Validation: lint + type-check + tests]
       ↓ (if passes, merge)
main branch
       ↓ (push to main)
GitHub Actions
   ↓ (`deploy-aws.yml` — GitHub Actions workflow)
SSH to production EC2
  → git pull main
  → pnpm install --frozen-lockfile
  → pnpm run build
  → pm2 restart kuamini-production
       ↓
Production app live at https://www.kuaminisystems.com
```

### Important notes

- **No QA branch protection:** any feature branch can merge directly to `main`
- **Production is testing environment:** verify thoroughly before merging
- **Manual testing required:** before/after each production deployment
- **Rollback plan:** keep stable branch checkpoints in case of issues

---

## Architecture (Budget-Optimized)

- **EC2 `t2.micro`** hosting Production app
   - PM2 process: `kuamini-production` (port 3000)
   - Nginx reverse proxy
- **RDS PostgreSQL `db.t3.micro`**
   - DB: `kuamini_prod`
   - Multi-AZ: disabled (saves cost)
   - Automated backups: 7 days

---

## Deployment Flow

### GitHub Workflow

Simplified workflow (no QA):

- Push to `main` → validate → deploy to production
- Hostinger DNS A records
- Let’s Encrypt SSL via Certbot

---

## 1A) AWS Account Baseline and Guardrails

### Objective
Set up secure account baseline before creating compute/database resources.

### Steps

1. **Enable MFA on root account**
   - AWS Console → IAM → Security credentials
   - Enable MFA for root user

2. **Create an admin IAM user (do not use root daily)**
   - IAM → Users → Create user
   - Name: `kuamini-admin`
   - Permissions: `AdministratorAccess` (initially; reduce later)
   - Enable console + programmatic access

3. **Create AWS budget and billing alarm (Required)**
   - AWS Billing → Budgets → Create budget
   - Type: Cost budget
   - Monthly amount: set low initially (e.g., `$10`)
   - Alert thresholds: 50%, 80%, 100%
   - Email notifications to owner/team

4. **CloudTrail setup (Budget-aware)**
   - **Required now (free):** use CloudTrail **Event History** only (90 days management events, no S3 bucket needed)
   - **Recommended later (paid):** create a multi-region trail writing to S3 when compliance/audit retention is required
   - Note: S3-backed trail increases cost (S3 storage + requests)

5. **Create a dedicated IAM user for GitHub Actions**
   - Name: `github-actions-deploy`
   - Programmatic access only
   - Policy (start minimal): EC2/SSM/ECR permissions as needed

6. **Secret storage (Budget-aware)**
   - **Required now:** keep secrets only in server-side `.env.production` with strict file permissions
   - **Recommended later:** move to AWS SSM Parameter Store (Standard)
   - **Optional (paid):** AWS Secrets Manager for managed rotation

### Validation checklist
- [ ] MFA enabled for root
- [ ] Daily login done with IAM user
- [ ] Budget alerts configured and tested
- [ ] CloudTrail Event History verified
- [ ] Deploy IAM user created

---

## 1B) Network and Security Groups

### Objective
Create controlled inbound/outbound rules for Production, QA, and DB.

### Steps

1. **Use default VPC initially (free-tier friendly)**
   - Can migrate to custom VPC later.

2. **Create Security Groups**

- `kuamini-prod-sg`
  - Inbound:
    - TCP 22 from your office/home IP only
    - TCP 80 from `0.0.0.0/0`
    - TCP 443 from `0.0.0.0/0`
  - Outbound: allow all

- `kuamini-qa-sg`
  - Same as prod

- `kuamini-rds-sg`
  - Inbound:
    - TCP 5432 from `kuamini-prod-sg`
    - TCP 5432 from `kuamini-qa-sg`
    - Optional temporary TCP 5432 from your IP for migration
  - Outbound: allow all

### Validation checklist
- [ ] EC2 SGs created
- [ ] RDS SG only allows app SGs (and temporary local IP)

---

## 1C) Compute Setup: EC2 Production + QA

### Objective
Provision and harden compute with Free Tier usage in mind.

### Steps

1. **Launch EC2 in budget-first mode (Required)**
   - EC2 → Launch instance
   - Name: `kuamini-app`
   - AMI: Ubuntu Server 22.04 LTS
   - Type: `t2.micro`
   - Key pair: create `kuamini-keypair`
   - Security group: `kuamini-prod-sg`
   - Storage: 20 GB gp3

2. **Launch separate QA EC2 (Optional, may add cost)**
   - Use only if strict environment isolation is needed.
   - Running both prod+qa 24/7 on two instances can exceed EC2 free-tier hours.

3. **Allocate and attach Elastic IPs**
   - EC2 → Elastic IPs → Allocate
   - Budget mode: associate one IP to `kuamini-app`
   - Optional dual-instance mode: one for prod, one for QA

4. **SSH and patch OS (on both servers)**

```bash
chmod 400 kuamini-keypair.pem
ssh -i kuamini-keypair.pem ubuntu@<EC2_IP>
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone UTC
```

5. **Install runtime dependencies (on both)**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm i -g pnpm pm2
sudo apt install -y certbot python3-certbot-nginx
```

6. **Basic hardening (recommended)**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### Validation checklist
- [ ] EC2 reachable by SSH
- [ ] Node/Nginx/PM2 installed
- [ ] Elastic IP fixed

---

## 1D) Database Setup: RDS PostgreSQL

### Objective
Create AWS-managed PostgreSQL for app persistence.

### Steps

1. **Create Production RDS**
   - RDS → Create database
   - Engine: PostgreSQL
   - Template: Free tier
   - DB class: `db.t3.micro`
   - Identifier: `kuamini-prod-db`
   - DB name: `kuamini_prod`
   - SG: `kuamini-rds-sg`
   - Public access: Yes (initial migration phase only)

2. **Create QA DB strategy**
   - Preferred: second DB instance `kuamini-qa-db` (cost may exceed free limits)
   - Free-tier practical: same RDS, create second database `kuamini_qa`

3. **Set backups and maintenance**
   - Automated backups: 7 days
   - Deletion protection: enabled for prod

4. **Create QA database (if shared RDS)**

```sql
CREATE DATABASE kuamini_qa;
```

### Validation checklist
- [ ] RDS endpoint available
- [ ] Connectivity from EC2 succeeds
- [ ] `kuamini_prod` and `kuamini_qa` created

---

## 2A) Source and Build Strategy

### Objective
Prepare app for EC2 deployments from GitHub.

### Branch mapping
- `main` → Production
- `qa` → QA
- `feature/*` → PR to `qa`

### Build commands

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm start
```

---

## 2B) Deploy App on Production EC2

### Steps

1. Clone repo

```bash
cd ~
git clone https://github.com/vikneeswaran/threat-protection-agent.git
cd threat-protection-agent
```

2. Create production env file

```bash
cp .env.example .env.production
nano .env.production
```

3. Set production env values

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://www.kuaminisystems.com/api/agent
DATABASE_URL=postgresql://<user>:<password>@<rds-endpoint>:5432/kuamini_prod
INSTALLER_TOKEN_SECRET=<strong-secret>
SESSION_SECRET=<strong-session-secret>
```

4. Install, build, start

```bash
pnpm install --frozen-lockfile
pnpm run build
pm2 start "pnpm start" --name kuamini-prod
pm2 save
pm2 startup
```

---

## 2C) Deploy App on QA EC2

> Budget-first note: if using a single EC2, deploy QA in the same server and run on port `3001` with PM2 name `kuamini-qa`.

### Steps

1. Clone repo and checkout `qa`

```bash
cd ~
git clone https://github.com/vikneeswaran/threat-protection-agent.git
cd threat-protection-agent
git checkout qa
```

2. Create QA env file

```bash
cp .env.example .env.production
nano .env.production
```

3. Set QA env values

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://qa.kuaminisystems.com/api/agent
DATABASE_URL=postgresql://<user>:<password>@<rds-endpoint>:5432/kuamini_qa
INSTALLER_TOKEN_SECRET=<qa-secret>
SESSION_SECRET=<qa-session-secret>
```

4. Install, build, start

```bash
pnpm install --frozen-lockfile
pnpm run build
pm2 start "pnpm start" --name kuamini-qa
pm2 save
pm2 startup
```

---

## 2D) Configure Nginx Reverse Proxy

### Production Nginx file

Create `/etc/nginx/sites-available/kuamini-prod`:

```nginx
server {
    listen 80;
    server_name kuaminisystems.com www.kuaminisystems.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/kuamini-prod /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### QA Nginx file

Create `/etc/nginx/sites-available/kuamini-qa` with `server_name qa.kuaminisystems.com;` and same proxy config.

### Single-EC2 budget mode Nginx example

Use one server block file and route by host:

```nginx
server {
   listen 80;
   server_name kuaminisystems.com www.kuaminisystems.com;
   location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
   }
}

server {
   listen 80;
   server_name qa.kuaminisystems.com;
   location / {
      proxy_pass http://127.0.0.1:3001;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
   }
}
```

---

## 3A) Hostinger DNS Configuration

### Objective
Route production and QA subdomain to AWS EC2.

### Required records

- `A` record: host `@` → `<PROD_ELASTIC_IP>`
- `A` record: host `www` → `<PROD_ELASTIC_IP>`
- `A` record: host `qa` → `<QA_ELASTIC_IP>`

TTL: 300 seconds.

### Validation

```bash
nslookup kuaminisystems.com
nslookup www.kuaminisystems.com
nslookup qa.kuaminisystems.com
```

---

## 3B) SSL Certificates with Certbot

### Production

```bash
sudo certbot --nginx -d kuaminisystems.com -d www.kuaminisystems.com
```

### QA

```bash
sudo certbot --nginx -d qa.kuaminisystems.com
```

### Verify renewal

```bash
sudo certbot renew --dry-run
```

---

## 4A) GitHub Actions Deployment Setup

### Objective
Auto-deploy `qa` and `main` branches to respective EC2 servers.

### Required GitHub repository secrets

- `EC2_HOST_PROD`
- `EC2_HOST_QA`
- `EC2_USER` (`ubuntu`)
- `EC2_SSH_PRIVATE_KEY` (content of `.pem` key)

### Deployment logic

- Push to `qa`:
  - SSH to QA EC2
  - pull `qa`
  - install/build/restart PM2 `kuamini-qa`
- Push to `main`:
  - SSH to PROD EC2
  - pull `main`
  - install/build/restart PM2 `kuamini-prod`

---

## 4B) GitHub Branch Governance (Production-only)

- `feature/*` → PR into `main`
- `main` requires:
  - `validate` (lint, type-check, tests)
  - No QA gate (direct to production)

---

## 5A) Database Initialization — Where to Run SQL Files (Choose one path)

---

### OPTION 1: Run from Local Machine (Recommended for initial setup)

**Requirements:**
- PostgreSQL client installed on your local machine
- AWS RDS security group allows inbound from your IP on port 5432

**Step 1: Verify PostgreSQL client on local machine**

On macOS (if not installed):
```bash
brew install postgresql
```

On Linux:
```bash
sudo apt-get install postgresql-client
```

**Step 2: Test RDS connectivity from local**

Before running scripts, verify you can connect to RDS:

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d postgres \
     -c "SELECT version();"
```

Replace:
- `<rds-endpoint>`: your RDS endpoint (e.g., `kuamini-prod-db.xxxxx.us-east-1.rds.amazonaws.com`)
- `<db-master-username>`: your RDS master username (e.g., `postgres` or `kuamini_admin`)

If successful, you'll see the PostgreSQL version. If connection fails:
- Check RDS security group allows your IP on port 5432
- Verify RDS is publicly accessible (should be enabled in RDS setup)

**Step 3: Clone/navigate to repo locally**

```bash
cd /Users/vikneeswarant/threat-protection-agent/threat-protection-agent
```

The SQL files are located here:
- `scripts/001_create_schema.sql` ← main schema
- `scripts/003_create_triggers.sql`
- `scripts/004_seed_license_tiers.sql`
- `scripts/005_add_agent_id.sql`
- `scripts/006_add_threat_scan_tables.sql`
- `scripts/008_seed_initial_admin.sql` ← creates first admin user

### Path A — Clean Start (Recommended when you do NOT want old users/data)

#### From Local Machine:

1. Initialize schema in `kuamini_prod`:

```bash
cd /Users/vikneeswarant/threat-protection-agent/threat-protection-agent

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/001_create_schema.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/003_create_triggers.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/004_seed_license_tiers.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/005_add_agent_id.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/006_add_threat_scan_tables.sql
```

2. Seed first admin user/account:

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -v admin_email='admin@kuaminisystems.com' \
     -v admin_password='ChangeMe123!' \
     -v admin_full_name='Kuamini Admin' \
     -v org_name='Kuamini Systems' \
     -f scripts/008_seed_initial_admin.sql
```

3. Verify tables created:

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -c "\dt"  # List all tables
```

#### From Production EC2:

If you prefer to run from EC2 instead (requires SSH):

```bash
# SSH into production EC2
ssh -i /path/to/key.pem ubuntu@<PROD_ELASTIC_IP>

# Navigate to app directory
cd ~/threat-protection-agent

# Run same commands but shorter format (RDS endpoint is already in network):
psql -h <rds-endpoint> -U <db-master-username> -d kuamini_prod -f scripts/001_create_schema.sql
psql -h <rds-endpoint> -U <db-master-username> -d kuamini_prod -f scripts/003_create_triggers.sql
psql -h <rds-endpoint> -U <db-master-username> -d kuamini_prod -f scripts/004_seed_license_tiers.sql
psql -h <rds-endpoint> -U <db-master-username> -d kuamini_prod -f scripts/005_add_agent_id.sql
psql -h <rds-endpoint> -U <db-master-username> -d kuamini_prod -f scripts/006_add_threat_scan_tables.sql

# Seed admin
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -v admin_email='admin@kuaminisystems.com' \
     -v admin_password='ChangeMe123!' \
     -v admin_full_name='Kuamini Admin' \
     -v org_name='Kuamini Systems' \
     -f scripts/008_seed_initial_admin.sql

# Exit EC2
exit
```

**4. Repeat for QA database (optional):**

Use same commands but replace `kuamini_prod` with `kuamini_qa` in all psql commands.

---

### OPTION 2: Run from AWS EC2 (Alternative)

**Recommended when:**
- Your local machine cannot connect to RDS (firewall/IP restrictions)
- You're already on EC2 and want to minimize data transfer

**Step 1: SSH into Production EC2**

```bash
ssh -i /path/to/key.pem ubuntu@<PROD_ELASTIC_IP>
```

Replace:
- `/path/to/key.pem` with your actual EC2 key pair path
- `<PROD_ELASTIC_IP>` with your EC2 Elastic IP (e.g., `54.123.45.67`)

**Step 2: Verify PostgreSQL client on EC2**

PostgreSQL client usually comes with Ubuntu. Test:

```bash
psql --version
```

If not installed:
```bash
sudo apt-get update && sudo apt-get install -y postgresql-client
```

**Step 3: Clone repo (if not already done)**

```bash
cd ~
git clone https://github.com/vikneeswaran/threat-protection-agent.git
cd threat-protection-agent
```

**Step 4: Test RDS connectivity from EC2**

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d postgres \
     -c "SELECT version();"
```

**Step 5: Run initialization scripts (Path A — Clean Start)**

```bash
# Initialize schema
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/001_create_schema.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/003_create_triggers.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/004_seed_license_tiers.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/005_add_agent_id.sql

psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -f scripts/006_add_threat_scan_tables.sql
```

**Step 6: Seed first admin user**

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -v admin_email='admin@kuaminisystems.com' \
     -v admin_password='ChangeMe123!' \
     -v admin_full_name='Kuamini Admin' \
     -v org_name='Kuamini Systems' \
     -f scripts/008_seed_initial_admin.sql
```

**Step 7: Verify**

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -c "\dt"  # List all tables
```

**Step 8: Exit EC2**

```bash
exit
```

---

### Important: Replace Placeholders

In all commands above, replace these values:

| Placeholder | Example | Where to find |
|---|---|---|
| `<rds-endpoint>` | `kuamini-prod-db.xxxxx.us-east-1.rds.amazonaws.com` | AWS RDS console → Databases → kuamini-prod-db → Endpoint |
| `<db-master-username>` | `postgres` or `kuamini_admin` | AWS RDS console → Databases → kuamini-prod-db → Configuration tab |
| `<db-master-password>` | (included in psql connection string) | AWS RDS console or saved in your AWS account setup notes |
| `<PROD_ELASTIC_IP>` | `54.123.45.67` | AWS EC2 console → Instances → kuamini-prod → Elastic IP |
| `/path/to/key.pem` | `/Users/vikneeswarant/.ssh/kuamini-prod.pem` | Your local `.ssh` directory |

---

### Validation After Running Scripts

Check that all tables exist:

```bash
psql -h <rds-endpoint> \
     -U <db-master-username> \
     -d kuamini_prod \
     -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

Expected tables:
- `app_users` ← local auth users
- `app_sessions` ← session management
- `accounts` ← organization accounts
- `profiles` ← user profiles
- `license_tiers` ← license definitions
- `agent_configs` ← agent configurations
- `threat_scan_data` ← threat scan results
- Indexes and views created by triggers

---

### Path B — Migrate existing legacy PostgreSQL data

1. Export from the legacy PostgreSQL source

```bash
pg_dump "postgresql://<user>:<pass>@<legacy-host>:5432/postgres" -Fc -f legacy.dump
```

2. Restore to prod DB

```bash
pg_restore -d "postgresql://<user>:<pass>@<rds-endpoint>:5432/kuamini_prod" --no-owner --no-acl legacy.dump
```

3. Copy prod to QA DB (initial seed)

```bash
pg_dump "postgresql://<user>:<pass>@<rds-endpoint>:5432/kuamini_prod" | psql "postgresql://<user>:<pass>@<rds-endpoint>:5432/kuamini_qa"
```

### Validation checks
- [ ] tables exist
- [ ] indexes exist
- [ ] triggers run
- [ ] first admin user can sign in
- [ ] core API flows work

---

## 5A.1) Quick Reference — Copy & Paste Commands

### For Local Machine (macOS/Linux)

**Store these as environment variables first:**

```bash
# Edit these with your actual values
export RDS_ENDPOINT="kuamini-prod-db.xxxxx.us-east-1.rds.amazonaws.com"
export RDS_USER="postgres"
export RDS_DB="kuamini_prod"
export REPO_PATH="/Users/vikneeswarant/threat-protection-agent/threat-protection-agent"

# Verify connection
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d postgres -c "SELECT version();"
```

**Then run initialization (Path A):**

```bash
# Run all schema scripts
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f "$REPO_PATH/scripts/001_create_schema.sql"
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f "$REPO_PATH/scripts/003_create_triggers.sql"
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f "$REPO_PATH/scripts/004_seed_license_tiers.sql"
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f "$REPO_PATH/scripts/005_add_agent_id.sql"
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f "$REPO_PATH/scripts/006_add_threat_scan_tables.sql"

# Seed first admin
psql -h "$RDS_ENDPOINT" \
     -U "$RDS_USER" \
     -d "$RDS_DB" \
     -v admin_email='admin@kuaminisystems.com' \
     -v admin_password='ChangeMe123!' \
     -v admin_full_name='Kuamini Admin' \
     -v org_name='Kuamini Systems' \
     -f "$REPO_PATH/scripts/008_seed_initial_admin.sql"

# Verify
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -c "\dt"
```

### For AWS EC2

**SSH into EC2 first:**

```bash
ssh -i /path/to/key.pem ubuntu@<PROD_ELASTIC_IP>
```

**On EC2, set environment variables:**

```bash
export RDS_ENDPOINT="kuamini-prod-db.xxxxx.us-east-1.rds.amazonaws.com"
export RDS_USER="postgres"
export RDS_DB="kuamini_prod"

# Then run same scripts
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f ~/threat-protection-agent/scripts/001_create_schema.sql
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f ~/threat-protection-agent/scripts/003_create_triggers.sql
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f ~/threat-protection-agent/scripts/004_seed_license_tiers.sql
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f ~/threat-protection-agent/scripts/005_add_agent_id.sql
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -f ~/threat-protection-agent/scripts/006_add_threat_scan_tables.sql

# Seed admin
psql -h "$RDS_ENDPOINT" \
     -U "$RDS_USER" \
     -d "$RDS_DB" \
     -v admin_email='admin@kuaminisystems.com' \
     -v admin_password='ChangeMe123!' \
     -v admin_full_name='Kuamini Admin' \
     -v org_name='Kuamini Systems' \
     -f ~/threat-protection-agent/scripts/008_seed_initial_admin.sql

# Verify and exit
psql -h "$RDS_ENDPOINT" -U "$RDS_USER" -d "$RDS_DB" -c "\dt"
exit
```

---

## 5A.2) Troubleshooting SQL Execution

### Issue: "psql: FATAL: Ident authentication failed"

**Cause:** PostgreSQL is expecting OS-level user authentication.

**Solution:** Use TCP connection with `-h` (hostname):

```bash
# ❌ WRONG (local socket, tries OS auth):
psql -U postgres -d kuamini_prod -f script.sql

# ✅ CORRECT (TCP, uses password):
psql -h <rds-endpoint> -U postgres -d kuamini_prod -f script.sql
```

### Issue: "psql: could not translate host name to address"

**Cause:** RDS endpoint typo or DNS not resolving.

**Solution:** 
1. Verify RDS endpoint in AWS console
2. Test with `nslookup`:
   ```bash
   nslookup kuamini-prod-db.xxxxx.us-east-1.rds.amazonaws.com
   ```

### Issue: "FATAL: no pg_hba.conf entry for host..."

**Cause:** RDS security group blocks connection or "Public Accessibility" is disabled.

**Solution:**
1. Go to AWS RDS console → Databases → kuamini-prod-db
2. Click "Modify"
3. Scroll to "Public accessibility" → Select "Yes"
4. Click "Apply immediately"
5. Check security group allows port 5432 from your IP

### Issue: "ERROR: database 'kuamini_prod' does not exist"

**Cause:** Database hasn't been created yet in RDS.

**Solution:** Create it manually first:

```bash
psql -h <rds-endpoint> -U postgres -d postgres -c "CREATE DATABASE kuamini_prod;"
```

### Issue: psql prompts for password repeatedly

**Cause:** Credentials incorrect or `.pgpass` file not set up.

**Solution (Option A):** Include password in connection string:

```bash
PGPASSWORD="<your-password>" psql -h <rds-endpoint> -U postgres -d kuamini_prod -f script.sql
```

**Solution (Option B):** Create `.pgpass` file (for repeated use):

```bash
# On macOS/Linux
echo "<rds-endpoint>:5432:*:<rds-user>:<rds-password>" >> ~/.pgpass
chmod 600 ~/.pgpass

# Then use psql without password prompts
psql -h <rds-endpoint> -U <rds-user> -d kuamini_prod -f script.sql
```

---

## 5B) App Configuration Updates Required

Update all environment-specific URLs in app config and agent config generation logic:

- Production base URL should resolve to `https://www.kuaminisystems.com`
- QA base URL should resolve to `https://qa.kuaminisystems.com`

Do not hardcode one environment for all builds.

---

## 6A) QA Validation Checklist

After deploying `qa`, validate these URLs:

- `https://qa.kuaminisystems.com/securityAgent/auth/login`
- `https://qa.kuaminisystems.com/securityAgent/dashboard`
- `https://qa.kuaminisystems.com/securityAgent/endpoints`

### Functional checks
- [ ] login/logout
- [ ] endpoint registration
- [ ] heartbeat updates
- [ ] threat ingestion
- [ ] endpoint deletion/deregister
- [ ] installer download endpoints

### Technical checks
- [ ] `/api/health` returns success
- [ ] app logs healthy in PM2
- [ ] nginx logs clean
- [ ] DB connections stable

---

## 6B) Production Cutover Checklist

- [ ] Production EC2 healthy
- [ ] Production SSL issued
- [ ] DNS switched to production Elastic IP
- [ ] Smoke tests passed
- [ ] Rollback ready

---

## 7A) Rollback Strategy

### App rollback

On EC2:

```bash
cd ~/threat-protection-agent
git log --oneline -n 10
git checkout <previous-stable-sha>
pm2 restart kuamini-prod
```

### DB rollback

- Restore from latest RDS snapshot to a new instance
- Repoint `DATABASE_URL` and restart app

### DNS emergency rollback

- Point Hostinger `A` record back to old infrastructure IP (if preserved)

---

## 7B) Monitoring (Free-tier friendly)

- PM2 process monitoring:

```bash
pm2 status
pm2 logs kuamini-prod
pm2 logs kuamini-qa
```

- Nginx logs:

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

- CloudWatch basic EC2 metrics
  - CPUUtilization
  - StatusCheckFailed

---

## 8) Cost Notes for Free Tier

- EC2 `t2.micro`: free within **750 total hrs/month** (first 12 months)
- RDS `db.t3.micro`: free within 750 hrs/month (first 12 months)
- Avoid paid services initially:
  - Application Load Balancer
  - Route 53 hosted zone (if Hostinger DNS already used)
   - Secrets Manager (unless required)
   - CloudTrail S3-backed trail (Event History is enough initially)

### Critical free-tier warning

- Two EC2 instances running full-time can exceed free-tier compute hours.
- For strict budget, use **single EC2** for both prod+qa or stop QA instance when not in use.

If monthly costs rise, first optimize by:
1. keeping QA instance stopped when not testing,
2. reducing storage snapshots,
3. checking data transfer and logs retention.

---

## 9) Operational Process Going Forward

1. Develop on `feature/*`
2. Raise PR to `qa`
3. Validate on `qa.kuaminisystems.com`
4. Promote `qa` → `main`
5. Deploy to production EC2
6. Run benchmark and smoke tests

---

## Change Log

- `2026-04-08`: Initial AWS migration runbook created.

