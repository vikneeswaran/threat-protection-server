# Threat Detection System - Deployment Checklist

## P0 Environment Gate (Required Before Production)

- [ ] Run benchmark baseline and ensure threshold result is PASS
- [ ] Verify PR quality gate passed on `qa`
- [ ] Prepare rollback pack from template
- [ ] Validate impacted APIs against DB communication matrix
- [ ] Promote only from `qa` to `main`

Reference documents:

- `ops/environment/P0_ENVIRONMENT_ACTION_PLAN.md`
- `ops/release/QA_PROMOTION_POLICY.md`
- `ops/rollback/ROLLBACK_RUNBOOK.md`
- `ops/db/DB_COMMUNICATION_MATRIX.md`

## Quick Start Deployment

### Phase 1: Database (5 minutes)

1. **Apply Database Migration:**
   - Go to Supabase Dashboard → SQL Editor
   - Run contents of `scripts/006_add_threat_scan_tables.sql`
   - Verify all tables and columns created

   ```bash
   # Or via psql:
   psql -d your_database -f scripts/006_add_threat_scan_tables.sql
   ```

2. **Verify Tables:**
   ```sql
   -- Should return 3 new tables
   SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_name IN ('scan_summaries', 'scan_commands', 'agent_instances');
   
   -- Should show new columns in threats
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'threats' AND column_name IN ('type', 'process_id', 'detection_source');
   ```

### Phase 2: API Deployment (5 minutes)

1. **New Files Created:**
   - `app/api/agent/scan-commands/route.ts` - Remote command management
   - `app/api/agent/scan-commands-result/route.ts` - Command result reporting

2. **Files Modified:**
   - `app/api/agent/threat/route.ts` - Updated threat field handling

3. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "feat: implement threat detection with remote scan commands"
   git push origin main
   # Vercel auto-deploys
   ```

4. **Verify Deployment:**
   ```bash
   # Test scan commands endpoint
   curl https://kuaminisystems.com/api/agent/scan-commands \
     -H "Content-Type: application/json"
   
   # Should return 400 (missing query params) not 404
   ```

### Phase 3: Agent Update (10 minutes)

1. **Code Changes in `agent-tray/main.py`:**
   - New functions added: `check_pending_scan_commands()` and `report_scan_command_result()`
   - Modified: `threat_scan_loop()` - now checks for remote commands
   - Modified: `realtime_monitor_loop()` - enhanced logging
   - Modified: Initial registration - triggers auto-scan
   - Modified: Default `threat_realtime_monitor` = True

2. **Rebuild Agent:**
   ```bash
   # Windows
   cd agent-tray
   pyinstaller KuaminiSecurityClient-win.spec -y
   
   # Or use build script
   .\build\build-windows-msi.ps1
   
   # macOS
   pyinstaller KuaminiSecurityClient-mac.spec -y
   
   # Linux
   pyinstaller KuaminiSecurityClient-linux.spec -y
   ```

3. **Test Agent Locally:**
   ```bash
   cd agent-tray
   python main.py
   ```

   Should see in logs:
   ```
   [INFO] ✓ Threat detection initialized successfully
   [INFO] ✓ Auto-registration successful
   [INFO] 🔍 Triggering initial scan after registration...
   ```

### Phase 4: Testing (15 minutes)

#### Test 1: Post-Registration Scan
```bash
# Step 1: Uninstall/remove agent config
# Step 2: Run agent fresh
python agent-tray/main.py

# Step 3: Check logs for:
[INFO] ✓ Auto-registration successful
[INFO] 🔍 Triggering initial scan after registration...
[INFO] ✓ Initial scan completed: X threats found

# Step 4: Check console:
# - New device appears in endpoint list
# - Initial scan in scan history
# - Any threats in threat list
```

#### Test 2: Remote Scan Command
```bash
# Step 1: Get agent_id and account_id
# From agent config or database

# Step 2: Create scan command
curl -X POST https://kuaminisystems.com/api/agent/scan-commands \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "account_id": "YOUR_ACCOUNT_ID", 
    "scan_type": "full",
    "priority": 5
  }'

# Step 3: Watch agent logs (in next scan cycle, ~30-60 seconds):
[INFO] 🔍 Executing remote scan command: full
[INFO] Reporting scan command result...
[INFO] ✓ Remote scan command completed and reported

# Step 4: Check console - scan should appear
```

#### Test 3: Threat Reporting
```bash
# Option A: Place test malware (safe way)
# 1. Download EICAR test file (harmless malware test)
#    https://www.eicar.org/download-anti-malware-testfile/
# 2. Save to ~/Downloads/
# 3. Trigger quick scan
# 4. Threat should detect and report

# Option B: Wait for real threat
# Scan will detect real malware if present

