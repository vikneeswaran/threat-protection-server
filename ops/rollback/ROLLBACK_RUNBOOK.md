# Rollback Runbook (P0)

Use this runbook when production health degrades after release.

## Rollback Triggers

Trigger rollback when any of the following occur for at least 10 minutes:

- API error rate > 5%
- p95 API latency > 2x baseline
- Endpoint heartbeat failures spike > 20%
- Threat processing pipeline is failing or stuck

## Rollback Levels

1. **Application rollback** (frontend/API deployment)
2. **Agent rollout halt** (stop new installer/version rollout)
3. **Database forward-fix** (preferred)
4. **Database snapshot restore** (last resort)

## Immediate Actions

1. Declare incident in team channel.
2. Freeze ongoing production merges.
3. Record affected release version and timestamp.
4. Execute rollback level based on impact.

## Application Rollback Steps

1. Roll back Vercel deployment to previous known stable build.
2. Validate health endpoint and top 3 critical API routes.
3. Re-run baseline benchmark and compare drift.
4. Confirm error rates return to normal.

## Agent Rollout Halt

1. Stop publishing new installer artifacts.
2. Keep previous stable installer as default download.
3. Notify support and operations teams.

## Database Safety Steps

1. Prefer forward-fix SQL if data already changed.
2. If corruption detected, restore latest safe snapshot.
3. Reconcile writes made after snapshot cut.
4. Validate endpoint, threat, and audit consistency.

## Recovery Validation

- [ ] `/api/health` returns success
- [ ] Registration, heartbeat, threat, and deregister flows work
- [ ] Endpoint online/offline status updates normally
- [ ] No major DB errors in logs
- [ ] Incident summary created

## Post-Incident Deliverables

1. Root cause analysis (RCA)
2. Time-to-detect and time-to-restore metrics
3. Preventive changes and owner assignment
