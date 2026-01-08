# Production Deployment Guide

## Environment Setup

### Required Environment Variables

```bash
# .env.production

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-instance.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_REDIRECT_URL=https://yourdomain.com
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://yourdomain.com

# Installer Security
INSTALLER_TOKEN_SECRET=your-long-random-secret-key
INSTALLER_TOKEN_TTL_SECONDS=604800  # 7 days
INSTALLER_RATE_LIMIT_WINDOW_MS=600000  # 10 minutes
INSTALLER_RATE_LIMIT_MAX=60

# Database
DATABASE_URL=postgresql://...

# Optional: Debug
DEBUG_REGISTRATION=false
NODE_ENV=production
```

### Generating INSTALLER_TOKEN_SECRET

```bash
# Generate a secure random secret
openssl rand -base64 32

# Or use:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] All changes committed and pushed
- [ ] Environment variables configured on production server
- [ ] Supabase database schema migrated
- [ ] Database triggers for license counting verified
- [ ] PKG built and available in `public/tray/`
- [ ] HTTPS certificates valid for production domain
- [ ] Rate limiting values appropriate for expected load
- [ ] Backup of database taken

---

## Deployment Steps

### 1. Build Application
```bash
cd /path/to/threat-protection-agent
pnpm install
pnpm run build
```

### 2. Verify Build
```bash
# Check that public/tray/KuaminiSecurityClient-1.0.0.pkg exists and is recent
ls -lh public/tray/KuaminiSecurityClient-1.0.0.pkg

# Should be ~20MB and recent timestamp
```

### 3. Deploy to Production
```bash
# Using Vercel:
vercel deploy --prod

# Or your chosen deployment platform
# Ensure environment variables are set in production platform settings
```

### 4. Verify Deployment
```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Expected response:
# {"ok":true,"env":{...}}
```

---

## Post-Deployment Verification

### 1. Test Registration Endpoint
```bash
# Get a test registration token
ACCOUNT_ID="your-test-account-id"
TOKEN="your-registration-token"

curl -X POST https://yourdomain.com/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$TOKEN'",
    "hostname": "test-endpoint",
    "os": "macos",
    "os_version": "15.5",
    "agent_version": "1.0.0"
  }'

# Should return 200 with endpoint_id
```

### 2. Test Config Endpoint
```bash
curl "https://yourdomain.com/api/agent/installers/config?accountId=$ACCOUNT_ID&registrationToken=$TOKEN"

# Should return config with:
# - api_base: "https://yourdomain.com"
# - console_url: "https://yourdomain.com/securityAgent"
# - heartbeat_interval: 300
# - auto_register: true
```

### 3. Test Heartbeat Endpoint
```bash
curl -X POST https://yourdomain.com/api/agent/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent-id",
    "account_id": "'$ACCOUNT_ID'",
    "status": "online",
    "system_info": {
      "os": "macos",
      "hostname": "test",
      "ip": "1.2.3.4"
    }
  }'

# Should return 200 with policies
```

### 4. Test Deregister Endpoint
```bash
curl -X POST https://yourdomain.com/api/agent/deregister \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent-id"
  }'

# Should return 200 with success message
```

### 5. Download and Install PKG
```bash
# Download installer
curl -o ~/Downloads/KuaminiSecurityClient-1.0.0.pkg \
  "https://yourdomain.com/api/agent/installers/download?platform=macos&accountId=$ACCOUNT_ID"

# Install
sudo installer -pkg ~/Downloads/KuaminiSecurityClient-1.0.0.pkg -target /

# Verify
ps aux | grep KuaminiSecurityClient | grep -v grep

# Check tray icon appears and shows "Online" status
```

---

## Monitoring in Production

### Key Metrics to Track

1. **Installer Downloads**
   - Log: `/api/agent/installers/download` requests
   - Alert if error rate > 5%

2. **Registration Success Rate**
   - Log: `/api/agent/register` responses
   - Alert if success rate < 95%

3. **Heartbeat Health**
   - Log: `/api/agent/heartbeat` requests
   - Alert if endpoint heartbeat missing > 15 minutes

4. **Deregistration Success**
   - Log: `/api/agent/deregister` responses
   - Alert if any failures

5. **Database Performance**
   - Monitor: endpoints table size
   - Monitor: audit_logs table growth
   - Alert if query times increase

### Example Monitoring Queries

```sql
-- Recent registrations
SELECT COUNT(*) as registrations_24h
FROM endpoints
WHERE registered_at > NOW() - INTERVAL '24 hours';

-- Active endpoints
SELECT COUNT(*) as active_endpoints
FROM endpoints
WHERE status = 'online'
  AND last_seen_at > NOW() - INTERVAL '30 minutes';

-- Failed registrations
SELECT COUNT(*) as failed_registrations_24h
FROM audit_logs
WHERE action = 'endpoint_registered'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND details ->> 'error' IS NOT NULL;
```

---

## Rollback Procedure

If critical issues are found after deployment:

### 1. Immediate Rollback
```bash
# Revert to previous deployment
vercel rollback

# Or redeploy previous version
git checkout previous-tag
pnpm run build
vercel deploy --prod
```

### 2. Disable New Installations
```bash
# Temporarily disable installer by setting a feature flag
# or returning 503 from download endpoint
```

### 3. Notify Support Team
- Alert users not to install/update
- Provide ETA for fix
- Document the issue

### 4. Database Recovery
```sql
-- If needed, restore endpoints from backup
-- Contact database administrator
```

---

## Performance Tuning

### Database Indexing
```sql
-- Ensure indexes exist for common queries
CREATE INDEX IF NOT EXISTS idx_endpoints_agent_id ON endpoints(agent_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_account_id ON endpoints(account_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_status ON endpoints(status);
CREATE INDEX IF NOT EXISTS idx_endpoints_last_seen ON endpoints(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_id ON audit_logs(account_id);
```

### Caching Strategy
```typescript
// Add Redis caching for config endpoint
// Cache config for 1 hour per account
// Invalidate on console changes
```

### Rate Limiting Adjustment
```bash
# Monitor rate limit hits
# Adjust INSTALLER_RATE_LIMIT_MAX based on actual usage

# Default: 60 requests per 10 minutes per IP
# For high-volume: 120 requests per 10 minutes
```

---

## Upgrade Path for Future Versions

When releasing new agent versions:

1. **Build new PKG**
   ```bash
   pnpm run build:agent
   ```

2. **Update version in spec file**
   ```bash
   sed -i 's/1.0.0/1.0.1/' agent-tray/KuaminiSecurityClient.spec
   ```

3. **Rebuild and deploy**
   ```bash
   pnpm run build
   vercel deploy --prod
   ```

4. **Old agents can still uninstall**
   - They read `api_base` from config
   - Deregister endpoint works for any version

---

## Support & Troubleshooting

### Common Issues

**Issue: Installers fail to download**
- Check: `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Check: PKG file exists in `public/tray/`
- Check: Rate limiting not triggered

**Issue: Registration fails with 400**
- Check: Registration token is valid and not expired
- Check: Account ID is correct
- Check: Required fields (hostname, os) provided

**Issue: Heartbeats fail with 404**
- Check: Endpoint was registered successfully
- Check: Agent ID in heartbeat matches registered ID
- Check: Account ID is correct

**Issue: Uninstaller can't deregister**
- Check: Config file still exists with agent_id
- Check: Network connectivity to production API
- Check: Endpoint still exists in database

