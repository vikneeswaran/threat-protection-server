# Windows Installer Integration Guide for Console UI

## Overview

The Windows agent installation now uses a **two-file system** where:
1. **MSI file** - Contains the agent executable (NO token hardcoded)
2. **PowerShell script** - Dynamically generated with user's token embedded

## How It Works

```
┌─────────────────┐
│  Console Page   │
│  (User logged   │
│   in with token)│
└────────┬────────┘
         │
         │ 1. User clicks "Download Installer"
         │
         ▼
┌─────────────────────────────────────────────────┐
│  API: /api/agent/installers/windows/script      │
│  - Reads base script from public/tray/          │
│  - Embeds user's token as default parameter     │
│  - Returns: install-kuamini-windows-[time].ps1  │
└────────┬────────────────────────────────────────┘
         │
         │ 2. User runs the downloaded script
         │
         ▼
┌─────────────────────────────────────────────────┐
│  PowerShell Installer Script                    │
│  - Has token pre-filled                         │
│  - Downloads MSI from /api/agent/installers/... │
│  - Installs MSI (no token in MSI)               │
│  - Writes registration.token to install dir     │
│  - Creates config.json with token               │
└────────┬────────────────────────────────────────┘
         │
         │ 3. Agent starts automatically
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Agent Executable                                │
│  - Reads registration.token from install dir    │
│  - Or reads config.json from LOCALAPPDATA       │
│  - Auto-registers with console                  │
│  - Shows tray icon                               │
└──────────────────────────────────────────────────┘
```

## Console UI Implementation

### Button: "Download Windows Installer"

**HTML:**
```html
<button 
  onclick="downloadWindowsInstaller()"
  class="..."
>
  <svg>...</svg>
  Download Windows Installer
</button>
```

**JavaScript:**
```javascript
function downloadWindowsInstaller() {
  // Get user's registration token from page context
  const token = window.userToken; // Or however you store it
  
  // Build download URL
  const url = `/api/agent/installers/windows/script?token=${encodeURIComponent(token)}`;
  
  // Trigger download
  window.location.href = url;
}
```

### Alternative: Show Copy Command

If you prefer to show a copy-paste command:

```javascript
function showInstallCommand() {
  const token = window.userToken;
  
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/api/agent/installers/windows/script?token=${token}')"`
  
  // Show in modal or copy to clipboard
  navigator.clipboard.writeText(command);
  alert('Installation command copied to clipboard!');
}
```

## API Endpoints

### 1. GET /api/agent/installers/windows/script

**Purpose:** Generate installer script with token embedded

**Parameters:**
- `token` (required): User's registration token

**Response:**
- Content-Type: `text/plain; charset=utf-8`
- Content-Disposition: `attachment; filename="install-kuamini-windows-[timestamp].ps1"`
- Body: PowerShell script with embedded token

**Example:**
```
GET /api/agent/installers/windows/script?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security Note:** Token is visible in URL. For higher security, use POST endpoint.

### 2. POST /api/agent/installers/windows/script

**Purpose:** Same as GET but token in request body (more secure)

**Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** Same as GET

**Usage in Console:**
```javascript
async function downloadWindowsInstallerSecure() {
  const token = window.userToken;
  
  const response = await fetch('/api/agent/installers/windows/script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `install-kuamini-windows-${Date.now()}.ps1`;
  a.click();
}
```

### 3. GET /api/agent/installers/windows

**Purpose:** Download the MSI file (called by installer script)

**Parameters:**
- `token` (required): For audit logging

**Response:**
- Redirects to: `/tray/KuaminiSecurityClient-1.0.5.msi`

## User Flow

### Option A: Download Script (Recommended)

1. User visits Installers page
2. Clicks "Download Windows Installer" button
3. Browser downloads `install-kuamini-windows-[timestamp].ps1`
4. User opens PowerShell as Administrator
5. User runs: `.\install-kuamini-windows-[timestamp].ps1`
6. Script automatically uses embedded token
7. Installation completes

### Option B: Copy Command

1. User visits Installers page
2. Clicks "Copy Installation Command" button
3. Command copied to clipboard with token embedded
4. User pastes in PowerShell (as Admin) and runs
5. Installation completes

### Option C: Manual (Advanced Users)

1. User manually downloads MSI from /tray/KuaminiSecurityClient-1.0.5.msi
2. User manually downloads script from /tray/install-kuamini-windows-cli.ps1
3. User runs: `.\install-kuamini-windows-cli.ps1 -Token "their-token"`

