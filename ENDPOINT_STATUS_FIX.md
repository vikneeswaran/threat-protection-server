# Endpoint Status Fix

## Problem
After uninstalling the agent from an endpoint:
- The system tray icon was removed ✅
- The endpoint remained visible in the console ❌
- The status showed "online" even though `last_seen_at` was 15 hours ago ❌

## Root Cause
The endpoint `status` field in the database was being set to "online" during registration/heartbeat, but was **never updated to "offline" or "disconnected"** when the agent stopped sending heartbeats.

## Solution
Implemented a **computed status** system that dynamically calculates the real endpoint status based on `last_seen_at`:

### Status Rules (lib/endpoint-status.ts)
- **Online**: Last seen within 5 minutes
- **Offline**: Last seen between 5 minutes and 24 hours ago
- **Disconnected**: Last seen more than 24 hours ago (or never)

### Updated Files
1. **lib/endpoint-status.ts** (NEW)
   - `computeEndpointStatus()`: Calculate status from last_seen_at
   - `withComputedStatus()`: Add computed_status to endpoint object
   - `withComputedStatuses()`: Add computed_status to endpoint array

2. **app/securityAgent/(dashboard)/endpoints/page.tsx**
   - Compute status for all endpoints before display
   - Update stats to use computed status

3. **app/securityAgent/(dashboard)/dashboard/page.tsx**
   - Compute status for dashboard statistics
   - Show accurate online/offline/disconnected counts

4. **app/securityAgent/(dashboard)/endpoints/[id]/page.tsx**
   - Add computed status to individual endpoint detail view

5. **components/security-agent/endpoints-list.tsx**
   - Display computed_status instead of stored status
   - Updated type definition to include computed_status

6. **components/security-agent/endpoint-details.tsx**
   - Display computed_status in endpoint details card
   - Fallback to stored status if computed is unavailable

## How It Works

### Before
```
Agent running → Heartbeat → status = "online" → [Database: status = "online"]
Agent stopped → No heartbeat → [Database: status = "online"] ❌ STUCK
```

### After
```
Agent running → Heartbeat → last_seen_at updated → Computed: "online" ✅
5 mins later → No heartbeat → last_seen_at old → Computed: "offline" ✅
24 hrs later → No heartbeat → last_seen_at very old → Computed: "disconnected" ✅
```

## Benefits
1. **Real-time accuracy**: Status reflects actual agent activity
2. **No manual cleanup**: Endpoints auto-mark as offline/disconnected
3. **Consistent UI**: All pages use the same status logic
4. **Backward compatible**: Still uses stored status as fallback

## Testing
After this fix, your uninstalled endpoint should now show:
- Status: **disconnected** (since last_seen_at is 15 hours ago)
- The endpoint will remain in the database for historical records
- You can delete it manually from the UI if desired

## Future Enhancement
Consider adding a scheduled job to:
- Mark endpoints as "offline" after 5 minutes of inactivity
- Mark endpoints as "disconnected" after 24 hours
- Send alerts when critical endpoints go offline
