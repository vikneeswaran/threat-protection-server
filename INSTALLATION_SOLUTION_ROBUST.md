# Windows Agent Installation - Root Cause Analysis & Robust Solution

## Root Cause Found

After extensive diagnostics, the actual issue was **NOT a bug in the installer or agent**. The problem was:

1. **Config.json creation**: ✅ Works perfectly (verified via multiple tests)
2. **Agent process startup**: ✅ Works perfectly (agent runs and creates logs)
3. **Registration**: ✅ Works when using a **valid token** with correct format
4. **Test with invalid token**: ❌ Registration fails with HTTP 400 "Invalid token"

The installer was being tested with a dummy token `test_token_for_testing` instead of a real, base64-encoded JSON token.

## Token Format Requirements

The agent expects tokens to be **base64-encoded JSON** with the following structure:

```json
{
  "accountId": "c93f4724-3727-4ab1-b83c-a0a942ac920e",
  "accountName": "TestCo",
  "timestamp": 1770208830114
}
```

When base64-encoded: `eyJhY2NvdW50SWQiOiJjOTNmNDcyNC0zNzI3LTRhYjEtYjgzYy1hMGE5NDJhYzkyMGUiLCJhY2NvdW50TmFtZSI6IlRlc3RDbyIsInRpbWVzdGFtcCI6MTc3MDIwODgzMDExNH0=`

## What Actually Happens (End-to-End Flow)

### Step 1: Config Creation ✅
```
Command: Set-Content -Path config.json -Value $jsonConfig -Encoding UTF8
Result: File created successfully with UTF-8 BOM handling
Location: %LOCALAPPDATA%\KuaminiSecurityClient\config.json
```

### Step 2: Agent Startup ✅
```
Process: KuaminiSecurityClient.exe
Memory: 15.32-50MB (depending on tray visibility)
Status: Running as regular user process
```

### Step 3: Auto-Registration ✅
```
Token decoding: Extracts accountId from base64 JSON
Registration endpoint: POST https://kuaminisystems.com/api/agent/register
Success response: HTTP 200 with endpoint_id
```

### Step 4: Heartbeat ✅
```
Interval: 60 seconds
Payload: { agent_id, account_id, status, system_info }
Success response: HTTP 200
```

### Step 5: Systray Display ✅
```
Status: Online (green indicator)
Icon: Shown in Windows notification area
```

## Test Results with Real Token

**Configuration Created:**
- File: `C:\Users\vigne\AppData\Local\KuaminiSecurityClient\config.json`
- Size: 331 bytes
- JSON valid and parseable

**Agent Process:**
- PID: 11248
- Memory: 52.5MB
- Status: RUNNING

**Registration:**
```
2026-02-04 18:13:13,177 [INFO] ✓ Auto-registration successful: 
{'success': True, 'message': 'Endpoint registered', 
'endpoint_id': 'ca50272a-7860-42c1-b607-58df951502fb'}
```

**Heartbeat:**
```
2026-02-04 18:12:05,155 [INFO] ✓ Heartbeat successful (HTTP 200)
```

**Status:**
```
2026-02-04 18:12:05,197 [INFO] Status changed: Online
```

## Why There Was Confusion

Previously, when the installer was tested with invalid tokens, the logs showed:
```
[ERROR] Registration HTTP 400: Invalid token
[WARNING] Failed to decode account_id from token: string argument should contain only ASCII characters
```

This made it appear that **config creation was failing**, but actually:
- Config ✅ WAS created successfully
- Agent ✅ WAS running
- Registration ❌ FAILED due to invalid token (which is the API's job to reject)

The agent correctly tried to re-register on heartbeat 404, which was the expected behavior.

## Robust Solution Going Forward

### For Users: Always Use Valid Tokens
1. Ensure token is base64-encoded JSON
2. Token must contain `accountId` and `timestamp`
3. Token timestamp should be reasonably recent (within last 24 hours)

### For Developers: Add Token Validation

The installer should validate the token format BEFORE attempting registration:

```powershell
function Validate-Token {
    param([string]$Token)
    
    try {
        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Token))
        $json = $decoded | ConvertFrom-Json
        
        # Check required fields
        if (-not $json.accountId) {
            Write-ErrorLog "Invalid token: missing accountId"
            return $false
        }
        
        Write-Log "Token validation: OK (accountId: $($json.accountId))" "SUCCESS"
        return $true
    }
    catch {
        Write-ErrorLog "Token validation failed: $($_.Exception.Message)"
        return $false
    }
}
```

And call it in installer:
```powershell
# After getting token from user
if (-not (Validate-Token -Token $actualToken)) {
    exit 1
}
```

## Diagnostic Scripts Created

Three diagnostic scripts were created to help troubleshoot:

1. **diagnose-config-creation.ps1** - Tests directory creation, file writing, encoding
   - Run when: Config.json fails to create
   - Tests: Directory perms, file locking, disk space, ACLs

2. **test-installer-flow.ps1** - Simulates installer's config creation steps
   - Run when: Testing installer logic in isolation
   - Verifies: JSON creation, file writing, readback parsing

3. **test-agent-startup.ps1** - Tests agent process start and logs
   - Run when: Agent doesn't start or crashes
   - Checks: Process existence, memory usage, log file creation

4. **test-production-install.ps1** - End-to-end installation test with real token
   - Run when: Testing full installation workflow
   - Monitors: Config creation → Agent start → Registration → Heartbeat

## Improvements to Make

### 1. Add Token Validation to Installer
✅ **RECOMMENDED** - Detect invalid tokens before attempting registration

### 2. Improve Error Messages
✅ **RECOMMENDED** - Show clearer messages when registration fails
- Current: "Invalid token" (not specific)
- Better: "Invalid token format. Expected base64-encoded JSON with accountId field"

### 3. Add Diagnostic Mode to Installer
✅ **RECOMMENDED** - Run installer with `-Verbose` flag to show all steps

### 4. Update Documentation
✅ **RECOMMENDED** - Document token format requirements clearly

## Quick Reference: What Works

| Component | Status | Evidence |
|-----------|--------|----------|
| Config.json creation | ✅ Works | File created, valid JSON, readable |
| Agent process startup | ✅ Works | PID 11248, 52.5MB memory, active |
| Token decoding | ✅ Works | Base64 JSON decoded successfully |
| Registration | ✅ Works | HTTP 200, endpoint_id persisted |
| Heartbeat | ✅ Works | HTTP 200, interval: 60s |
| Systray | ✅ Works | Status shown as "Online" |

## What To Do Next

1. **For this account (TestCo):**
   - Agent is RUNNING
   - Endpoint is REGISTERED (endpoint_id: ca50272a-7860-42c1-b607-58df951502fb)
   - Status is ONLINE
   - Check Kuamini console for registration confirmation

2. **For installer improvements:**
   - Add token validation function (see code above)
   - Update error messages to be more specific
   - Add `-Verbose` mode for detailed diagnostics

3. **For future installations:**
   - Always use valid base64-encoded JSON tokens
   - Keep token timestamp recent (within 24 hours)
   - If registration fails, run diagnostic scripts

---

**Conclusion:** The installer and agent work correctly. The issue was test/demo data, not the code. With valid tokens, the entire workflow completes successfully in seconds.
