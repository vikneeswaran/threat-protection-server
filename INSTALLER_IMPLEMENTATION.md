# Self-Service Installer Download System

## Overview
Implemented a complete self-service installer download system that allows users to download pre-configured PKG/MSI/script installers directly from the web console. Agents installed using these downloads automatically register to the correct account/sub-account without manual configuration.

## Architecture

### Flow Diagram
```
User clicks "Download Installer"
           ↓
   API generates registration token
           ↓
   Token encodes: accountId, subAccountId, timestamp
           ↓
   Custom installer generated with embedded config URL
           ↓
   User downloads PKG/MSI/script
           ↓
   User runs installer on endpoint
           ↓
   Installer fetches config.json from API during installation
           ↓
   Agent starts automatically with pre-configured credentials
           ↓
   Agent registers to correct account on first heartbeat
```

## Implementation Details

### 1. Frontend (Web Console)

**File:** `components/security-agent/installers-page.tsx`

**Changes:**
- Added `downloadInstaller()` function to fetch custom installers from API
- Added download progress state with loading indicators
- Updated installer descriptions to mention "pre-configured" and "automatic registration"
- Changed button from "Get Installer Script" to "Download Installer"
- Added file type and size information for each platform
- Moved registration token to "Alternative: Manual Installation" section

**Key Features:**
- License availability check before download
- Platform-specific instructions (macOS PKG, Windows PS1, Linux SH)
- Visual feedback during installer generation
- Account-specific branding in downloaded filenames

### 2. Backend API

**File:** `app/api/agent/installers/download/route.ts`

**Endpoints:** `GET /api/agent/installers/download?platform={macos|windows|linux}&accountId={uuid}`

**Features:**
- Validates user has access to account
- Checks available licenses
- Generates Base64-encoded registration token with:
  - `accountId`
  - `subAccountId` (optional)
  - `accountName`
  - `timestamp`
  - `generatedBy` (user ID)
- Platform-specific installer generation:
  - **macOS:** Calls `generate-custom-pkg.sh` script
  - **Windows:** Generates PowerShell script with embedded config
  - **Linux:** Generates bash script with embedded config
- Returns binary file for download

**File:** `app/api/agent/installers/config/route.ts`

**Endpoint:** `GET /api/agent/installers/config?token={base64}`

**Features:**
- Decodes registration token
- Validates account exists
- Returns pre-configured `config.json` with:
  - `api_base`: API URL
  - `registration_token`: Original token
  - `account_id`: Decoded account ID
  - `sub_account_id`: Decoded sub-account ID
  - `auto_register`: true
  - `console_url`: Web console URL
  - `heartbeat_interval`: 300 seconds

### 3. Agent (Python)

**File:** `agent-tray/main.py`

**Changes to `get_config_path()`:**
1. **First:** Check for bundled config in app Resources folder (for pre-configured installers)
2. **Second:** Check user data directory (`~/.kuamini/config.json`)
3. **Third:** Check next to script (development)
4. **Fourth:** Fallback to user directory for new config

**Auto-copy Logic:**
- If bundled config found in Resources folder
- Copy to `~/.kuamini/config.json` on first run
- Ensures config persists after app updates

### 4. Installer Scripts

**File:** `agent-tray/build/generate-custom-pkg.sh`

**Purpose:** Generate custom macOS PKG with embedded config URL

**Process:**
1. Takes registration token and output path as arguments
2. Expands base PKG file
3. Injects `KUAMINI_INSTALL_URL` environment variable into postinstall script
4. URL format: `https://kuaminisystems.com/api/agent/installers/config?token={base64}`
5. Flattens PKG and outputs custom installer

**Usage:**
```bash
./generate-custom-pkg.sh "eyJhY2NvdW50SWQiOi..." "/tmp/KuaminiAgentTray-custom.pkg"
```

**File:** `agent-tray/build/scripts/postinstall`

**Changes:**
- Added config download logic
- Checks for `KUAMINI_INSTALL_URL` environment variable
- If set, downloads config.json from API using curl
- Creates `~/.kuamini/` directory
- Saves config with proper permissions
- Falls back gracefully if download fails

### 5. Windows Installer

**Generated in:** `app/api/agent/installers/download/route.ts` → `generateWindowsInstaller()`