# Verify in console:
# - Threat appears in threat list
# - Correct severity assigned
# - File path shown
# - Hash visible
```

#### Test 4: Real-Time Monitoring
```bash
# Real-time monitor runs every 5 minutes
# Check agent logs for:
[DEBUG] Running real-time threat monitor
[WARNING] 🔴 Real-time alert: X threats detected

# On critical/high threats:
[ERROR] 🚨 CRITICAL THREATS DETECTED: ...
[INFO] Threat action applied: quarantine (...)
```

### Phase 5: Rollout (Ongoing)

#### Staged Rollout
1. **Internal Test Group** (24 hours)
   - 5-10 test devices
   - Verify logs, scans, reporting

2. **Beta Users** (1 week)
   - 100-500 devices
   - Monitor performance, issues

3. **Full Rollout**
   - All remaining devices
   - Continue monitoring

#### Push New Agent
```bash
# Create new installer with updated code
npm run build:installer

# Or
npm run build:agent:token

# Distribute via:
# - Email update notification
# - Auto-update mechanism (if implemented)
# - Manual system push
```

#### Monitor Rollout
```sql
-- Check deployment progress
SELECT COUNT(*) as total_agents,
       COUNT(CASE WHEN agent_version = 'tray-1.0.1' THEN 1 END) as updated_count,
       ROUND(100.0 * COUNT(CASE WHEN agent_version = 'tray-1.0.1' THEN 1 END) / 
             COUNT(*), 2) as percent_updated
FROM agent_instances;

-- Check scan activity
SELECT scan_type, COUNT(*) as scan_count,
       MIN(created_at) as first_scan,
       MAX(created_at) as last_scan
FROM scan_summaries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY scan_type;

-- Check threat reporting
SELECT DATE(detected_at) as date,
       severity,
       COUNT(*) as count
FROM threats
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(detected_at), severity
ORDER BY date DESC, severity DESC;
```

### Phase 6: Optimization

1. **Monitor Performance:**
   - Scan duration times
   - Agent CPU/memory usage
   - API response times
   - Database query performance

2. **Adjust Settings if Needed:**
   - Increase scan_interval if too frequent
   - Decrease realtime_interval if critical threats missed
   - Adjust threat signatures for false positives

3. **Collect Feedback:**
   - Track false positive reports
   - Scan effectiveness
   - Console usability
   - Auto-action results

## Rollback Plan

If issues occur:

1. **Database:**
   ```sql
   -- No data loss - tables can be dropped safely
   DROP TABLE scan_commands;
   DROP TABLE scan_summaries;
   DROP TABLE agent_instances;
   ```

2. **API:**
   - Redeploy previous version
   - Old agent still works (ignores new endpoints)

3. **Agent:**
   - Distribute previous agent version
   - Or disable threat detection in policy

## Success Criteria

✅ **Phase 1:** All database tables exist with correct columns
✅ **Phase 2:** API endpoints accessible and responding
✅ **Phase 3:** Agent runs without errors
✅ **Phase 4:** All tests pass (scan, reporting, remote commands)
✅ **Phase 5:** Agents updated and reporting threats
✅ **Phase 6:** Production stable with no false positives

## Monitoring Dashboard Queries

Create these views for console dashboard:

```sql
-- Last 24 hours scan summary
SELECT DATE_TRUNC('hour', created_at) as hour,
       scan_type,
       COUNT(*) as scan_count,
       SUM(total_threats) as total_threats
FROM scan_summaries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), scan_type
ORDER BY hour DESC;

-- Top threats detected
SELECT name, type, severity, COUNT(*) as detection_count
FROM threats
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY name, type, severity
ORDER BY detection_count DESC
LIMIT 20;

-- Agent activity
SELECT a.hostname, 
       a.os,
       COUNT(DISTINCT s.id) as scan_count,
       MAX(ai.last_heartbeat) as last_seen,
       SUM(s.total_threats) as total_threats
FROM agent_instances ai
LEFT JOIN endpoints e ON ai.endpoint_id = e.id
LEFT JOIN scan_summaries s ON ai.endpoint_id = s.endpoint_id
GROUP BY a.hostname, a.os
ORDER BY last_seen DESC;
```

## Support Contacts

- **Database Issues:** Check Supabase logs
- **API Issues:** Check Vercel logs
- **Agent Issues:** Check agent.log on endpoint
- **Threats Not Reporting:** Verify endpoint_id in config.json

## Final Checklist

- [ ] Database migration applied
- [ ] New API endpoints deployed
- [ ] Agent code updated and rebuilt
- [ ] Local testing passed
- [ ] Remote scan test passed
- [ ] Threat reporting test passed
- [ ] Real-time monitoring verified
- [ ] Documentation updated
- [ ] Team trained on new features
- [ ] Monitoring setup configured
- [ ] Staged rollout plan ready
- [ ] Rollback plan tested

---

**Estimated Total Time: 1-2 hours** (depending on testing thoroughness)

**Next Review: After 1 week of production use**
