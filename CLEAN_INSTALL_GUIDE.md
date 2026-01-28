# Clean Installation Guide - Kuamini Security Client

## Overview

This guide provides step-by-step instructions for completely removing a corrupted Kuamini installation and performing a fresh, clean installation.

**Current Issue:** Python DLL error
```
Failed to load Python DLL 'C:\Program Files (x86)\Kuamini Security Client\_internal\python314.dll'
```

This indicates a corrupted or incomplete Python installation that cannot be fixed by normal uninstallation.

---

## Phase 1: Complete Uninstallation

### Prerequisites
- Administrator access
- Windows PowerShell or PowerShell 7+
- All unsaved work saved

### Quick Uninstall

```powershell
# Run as Administrator
cd "C:\Users\[YOUR_USERNAME]\Documents\Projects\threat-protection-agent\uninstallers"
.\uninstall-kuamini-windows.ps1
```

### Uninstall Options

```powershell
# Standard uninstall with logging and backups
.\uninstall-kuamini-windows.ps1

# Silent mode (no prompts, but still logs)
.\uninstall-kuamini-windows.ps1 -Silent

# Force remove (attempts harder removal of locked files)
.\uninstall-kuamini-windows.ps1 -Force

# Skip backup (faster, but no registry recovery option)
.\uninstall-kuamini-windows.ps1 -Backup:$false

# Combine options
.\uninstall-kuamini-windows.ps1 -Silent -Force
```

### What the Uninstaller Does

**Phase 0:** Creates registry backup for recovery  
**Phase 1:** Terminates all Kuamini processes (3 attempts)  
**Phase 2:** Special handling for corrupted Python installations  
**Phase 3:** Uninstalls MSI packages via Windows  
**Phase 4:** Removes scheduled tasks  
**Phase 5:** Cleans startup registry entries  
**Phase 6:** Removes Kuamini registry keys  
**Phase 7:** Deletes installation folders  
**Phase 8:** Removes shortcuts  
**Phase 9:** Cleans temporary files  
**Phase 10:** Refreshes Windows Explorer  

### Expected Output

```
====== Kuamini Security Client - Enhanced Uninstaller ======
This script will remove all traces of Kuamini Security Client

Phase 0: Creating backup...
  Backup created at: C:\Users\...\KuaminiRegistryBackup_20240115_143022.reg
  ✓ Complete

Phase 1: Terminating processes...
  Terminated X process instance(s)
  ✓ Complete

... (phases 2-10) ...

====== Final Verification ======
✓✓✓ UNINSTALLATION SUCCESSFUL ✓✓✓
All traces of Kuamini Security Client have been removed!
```

### Handling Stubborn Files

If the uninstaller reports files it cannot remove:

1. **Natural Reboot** (Recommended)
   - The script schedules locked files for deletion on next boot
   - Simply restart your computer
   - Deleted files will be removed automatically

2. **Active Reboot** (If needed now)
   - Accept the reboot prompt from the uninstaller
   - This forces file deletion on restart

3. **Manual Cleanup** (Last resort)
   - Restart computer in Safe Mode
   - Run uninstaller again
   - Any remaining files can be manually deleted

### Verification Checklist

After uninstallation completes, verify:

- [ ] No "Kuamini Security Client" in Control Panel → Programs → Programs and Features
- [ ] No Kuamini processes running: `Get-Process | Where-Object {$_.Name -like "*Kuamini*"}`
- [ ] No folders at:
  - `C:\Program Files\Kuamini`
  - `C:\Program Files (x86)\KuaminiSecurityClient`
  - `%APPDATA%\Kuamini`
  - `%LOCALAPPDATA%\KuaminiSecurityClient`
- [ ] No Python error dialogs appearing

---

## Phase 2: System Cleanup (Optional but Recommended)

After uninstalling, clean up any remnants:

```powershell
# As Administrator

# Option 1: Clear Windows cache
Remove-Item "C:\Windows\Installer\Kuamini*" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\Kuamini*" -Recurse -Force -ErrorAction SilentlyContinue

# Option 2: Clear WMI information
Get-WmiObject Win32_Product | Where-Object {$_.Name -like "*Kuamini*"} | ForEach-Object {$_.Uninstall()}

# Option 3: Restart Windows Update/Installer cache (if stuck)
Restart-Service -Name msiserver -Force -ErrorAction SilentlyContinue
```

---

## Phase 3: Clean Installation

Once uninstallation is complete and verified:

### A. Build the Installer

```bash
# Navigate to project directory
cd "C:\Users\[YOUR_USERNAME]\Documents\Projects\threat-protection-agent"

# Install dependencies (if not done)
npm install --legacy-peer-deps

# Build the agent
npm run build

# Generate installer
npm run build:installer
```

**Expected output:**
```
✓ Agent built successfully
✓ Installer created at: ./dist/KuaminiSecurityClient-installer.exe
```

### B. Run the Fresh Installation

```powershell
# As Administrator

# Navigate to dist folder
cd ".\dist"

# Run the installer
.\KuaminiSecurityClient-installer.exe
```

