# Manual Cleanup Guide - Kuamini Security Client

If the uninstaller script fails to remove the installation folder, follow these manual steps.

## Quick Fix (One Command)

Copy and paste this entire block into **PowerShell (as Administrator)**:

```powershell
# Kill all Kuamini processes
Get-Process | Where-Object { $_.Name -like "*Kuamini*" } | Stop-Process -Force -ErrorAction SilentlyContinue
taskkill /F /T /IM KuaminiSecurityClient.exe 2>$null

# Take ownership of the folder
$paths = @(
    "C:\Program Files\KuaminiSecurityClient",
    "C:\Program Files\Kuamini",
    "C:\Program Files (x86)\KuaminiSecurityClient",
    "C:\Program Files (x86)\Kuamini Security Client",
    "C:\Program Files (x86)\Kuamini"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "Taking ownership of: $path" -ForegroundColor Cyan
        
        # Take ownership
        takeown /f $path /r /d Y
        
        # Grant permissions
        icacls $path /grant:r $([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value):F /t /c
        
        # Remove
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        
        if (Test-Path $path) {
            Write-Host "  ✗ Still exists" -ForegroundColor Red
        } else {
            Write-Host "  ✓ Removed" -ForegroundColor Green
        }
    }
}

Write-Host "`nCleanup complete!" -ForegroundColor Green
```

---

## Step-by-Step Manual Cleanup

### 1. Stop All Processes

Open **PowerShell as Administrator** and run:

```powershell
# Kill all Kuamini processes
Get-Process | Where-Object { $_.Name -like "*Kuamini*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Extra kill with taskkill
taskkill /F /T /IM KuaminiSecurityClient.exe 2>$null
taskkill /F /IM KuaminiAgentTray.exe 2>$null

# Wait
Start-Sleep -Seconds 2
```

### 2. Take Ownership of the Folder

The folder is likely locked or has special permissions. Take ownership:

```powershell
# The path that failed to delete
$path = "C:\Program Files (x86)\Kuamini Security Client"

# Take ownership using Windows utility
takeown /f $path /r /d Y

# Grant full permissions for your user
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls $path /grant:r "$currentUser`:F" /t /c
```

### 3. Grant Full Permissions to Children

```powershell
# Grant permissions to all files inside
icacls "C:\Program Files (x86)\Kuamini Security Client\*" /grant:r "$currentUser`:F" /t /c
```

### 4. Remove Attributes

```powershell
# Reset file attributes (in case they're read-only)
Get-ChildItem "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $_.Attributes = "Normal"
}
```

### 5. Delete the Folder

```powershell
# Now try to delete
Remove-Item "C:\Program Files (x86)\Kuamini Security Client" -Recurse -Force -ErrorAction Stop

Write-Host "Folder removed successfully!" -ForegroundColor Green
```

### 6. Verify Deletion

```powershell
# Confirm it's gone
if (Test-Path "C:\Program Files (x86)\Kuamini Security Client") {
    Write-Host "ERROR: Folder still exists!" -ForegroundColor Red
} else {
    Write-Host "OK: Folder successfully deleted" -ForegroundColor Green
}
```

---

## If Manual Deletion Still Fails

### Option A: Schedule Deletion on Next Reboot

Run this in **PowerShell as Administrator**:

```powershell
# Schedule the folder for deletion on next reboot (Windows will remove it at startup)
$path = "C:\Program Files (x86)\Kuamini Security Client"

# Move to a temporary location
$tempPath = "C:\Windows\Temp\kuamini-delete"
if (-not (Test-Path $tempPath)) { New-Item -ItemType Directory $tempPath -Force | Out-Null }

Move-Item $path $tempPath -Force -ErrorAction SilentlyContinue

Write-Host "Folder moved to temp. It will be removed on next reboot." -ForegroundColor Yellow
Write-Host "Please restart Windows to complete cleanup." -ForegroundColor Yellow

# Restart Windows (optional)
# Restart-Computer -Force
```

### Option B: Use Command Prompt Alternative

Open **Command Prompt as Administrator** and run:

```batch
REM Take ownership
takeown /f "C:\Program Files (x86)\Kuamini Security Client" /r /d Y

REM Grant permissions
icacls "C:\Program Files (x86)\Kuamini Security Client" /grant:r "%username%":F /t /c

REM Delete
rmdir /s /q "C:\Program Files (x86)\Kuamini Security Client"

