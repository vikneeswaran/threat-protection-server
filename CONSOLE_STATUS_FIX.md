# Console Status & Endpoint Registration - FIXED

## Issues Resolved

### 1. ✅ Heartbeat Endpoint Made Account-ID Optional

**Problem**: Agent was failing with "Missing required fields" error because the heartbeat endpoint required both `agent_id` AND `account_id`, but agents without a registration token had no `account_id`.

**Solution**: Updated `/api/agent/heartbeat` to:
- Accept heartbeat with just `agent_id` 
- Look up `account_id` from the database automatically
- Account_id is now optional in the request payload

**File**: [app/api/agent/heartbeat/route.ts](app/api/agent/heartbeat/route.ts)

```typescript
// Before: Required both agent_id AND account_id
if (!agent_id || !account_id) {
  return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
}

// After: Required only agent_id, looks up account_id from database
if (!agent_id) {
  return NextResponse.json({ error: "Missing required field: agent_id" }, { status: 400 })
}
```

### 2. ✅ Registration Endpoint Supports Token-less Registration

**Problem**: Agent couldn't register without a `registration_token`, blocking auto-registration for new installations.

**Solution**: Updated `/api/agent/register` to:
- Allow registration without a registration token
- Automatically assign agents to the first active account (for single-account/dev deployments)
- Falls back with helpful error if no accounts exist

**File**: [app/api/agent/register/route.ts](app/api/agent/register/route.ts)

```typescript
if (token) {
  // Decode token as before
} else {
  // Auto-registration without token - find default account
  const { data: defaultAccount } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
  
  accountId = defaultAccount.id  // Use first active account
}
```

### 3. ✅ Agent Always Attempts Registration on Startup

**Problem**: Agent only registered if it had a `registration_token`, preventing endpoints from appearing in console.

**Solution**: Updated `agent-tray/main.py` to:
- Always register on startup if `auto_register: true` (regardless of token)
- Works with or without registration token
- Syncs account_id from token if provided

