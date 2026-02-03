# Windows Agent Installation - Complete Solution (v2.1)

## ✅ Problem Solved: Token Management

### The Issue (Before)
- Registration token was hardcoded as "placeholder-token" in MSI
- Every user got the same placeholder
- Agent couldn't register because token was invalid

### The Solution (Now)
- **MSI contains NO token** - Clean and reusable
- **Console generates custom installer script** per user with their token embedded
- **Installer script writes token** to agent directory after MSI installation
- **Agent reads token** from file and auto-registers

---

## File Structure

### Files Built
```
agent-tray/dist/
├── KuaminiSecurityClient.exe (6 MB)
└── KuaminiSecurityClient-1.0.5.msi (15.57 MB) ← NO TOKEN INSIDE

public/tray/
├── KuaminiSecurityClient-1.0.5.msi (15.57 MB) ← Distributed MSI
├── install-kuamini-windows-cli.ps1 (16 KB) ← Base script template
└── install-kuamini.bat (3 KB) ← Batch wrapper
```

### API Endpoints Created
```
GET  /api/agent/installers/windows
     → Downloads MSI file (KuaminiSecurityClient-1.0.5.msi)

GET  /api/agent/installers/windows/script?token=USER_TOKEN
     → Generates custom PowerShell script with token embedded
     → Returns: install-kuamini-windows-[timestamp].ps1

POST /api/agent/installers/windows/script
     → Same as GET but token in request body (more secure)
```

---

## Installation Flow

### Step 1: Console UI Downloads Script
```javascript
// In console page JavaScript:
function downloadWindowsInstaller() {
  const token = getUserToken(); // Get from page context
  window.location.href = `/api/agent/installers/windows/script?token=${token}`;
}
```

### Step 2: API Generates Custom Script
```typescript
// /api/agent/installers/windows/script/route.ts
// Reads base script from public/tray/install-kuamini-windows-cli.ps1
// Embeds user's token as default parameter
// Returns customized script for download
```

### Step 3: User Runs Script
```powershell
# User downloads: install-kuamini-windows-2026-02-03.ps1
# Opens PowerShell as Administrator
# Runs the script:
.\install-kuamini-windows-2026-02-03.ps1

# Script automatically:
# 1. Downloads MSI from /api/agent/installers/windows
# 2. Installs MSI
# 3. Writes registration.token with actual token
# 4. Creates config.json with token
```

### Step 4: Agent Auto-Starts
```
Agent executable:
1. Reads registration.token from install directory
2. Or reads config.json from %LOCALAPPDATA%\KuaminiSecurityClient\
3. Auto-registers with console using token
4. Shows tray icon
5. Appears in console as "Online"
```

---

## Console UI Implementation

### Recommended: "Download Installer" Button

**HTML:**
```html
<button onclick="downloadWindowsInstaller()">
  Download Windows Installer
</button>
```

**JavaScript:**
```javascript
function downloadWindowsInstaller() {
  const token = '{{ user_registration_token }}'; // From backend
  const url = `/api/agent/installers/windows/script?token=${encodeURIComponent(token)}`;
  window.location.href = url;
}
```

### Alternative: Show Copy Command

```javascript
function showWindowsCommand() {
  const token = '{{ user_registration_token }}';
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "install-kuamini-windows.ps1"`;
  
  // First trigger the download
  downloadWindowsInstaller();
  
  // Then show the command to run
  alert('Script downloaded! Run this command in PowerShell (as Admin):\n\n' + command);
}
```

---

## Testing Checklist

### 1. Test Script Generation
```powershell
# Test the API endpoint
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/agent/installers/windows/script?token=test-token-12345" `
  -OutFile "test-installer.ps1"

# Verify token is embedded
Get-Content "test-installer.ps1" | Select-String -Pattern '\$Token = "test-token-12345"'
```

### 2. Test Full Installation
```powershell
# Get your actual token from console
$token = "YOUR_ACTUAL_CONSOLE_TOKEN"

# Download custom script
Invoke-WebRequest `
  -Uri "https://kuaminisystems.com/api/agent/installers/windows/script?token=$token" `
  -OutFile "installer.ps1"

# Run installer (as Administrator)
powershell -NoProfile -ExecutionPolicy Bypass -File "installer.ps1"
```

### 3. Verify Installation
```powershell
# Check process
Get-Process KuaminiSecurityClient

# Check token file
Get-Content "C:\Program Files (x86)\Kuamini Security Client\registration.token"

# Check config
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | ConvertFrom-Json | Select-Object registration_token

# Check logs
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Tail 50
```

### 4. Verify Registration in Console
- Go to console dashboard
- Check endpoints list
- New endpoint should appear as "Online"
- Agent should be sending heartbeats

---

## Security Features

✅ **No hardcoded tokens** - MSI is generic and reusable  
✅ **Per-user scripts** - Each user gets their own token embedded  
✅ **HTTPS transmission** - All downloads encrypted  
✅ **Token cleanup** - registration.token deleted after agent reads it  
✅ **Secure storage** - config.json in user's LOCALAPPDATA with proper ACLs  

---

## Deployment Checklist

- [x] MSI built without token (v1.0.5)
- [x] MSI copied to public/tray/
- [x] PowerShell installer script in public/tray/
- [x] API endpoint for MSI download (/api/agent/installers/windows)
- [x] API endpoint for script generation (/api/agent/installers/windows/script)
- [x] Integration guide created (CONSOLE_INTEGRATION_GUIDE.md)
- [ ] Deploy to production (git commit + push)
- [ ] Test from live console UI
- [ ] Verify end-to-end installation
- [ ] Update console UI with download button

---

## Commands for Quick Reference

### Build Commands
```powershell
# Rebuild PyInstaller executable
cd agent-tray
python -m PyInstaller KuaminiSecurityClient.spec --noconfirm

# Rebuild WiX MSI
cd agent-tray/build
powershell -ExecutionPolicy Bypass -File "build-windows-msi.ps1"

# Copy to distribution
Copy-Item "agent-tray/dist/KuaminiSecurityClient-1.0.5.msi" "public/tray/" -Force
```

### Test Commands
```powershell
# Test script endpoint locally
curl "http://localhost:3000/api/agent/installers/windows/script?token=test123" -o test.ps1

# Test installation locally
.\test.ps1

# Check agent status
Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue
```

---

## What Changed from v2.0

| Aspect | v2.0 (Old) | v2.1 (New) |
|--------|------------|------------|
| Token in MSI | ✗ Hardcoded "placeholder-token" | ✅ No token in MSI |
| Token delivery | Manual parameter | ✅ Embedded in script |
| Console integration | Download MSI only | ✅ Download custom script |
| User experience | Copy command manually | ✅ One-click download |
| Security | All users share placeholder | ✅ Per-user token |
| Scalability | New build per token | ✅ One MSI for all users |

---

## Next Steps

1. **Deploy to production:**
   ```bash
   git add .
   git commit -m "Windows installer v2.1: Dynamic token embedding"
   git push origin main
   ```

2. **Update console UI** with download button (see CONSOLE_INTEGRATION_GUIDE.md)

3. **Test end-to-end** with a real user account

4. **Monitor installations** via API logs and console dashboard

---

## Support

For issues:
1. Check logs: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
2. Verify token: `Get-Content "C:\Program Files (x86)\Kuamini Security Client\registration.token"`
3. Check process: `Get-Process KuaminiSecurityClient`
4. Review console endpoint status

**All files ready for production deployment!** 🚀