REM Verify
if exist "C:\Program Files (x86)\Kuamini Security Client" (
    echo ERROR: Folder still exists!
) else (
    echo SUCCESS: Folder deleted
)
```

### Option C: Use File Explorer (GUI Method)

1. Open **File Explorer**
2. Navigate to `C:\Program Files (x86)\`
3. Right-click `Kuamini Security Client` folder
4. Select **Properties**
5. Click **Security** tab
6. Click **Edit**
7. Select your username
8. Click **Full Control** checkbox
9. Apply and OK
10. Try deleting the folder again

### Option D: Safe Mode

If deletion fails normally:

1. Restart Windows in **Safe Mode with Command Prompt**
2. Run the cleanup commands above
3. Safe mode often has fewer file locks

---

## Complete Cleanup Script (Comprehensive)

If the one-liner doesn't work, save this as `cleanup.ps1` and run:

```powershell
#Requires -RunAsAdministrator

$ErrorActionPreference = "Continue"

Write-Host "Kuamini Security Client - Complete Manual Cleanup" -ForegroundColor Cyan
Write-Host ""

# Paths to check
$paths = @(
    "C:\Program Files\KuaminiSecurityClient",
    "C:\Program Files\Kuamini",
    "C:\Program Files (x86)\KuaminiSecurityClient",
    "C:\Program Files (x86)\Kuamini",
    "C:\Program Files (x86)\Kuamini Security Client",
    "$env:LOCALAPPDATA\KuaminiSecurityClient",
    "$env:APPDATA\Kuamini",
    "$env:ProgramData\Kuamini"
)

Write-Host "Step 1: Stopping all processes..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -like "*Kuamini*" } | Stop-Process -Force -ErrorAction SilentlyContinue
taskkill /F /T /IM KuaminiSecurityClient.exe 2>$null
Start-Sleep -Seconds 1

Write-Host "Step 2: Taking ownership and removing folders..." -ForegroundColor Yellow
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host ""
        Write-Host "Processing: $path" -ForegroundColor Cyan
        
        try {
            # Take ownership
            Write-Host "  - Taking ownership..." -ForegroundColor Gray
            takeown /f $path /r /d Y 2>&1 | Out-Null
            
            # Grant permissions
            Write-Host "  - Granting permissions..." -ForegroundColor Gray
            icacls $path /grant:r "$currentUser`:F" /t /c 2>&1 | Out-Null
            
            # Reset attributes
            Write-Host "  - Resetting attributes..." -ForegroundColor Gray
            Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                $_.Attributes = "Normal"
            }
            
            # Remove
            Write-Host "  - Removing..." -ForegroundColor Gray
            Remove-Item $path -Recurse -Force -ErrorAction Stop
            
            Write-Host "  ✓ Removed successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "  ⚠ Failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Step 3: Cleaning registry..." -ForegroundColor Yellow

@(
    "HKCU:\Software\Kuamini",
    "HKLM:\Software\Kuamini",
    "HKLM:\Software\KuaminiSecurityClient"
) | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item $_ -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Removed: $_" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If folders still exist, you may need to restart Windows." -ForegroundColor Yellow
```

---

## Diagnostic Commands

Check what's still remaining:

```powershell
# Check running processes
Get-Process | Where-Object { $_.Name -like "*Kuamini*" }

# Check installation folder
Test-Path "C:\Program Files (x86)\Kuamini Security Client"
Get-ChildItem "C:\Program Files (x86)\Kuamini Security Client" -ErrorAction SilentlyContinue

# Check for MSI entries
Get-ItemProperty 'HKLM:\SOFTWARE\*\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\*\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Kuamini*' }

# Check config files
Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\config.json"

# Check logs
Test-Path "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log"
```

---

## Why This Happens

1. **File Locking**: The executable or DLLs might still be loaded in memory
2. **Permission Issues**: Windows protects Program Files directories
3. **Registry Locks**: Registry entries can prevent deletion
4. **Windows Indexing**: Windows Search might be scanning files
5. **Antivirus**: Security software might lock the files

---

## Prevention for Future

The improved uninstaller (v3.1) should handle these cases automatically:

```powershell
# Use the latest uninstaller v3.1
powershell -NoProfile -ExecutionPolicy Bypass -File "uninstall-kuamini-windows-v3.1.ps1"
```

This script:
- ✅ Takes ownership automatically
- ✅ Grants permissions automatically
- ✅ Handles locked files with multiple strategies
- ✅ Schedules deletion on reboot if needed
- ✅ Better error handling

---

## Still Having Issues?

If the folder still won't delete after all this:

1. **Restart Windows** - Many file locks are cleared on reboot
2. **Boot into Safe Mode** - Fewer services = fewer locks
3. **Use Unlocker utility** - Third-party tool for locked files
4. **Check Windows Defender** - May be scanning the folder
5. **Disable antivirus temporarily** - Then try deletion

Most folders can be removed with the `takeown` + `icacls` commands. If not, a restart will handle it.