## Token Security

### Current Flow
- ✅ No token hardcoded in MSI
- ✅ Token embedded in script at download time (per-user)
- ✅ Token written to disk only during installation
- ✅ Token file deleted after agent reads it

### Considerations
- Token visible in download URL (GET method)
- Token visible in downloaded .ps1 file
- Token stored in config.json and registration.token during installation

### Recommendations
1. Use HTTPS for all downloads (already done)
2. Consider using POST endpoint for higher security
3. Token files have restrictive permissions (handled by agent)
4. Consider token expiration policy in backend

## Testing

### Test the Script Endpoint

```powershell
# Test GET endpoint
Invoke-WebRequest -Uri "https://kuaminisystems.com/api/agent/installers/windows/script?token=YOUR_TOKEN" -OutFile "test-installer.ps1"

# Verify token is embedded
Get-Content "test-installer.ps1" | Select-String -Pattern '\$Token = "'
```

### Test Full Installation

```powershell
# Download script with token
$token = "YOUR_ACTUAL_TOKEN"
Invoke-WebRequest -Uri "https://kuaminisystems.com/api/agent/installers/windows/script?token=$token" -OutFile "installer.ps1"

# Run installer (as Admin)
powershell -NoProfile -ExecutionPolicy Bypass -File "installer.ps1"

# Verify installation
Get-Process KuaminiSecurityClient
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | ConvertFrom-Json
```

## Console Page Example

### HTML Structure
```html
<div class="installer-section">
  <h3>Windows Installation</h3>
  
  <div class="installation-steps">
    <div class="step">
      <span class="step-number">1</span>
      <p>Download the installer script with your token embedded</p>
      <button onclick="downloadWindowsInstaller()">
        Download Windows Installer
      </button>
    </div>
    
    <div class="step">
      <span class="step-number">2</span>
      <p>Open PowerShell as Administrator</p>
      <code>Right-click PowerShell → Run as Administrator</code>
    </div>
    
    <div class="step">
      <span class="step-number">3</span>
      <p>Run the downloaded script</p>
      <code>.\install-kuamini-windows-[timestamp].ps1</code>
    </div>
    
    <div class="step">
      <span class="step-number">4</span>
      <p>Wait for installation to complete</p>
      <p class="note">The agent will appear in your system tray</p>
    </div>
  </div>
  
  <!-- Alternative: One-line command -->
  <div class="alternative-method">
    <h4>Or copy this command:</h4>
    <div class="command-box">
      <code id="install-command-windows"></code>
      <button onclick="copyWindowsCommand()">Copy</button>
    </div>
  </div>
</div>

<script>
  // Initialize with user's token
  const userToken = "{{ user_registration_token }}"; // Replace with actual token from backend
  
  function downloadWindowsInstaller() {
    const url = `/api/agent/installers/windows/script?token=${encodeURIComponent(userToken)}`;
    window.location.href = url;
  }
  
  function copyWindowsCommand() {
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "install-kuamini-windows.ps1"`;
    navigator.clipboard.writeText(command);
    alert('Command copied! Download the script first, then run this command.');
  }
</script>
```

## Troubleshooting

### Issue: Token not being passed to agent

**Diagnosis:**
```powershell
# Check if token file exists
Test-Path "C:\Program Files (x86)\Kuamini Security Client\registration.token"

# Check token content
Get-Content "C:\Program Files (x86)\Kuamini Security Client\registration.token"

# Check config.json
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | ConvertFrom-Json | Select-Object registration_token
```

**Solution:** 
- Ensure installer script completed successfully
- Check installer script had token embedded
- Re-download script from console and try again

### Issue: Script downloaded but has no token

**Cause:** API endpoint not embedding token correctly

**Solution:**
- Verify token parameter is being passed to API
- Check API logs for errors
- Test endpoint directly: `/api/agent/installers/windows/script?token=test`

## Summary

✅ **No token hardcoded in MSI** - Secure and reusable  
✅ **Dynamic token embedding** - Each user gets personalized script  
✅ **Simple user experience** - One-click download, minimal steps  
✅ **Secure transmission** - HTTPS, POST option available  
✅ **Proper cleanup** - Token files deleted after use

This design separates the reusable MSI from the user-specific token, making distribution secure and scalable.