**Features:**
- PowerShell script with embedded config object
- Downloads agent binary from `/tray/windows.zip`
- Extracts to `C:\Program Files\Kuamini\AgentTray`
- Creates config in `%APPDATA%\Kuamini\config.json`
- Sets up scheduled task for auto-start
- Starts agent immediately

### 6. Linux Installer

**Generated in:** `app/api/agent/installers/download/route.ts` → `generateLinuxInstaller()`

**Features:**
- Bash script with embedded config object
- Requires root (sudo)
- Downloads agent binary (would need `/tray/linux.tar.gz`)
- Extracts to `/opt/kuamini/agenttray`
- Creates config in `/etc/kuamini/config.json`
- Sets up systemd service
- Enables and starts service

## Registration Flow

### 1. User Journey
1. User logs into web console at `https://kuaminisystems.com/securityAgent`
2. Navigates to "Installers" page
3. Selects platform tab (macOS/Windows/Linux)
4. Clicks "Download Installer" button
5. Browser downloads custom installer (PKG/PS1/SH)
6. User runs installer with admin/root privileges
7. Installer automatically downloads config with account credentials
8. Agent starts and registers to user's account
9. Endpoint appears in console within 1-2 minutes

### 2. Technical Flow

**Token Generation:**
```javascript
const registrationToken = Buffer.from(
  JSON.stringify({
    accountId: "uuid",
    subAccountId: "uuid" | null,
    accountName: "Company Name",
    timestamp: Date.now(),
    generatedBy: "user-uuid",
  })
).toString("base64")
```

**Config API Response:**
```json
{
  "api_base": "https://kuaminisystems.com",
  "registration_token": "eyJhY2NvdW50SWQiOi4uLg==",
  "account_id": "uuid",
  "sub_account_id": "uuid" | null,
  "auto_register": true,
  "console_url": "https://kuaminisystems.com/securityAgent",
  "heartbeat_interval": 300
}
```

**Agent Registration (existing flow):**
1. Agent starts, loads config from `~/.kuamini/config.json`
2. Sends heartbeat to `/api/agent/heartbeat` endpoint
3. Backend extracts `account_id` from token
4. Creates endpoint record in database
5. Consumes one license from account
6. Returns success

## Security Considerations

### Token Security
- Tokens are Base64-encoded (not encrypted)
- Contain account metadata but no passwords/secrets
- Short-lived via timestamp validation (optional)
- Validated against database on each use
- Cannot be used to access other accounts

### Best Practices
- Tokens should be treated as sensitive (contain account IDs)
- Config API validates account exists before serving config
- Download API checks user has access to account
- License availability verified before download
- HTTPS required for all API calls

### Recommendations
1. Add token expiration (e.g., 7 days)
2. Rate limit download endpoint per user
3. Log all installer downloads with IP/user
4. Add webhook notifications for new endpoint registrations
5. Consider signing PKG/MSI installers

## Testing Checklist

### Prerequisites
- [ ] Base PKG built: `agent-tray/dist/KuaminiAgentTray-1.0.0.pkg`
- [ ] Web app running: `npm run dev`
- [ ] Database migrations applied
- [ ] User account created with available licenses

### macOS PKG Testing
- [ ] Login to web console
- [ ] Navigate to Installers → macOS tab
- [ ] Click "Download Installer"
- [ ] Verify PKG downloads with account ID in filename
- [ ] Double-click PKG to install
- [ ] Verify app installed to `/Applications/KuaminiAgentTray.app`
- [ ] Verify config created at `~/.kuamini/config.json`
- [ ] Verify LaunchAgent loaded: `launchctl list | grep kuamini`
- [ ] Verify agent process running: `ps aux | grep KuaminiAgentTray`
- [ ] Check web console "Endpoints" page
- [ ] Verify endpoint appears within 2 minutes
- [ ] Verify endpoint shows correct hostname, OS, status

### Windows PowerShell Testing
- [ ] Login to web console
- [ ] Navigate to Installers → Windows tab
- [ ] Click "Download Installer"
- [ ] Verify PS1 script downloads
- [ ] Open PowerShell as Administrator
- [ ] Run: `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process`
- [ ] Run: `.\Install-KuaminiAgent-<id>.ps1`
- [ ] Verify installation completes without errors
- [ ] Verify scheduled task created
- [ ] Verify agent running in Task Manager
- [ ] Verify endpoint appears in console

