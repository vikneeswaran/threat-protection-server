# Kuamini Security Client - Windows Installation Guide (v2.1)

## Quick Start

Choose your preferred installation method:

### Method 1: One-Line PowerShell (Recommended for Console UI)

Copy and paste this command in PowerShell (as Administrator), replacing `YOUR_TOKEN` with your registration token:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy Bypass -Force; iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'YOUR_TOKEN'"
```

Or simpler: Save the script locally and run:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "install-kuamini-windows-cli.ps1" -Token "YOUR_TOKEN"
```

### Method 2: Batch File + PowerShell Script

1. Download both files from the installer page:
   - `install-kuamini.bat`
   - `install-kuamini-windows-cli.ps1`

2. Place both in the same folder

3. Open Command Prompt as Administrator

4. Run:
   ```cmd
   install-kuamini.bat "YOUR_TOKEN"
   ```

### Method 3: Direct MSI Installation

For users who need the MSI only (requires manual token handling):

```powershell
# In an elevated PowerShell prompt:
$msiPath = "C:\temp\KuaminiSecurityClient-1.0.5.msi"
msiexec.exe /i $msiPath /quiet /norestart

# Then manually create the registration token file:
$token = "YOUR_TOKEN"
$installPath = "C:\Program Files (x86)\Kuamini Security Client"
Set-Content -Path "$installPath\registration.token" -Value $token -Encoding UTF8
```

---

## How It Works

### The Installation Flow

```
1. User gets registration token from console
2. User runs installer script with token parameter
3. Script validates token and checks prerequisites
4. Script downloads MSI from API endpoint
5. Script creates config.json in LOCALAPPDATA
6. Script runs MSI installation
7. Script writes registration.token to install directory
8. Agent starts automatically and reads token file
9. Agent registers with console using token
10. Console shows endpoint as "Online"
```

### Token Handling

The installer handles the token in three places:

1. **config.json** - JSON configuration in `%LOCALAPPDATA%\KuaminiSecurityClient\`
   ```json
   {
     "registration_token": "YOUR_TOKEN",
     "agent_id": "uuid-here",
     ...
   }
   ```

2. **registration.token** - Plain text file in installation directory
   - Created by installer after MSI runs
   - Read by agent on startup
   - Deleted after being consumed

3. **Agent Memory** - Loaded on startup
   - Agent starts and reads registration.token or config.json
   - Token used for registration/heartbeat requests
   - Auto-registration happens immediately

### Directory Locations

**Installation Paths (checked in order):**
- `C:\Program Files\Kuamini Security Client\` (x64)
- `C:\Program Files (x86)\Kuamini Security Client\` (x86)

**Configuration Paths:**
- `%LOCALAPPDATA%\KuaminiSecurityClient\config.json`
- `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`

**Temp Folders:**
- MSI downloads: `%TEMP%\kuamini-install-RANDOM\`
- Scripts can be cleaned up after installation

---

## Troubleshooting

### Issue: "Invalid token" error

**Cause:** Token is malformed or expired

**Solution:**
1. Copy token from console page again
2. Ensure no extra spaces or characters
3. Try installation again

### Issue: Agent installed but not showing tray icon

**Cause:** Agent process not starting

**Solution:**
1. Check logs: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
2. Verify `registration.token` exists in install directory
3. Check if Windows Defender or antivirus is blocking agent
4. Manually run: `"C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"`

### Issue: "Administrator privileges required" error

**Cause:** Running in non-elevated PowerShell

**Solution:**
1. Right-click PowerShell → "Run as Administrator"
2. Or right-click Command Prompt → "Run as Administrator"
3. Then run the installation command

### Issue: Installation hangs or takes too long

**Cause:** Network or antivirus interference

**Solution:**
1. Check internet connectivity: `ping kuaminisystems.com`
2. Disable antivirus temporarily and retry
3. Check Windows Firewall logs in Event Viewer
4. Try downloading MSI manually first, then run script with local path

### Issue: Agent not registering after installation

**Cause:** Network, token, or config issue

**Solution:**
1. Check agent logs: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
2. Verify token file: Check-Content "C:\Program Files (x86)\Kuamini Security Client\registration.token"
3. Verify config file: Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json" | ConvertFrom-Json
4. Check network connectivity to API: `Test-NetConnection kuaminisystems.com -Port 443`
5. Restart agent: Stop all KuaminiSecurityClient processes and restart

---

## For Console UI Implementation

### Recommended Button Text
```
"Download & Install" or "Get Started"
```

### Command to Display

Show users a copy-paste command with their token pre-filled:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "install-kuamini-windows-cli.ps1" -Token "USER_TOKEN_HERE"
```

Or use the one-liner for in-page iframe/webview:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'USER_TOKEN_HERE'"
```

### Integration Steps

1. **Download Button**: Serve `install-kuamini.bat` + `install-kuamini-windows-cli.ps1` as ZIP
2. **Copy Command Button**: Show pre-filled PowerShell command with user's token
3. **Direct Installation**: Optionally embed script in iframe (advanced)

### API Endpoints

- **MSI Download**: `GET /api/agent/installers/windows?token=USER_TOKEN`
  - Returns: Redirect to pre-built MSI file
  - Future: Can embed token in MSI dynamically

- **Installer Script**: `GET /tray/install-kuamini-windows-cli.ps1`
  - Returns: PowerShell installer script
  - Future: Can embed token and customizations

---

## Version History

- **v2.1** - Token-aware CLI installer (current)
- **v2.0** - PowerShell wrapper with config creation
- **v1.0** - Direct MSI installation

---

## Support

For issues or questions:
1. Check the logs: `%LOCALAPPDATA%\KuaminiSecurityClient\agent.log`
2. Review console dashboard for endpoint status
3. Contact support: support@kuaminisystems.com