**File**: [agent-tray/main.py](agent-tray/main.py#L305-L310)

```python
# Before: Only registered if token was present
if config.get("auto_register") and config.get("registration_token"):

# After: Always register if auto_register is enabled
if config.get("auto_register"):
```

### 4. ✅ Environment Variable Support for Custom API Endpoints

**Problem**: Installer was hardcoded to use specific production endpoints.

**Solution**: Updated postinstall script to support environment variables:
- `KUAMINI_API_BASE` - Custom API base URL
- `KUAMINI_CONSOLE_URL` - Custom console URL
- Falls back to defaults if not set

**File**: [agent-tray/build/pkgbuild-mac.sh](agent-tray/build/pkgbuild-mac.sh#L43-L44)

```bash
DEFAULT_API_BASE="${KUAMINI_API_BASE:-https://kuaminisystems.com/api/agent}"
DEFAULT_CONSOLE_URL="${KUAMINI_CONSOLE_URL:-https://kuaminisystems.com/securityAgent}"
```

## Verified Functionality

### Local Development Testing

✅ **Registration without token**:
```bash
curl -X POST http://localhost:3000/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "test-machine",
    "os": "macos",
    "os_version": "15.1",
    "agent_version": "1.0.0",
    "agent_id": "test-agent-456"
  }'

Response: {"success":true,"message":"Endpoint registered","endpoint_id":"..."}
```

✅ **Heartbeat with only agent_id**:
```bash
curl -X POST http://localhost:3000/api/agent/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent-456",
    "status": "online"
  }'

Response: {"success":true,"policies":[]}
```

## Deployment Instructions

### For Single-Account Deployments (DEV/SMALL ORGS)

1. **Create at least one account** in the Supabase database:
   ```sql
   INSERT INTO accounts (name, is_active, total_licenses, used_licenses)
   VALUES ('Default Account', true, 100, 0);
   ```

2. **Deploy the updated API** (Next.js backend):
   ```bash
   # Update these files:
   - app/api/agent/register/route.ts
   - app/api/agent/heartbeat/route.ts
   - agent-tray/main.py  
   - agent-tray/build/pkgbuild-mac.sh
   
   # Redeploy to production
   npm run build
   npm start
   # OR
   vercel deploy --prod
   ```

3. **Install agents** (agents will auto-register):
   ```bash
   sudo installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /
   ```

4. **Verify endpoints appear** in console within 2 minutes

### For Multi-Account Deployments (PRODUCTION)

1. **Distribute registration tokens** with each installer (use `/api/agent/installers/download`)

2. **Generate secure registration tokens** that include account_id:
   ```bash
   # Example token format (base64 encoded):
   {"accountId": "uuid-here", "iat": 1234567890}
   ```

3. **Agents use token** to register to correct account automatically

## What Was Wrong in Original System

1. **Chicken-and-egg problem**: Endpoints couldn't be created without an account, but there was no way to create an endpoint for agents that didn't have pre-configured tokens

2. **Registration only with token**: The `/api/agent/register` endpoint required a `registration_token`, but agents installed via PKG might not have one

3. **Heartbeat required account_id**: Even if an endpoint existed, heartbeats failed because agents didn't have `account_id` in their config

4. **No fallback account**: When an agent registered without a token, the system had no way to assign it to an account

## Now Fixed End-to-End Flow

1. **Install agent** (with or without token):
   ```bash
   KUAMINI_API_BASE=http://localhost:3000/api/agent \
   sudo installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /
   ```

2. **Agent starts and loads config**:
   - Reads `~/.kuamini/config.json`
   - Generates unique `agent_id` if needed
   - Configures `api_base` from postinstall (env var or default)

3. **Agent calls `/api/agent/register`** (auto-registration):
   - Sends hostname, os, agent_id
   - NO token required
   - Backend assigns to first active account
   - Endpoint created in database

4. **Agent starts heartbeat loop**:
   - Sends heartbeat every 60 seconds
   - Includes agent_id, status, system_info
   - NO account_id required in payload
   - Backend looks up account_id from database
   - Returns assigned policies

5. **Endpoint appears in console**:
   - Shows as "Online"
   - Can assign policies from UI
   - Last Seen timestamp updates

## Configuration Options

### At Installation Time

Set environment variables before running installer:

```bash
# Custom API server
KUAMINI_API_BASE=http://custom-api.example.com/api/agent \
KUAMINI_CONSOLE_URL=http://custom-console.example.com \
KUAMINI_INSTALL_URL=https://api.example.com/agent/config \
sudo installer -pkg KuaminiSecurityClient-1.0.0.pkg -target /
```

### After Installation

Edit config manually:
```bash
cat ~/.kuamini/config.json
# Edit api_base, console_url as needed
```

## Known Limitations

1. **Single-account auto-assignment**: When agents register without a token in a multi-account deployment, they'll all go to the "first" account. Use registration tokens for proper account assignment.

2. **Production deployment pending**: These changes need to be deployed to the actual `kuaminisystems.com` API server for production use. They're currently only live on localhost dev servers.

3. **Existing broken installs**: Agents installed before these fixes that have `account_id: None` will still fail. They need to be uninstalled and reinstalled.

## Files Modified

1. ✅ `app/api/agent/register/route.ts` - Allow token-less registration
2. ✅ `app/api/agent/heartbeat/route.ts` - Made account_id optional
3. ✅ `agent-tray/main.py` - Always register on startup
4. ✅ `agent-tray/build/pkgbuild-mac.sh` - Support env vars for API endpoints
5. ✅ `agent-tray/KuaminiSecurityClient.spec` - Rebuilt with new agent code
6. ✅ `public/tray/KuaminiSecurityClient-1.0.0.pkg` - Updated installer

## Testing Checklist

- [ ] Deploy updated API to production (kuaminisystems.com)
- [ ] Create at least one active account in production database
- [ ] Install PKG on clean macOS system
- [ ] Wait 2 minutes for auto-registration
- [ ] Check console - endpoint should appear and show "Online"
- [ ] Verify last_seen_at updates every 60 seconds
- [ ] Test policy assignment from console UI
- [ ] Verify agent status shows "Online" (green)
- [ ] Test uninstall - endpoint should be removed from console

## Next Steps

1. **Merge and deploy** these changes to production
2. **Migrate existing accounts** - ensure at least one is marked active
3. **Re-distribute** installers or send re-registration instructions to existing users
4. **Monitor** console for endpoint registrations
5. **Update documentation** with simplified installation instructions