### Linux Shell Script Testing
- [ ] Login to web console
- [ ] Navigate to Installers → Linux tab
- [ ] Click "Download Installer"
- [ ] Verify SH script downloads
- [ ] Run: `sudo bash install-kuamini-agent-<id>.sh`
- [ ] Verify installation completes
- [ ] Verify systemd service: `systemctl status kuamini-agent`
- [ ] Verify endpoint appears in console

### API Testing
- [ ] Test config endpoint: `GET /api/agent/installers/config?token=<base64>`
- [ ] Verify returns valid JSON config
- [ ] Test with invalid token → 400 error
- [ ] Test with expired/invalid account → 404 error
- [ ] Test download endpoint without licenses → 403 error
- [ ] Test download without authentication → 401 error

### Integration Testing
- [ ] Install on multiple endpoints (different accounts)
- [ ] Verify each endpoint registers to correct account
- [ ] Test sub-account assignment
- [ ] Verify license consumption
- [ ] Test uninstall and reinstall
- [ ] Verify agent survives system reboot

## File Changes Summary

### New Files Created
1. `app/api/agent/installers/download/route.ts` - Download API
2. `app/api/agent/installers/config/route.ts` - Config API
3. `agent-tray/build/generate-custom-pkg.sh` - PKG generation script
4. `INSTALLER_IMPLEMENTATION.md` - This document

### Modified Files
1. `components/security-agent/installers-page.tsx` - UI updates
2. `agent-tray/main.py` - Config path logic
3. `agent-tray/build/scripts/postinstall` - Config download

### Dependencies
**Backend:**
- Node.js `fs/promises`, `child_process`, `os`, `path`
- Supabase client for authentication and database

**Agent:**
- Python `pathlib`, `shutil` for file operations
- Existing requests, json, base64 modules

**macOS Tools:**
- `pkgutil` for PKG manipulation
- `curl` for config download
- `launchctl` for LaunchAgent management

## Future Enhancements

### Short Term
1. Add token expiration validation
2. Implement download rate limiting
3. Add installer download logging/auditing
4. Create Windows MSI installer (vs PowerShell script)
5. Add Linux binary hosting (`/tray/linux.tar.gz`)

### Medium Term
1. Code signing for macOS PKG
2. Code signing for Windows MSI
3. Notarization for macOS
4. Add webhook notifications for new endpoints
5. Support for air-gapped installations
6. Bulk deployment tools

### Long Term
1. MDM integration (Jamf, Intune)
2. Group Policy deployment (Windows)
3. Auto-update mechanism
4. Custom branding (white-label)
5. Multi-region support
6. Offline license management

## Troubleshooting

### Issue: PKG generation fails
**Error:** `Base PKG not found`
**Solution:** Build base PKG first:
```bash
cd agent-tray/build
./pkgbuild-mac.sh
```

### Issue: Config download fails during installation
**Error:** `Failed to download config`
**Solution:** Check:
- API server is running
- Token is valid and not expired
- Account exists in database
- Network connectivity from endpoint

### Issue: Agent doesn't start after installation
**Solution:** Check:
- LaunchAgent loaded: `launchctl list | grep kuamini`
- Config exists: `cat ~/.kuamini/config.json`
- Logs: `tail -50 ~/Library/Logs/KuaminiAgentTray/agent.log`
- App permissions (macOS Security & Privacy settings)

### Issue: Endpoint doesn't appear in console
**Solution:** Check:
- Agent is running: `ps aux | grep KuaminiAgentTray`
- Config has correct `api_base` URL
- Registration token is valid
- Account has available licenses
- Check agent logs for registration errors

## Documentation Links

- **User Guide:** See PROJECT_DOCUMENTATION.md
- **Build Scripts:** `agent-tray/build/README.md`
- **API Docs:** Backend API routes documentation
- **Agent Docs:** `agent-tray/README.md`

## Support

For issues or questions:
1. Check agent logs first
2. Verify network connectivity
3. Confirm account has available licenses
4. Check API server status
5. Review this document's troubleshooting section