**Installer will:**
- Extract agent to proper location
- Create necessary registry entries
- Set up service/scheduled task
- Configure startup entries
- Create shortcuts

### C. Post-Installation Verification

```powershell
# Check if installed to correct location
Test-Path "C:\Program Files (x86)\Kuamini Security Client"

# Verify Python installation exists
Test-Path "C:\Program Files (x86)\Kuamini Security Client\_internal\python314.dll"

# Check for running processes
Get-Process | Where-Object {$_.Name -like "*Kuamini*"}

# Verify registry entry
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' | 
  Where-Object {$_.DisplayName -like "*Kuamini*"}

# Check Windows Event Log for errors
Get-EventLog -LogName Application -Source "KuaminiSecurityClient" -Newest 10
```

### D. Test the Installation

```powershell
# Start the agent service
Start-Service -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue

# Or run tray application
Start-Process "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"

# Wait 10 seconds then check status
Start-Sleep -Seconds 10
Get-Process -Name "KuaminiSecurityClient" -ErrorAction SilentlyContinue
```

---

## Troubleshooting

### Issue: "DLL not found" error after installation

**Cause:** Python installation incomplete  
**Solution:**
1. Uninstall with `.\uninstall-kuamini-windows.ps1 -Force`
2. Restart computer
3. Rebuild and reinstall: `npm run build:installer`

### Issue: Installer won't run

**Cause:** Previous installation still partially present  
**Solution:**
1. Check Control Panel for any Kuamini entries and manually remove
2. Delete: `C:\Program Files (x86)\Kuamini Security Client` folder manually
3. Delete: `C:\Program Files (x86)\KuaminiSecurityClient` folder manually
4. Restart computer
5. Run installer again

### Issue: Python 3.14 not found

**Cause:** Python bundle extraction failed  
**Solution:**
1. Verify installer file integrity (size should be > 100MB)
2. Check disk space (need 500MB+ free)
3. Disable antivirus temporarily during installation
4. Try MSI installer instead

### Issue: "Python DLL locked" during uninstall

**Cause:** Process still holding handle  
**Solution:**
1. Let the uninstaller schedule for reboot
2. Or restart in Safe Mode and run uninstaller again
3. Or manually: `taskkill /F /T /IM python314.exe`

### Issue: Registry entries still present

**Cause:** Incomplete uninstall  
**Solution:**
```powershell
# Run as Administrator
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\KuaminiSecurityClient" /f
reg delete "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\KuaminiSecurityClient" /f
```

---

## Recovery

### Restore from Backup

If uninstallation created issues and you need to restore:

```powershell
# Find backup file (usually in %TEMP%)
Get-Item "$env:TEMP\KuaminiRegistryBackup_*.reg" | Select-Object FullName

# Import backup
reg import "C:\Users\...\KuaminiRegistryBackup_20240115_143022.reg"
```

### Full System Restore

If clean install fails completely:

1. **Windows System Restore**
   - `System` → `System Protection` → `System Restore`
   - Choose restore point before Kuamini issues started

2. **Reinstall from Original Media**
   - If available, use original installation media
   - Follow manufacturer's instructions

---

## Best Practices

### Before Installation
- [ ] Create system restore point
- [ ] Close all applications
- [ ] Disable antivirus temporarily
- [ ] Save all work

### During Installation
- [ ] Do not interrupt installation
- [ ] Keep computer powered on
- [ ] Keep administrator access available
- [ ] Monitor console for errors

### After Installation
- [ ] Verify in Control Panel
- [ ] Check Windows Event Log
- [ ] Test all functionality
- [ ] Create a new system restore point

### Maintenance
- [ ] Quarterly uninstall/reinstall to prevent corruption
- [ ] Monitor disk space (Python needs 300MB+)
- [ ] Keep Windows updated
- [ ] Avoid interrupting uninstall processes

---

## Support

If issues persist after following this guide:

1. Collect diagnostic information:
   ```powershell
   python .\agent-diagnostics.py
   ```

2. Provide logs from:
   - Event Viewer: Application logs
   - `%LOCALAPPDATA%\Kuamini\agent.log`
   - Uninstaller output

3. Contact support with:
   - System information (Windows version, processor, RAM)
   - Error messages (exact text)
   - Steps performed already
   - Diagnostic output

---

## Quick Reference Commands

```powershell
# Uninstall
.\uninstallers\uninstall-kuamini-windows.ps1

# Check if installed
Test-Path "C:\Program Files (x86)\Kuamini Security Client"

# Check version
(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' | 
  Where-Object {$_.DisplayName -like "*Kuamini*"}).DisplayVersion

# Kill all processes
Get-Process | Where-Object {$_.Name -like "*Kuamini*"} | Stop-Process -Force

# Clean temp files
Remove-Item "$env:TEMP\Kuamini*" -Recurse -Force -ErrorAction SilentlyContinue

# Build & install
npm install --legacy-peer-deps; npm run build; npm run build:installer

# View recent errors
Get-EventLog -LogName Application -Source "KuaminiSecurityClient" -Newest 5
```

---

**Last Updated:** 2024  
**Script Version:** 3.0 (Enhanced with Python DLL handling)
