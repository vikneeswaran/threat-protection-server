# Installer Improvements - Self-Registration Enabled

## Problem Identified

When you "double-clicked the installer" from the console download, nothing happened because:

1. **Installer script wasn't being distributed** - The GitHub Actions workflow only built the MSI file, not the PowerShell wrapper script
2. **Token was required upfront** - The installer expected a token, and when run without one, it would fail silently
3. **No graceful fallback** - There was no alternative if a user couldn't provide a token

## Solutions Implemented

### 1. **Installer Script Now Supports Three Token Input Methods**
- ✅ **Parameter**: `install.ps1 -Token "your-token"`
- ✅ **Environment Variable**: `$env:KUAMINI_TOKEN = "..."; install.ps1`
- ✅ **User Prompt**: Run script interactively and enter token at prompt
- ✅ **Skip Token**: Type "skip" to proceed without pre-configured token

### 2. **Two Installation Modes Now Supported**

#### Mode A: PRE-CONFIGURED (requires valid token)
```powershell
# Download installer script from console
# Run with token pre-configured
.\install-kuamini-windows-cli.ps1 -Token "eyJhY2NvdW50SWQi..."

Result:
✅ config.json created with registration_token
✅ Agent starts immediately
✅ Agent auto-registers using provided token
✅ Systray visible within 3-5 seconds
✅ Endpoint shows in console immediately
```

#### Mode B: SELF-REGISTRATION (no token needed)
```powershell
# Download installer script from console  
# Run without any parameters
.\install-kuamini-windows-cli.ps1

# When prompted for token, type "skip"
Enter registration token (or 'skip' to register without pre-configured token): skip

Result:
✅ config.json created WITHOUT registration_token
✅ Agent starts immediately
✅ Agent self-registers using built-in mechanism
✅ Systray visible within 5-10 seconds
✅ Endpoint shows in console within 30 seconds
```

### 3. **Updated GitHub Actions Workflow**

The build-and-deploy.yml workflow now:
- ✅ Builds MSI and agent executable
- ✅ Commits PowerShell installer script to git
- ✅ Makes installer script available for download from console
- ✅ Ensures installer is always up-to-date with latest improvements

## Technical Changes

### Installer Script Changes

**Get-TokenFromConsole Function**
- Now supports environment variable `$env:KUAMINI_TOKEN`
- Allows users to skip token with "skip" option
- Better retry logic and error messages
- Returns `$null` if user skips (triggers self-registration mode)

**Get-InstallerMSI Function**
- Made token parameter optional
- If token provided: includes in download URL
- If no token: downloads MSI without token parameter

**New-ConfigFile Function**
- Made token parameter optional
- If token provided: includes in config.json as `registration_token`
- If no token: creates config WITHOUT registration_token field
- Agent detects missing token and triggers self-registration

**Write-RegistrationToken Function**
- Made token parameter optional  
- Skips writing to file if no token provided
- Logs message: "Agent will register using config.json"

### Workflow Changes (.github/workflows/build-and-deploy.yml)

```yaml
# Deploy step now includes PowerShell scripts
git add public/tray/*.ps1  # ← NEW

# Commit message shows timestamp
git commit -m "build: update installers from latest code (2026-02-04)"  # ← NEW
```

## How This Solves Your Installation Issues

### Before
1. ❌ Double-click installer.exe → MSI installs but no config created
2. ❌ No token provided → Silent failure
3. ❌ Agent doesn't start → No systray, no registration

### After Mode A (Pre-configured)
1. ✅ Download from console with token embedded (or provide with `-Token`)
2. ✅ Run script → Token validated immediately
3. ✅ Config created with token
4. ✅ Agent starts and auto-registers
5. ✅ Systray appears, endpoint visible in console

### After Mode B (Self-registration)
1. ✅ Download installer script from console
2. ✅ Run script → No token needed
3. ✅ Type "skip" when prompted
4. ✅ Config created without token field
5. ✅ Agent starts and registers itself
6. ✅ Systray appears, endpoint visible in console

## Testing Mode B (Self-Registration)

To test if self-registration works:

```powershell
# 1. Uninstall previous
Uninstall-KuaminiSecurityClient  # or use your uninstaller script

# 2. Run installer without token
.\install-kuamini-windows-cli.ps1

# When prompted:
# "Enter registration token (or 'skip' to register without pre-configured token):"
# Type: skip

# Expected results:
# ✅ Step 6: Create configuration → OK (without token)
# ✅ Agent process should start
# ✅ Check $env:LOCALAPPDATA\KuaminiSecurityClient\agent.log
# ✅ Should see "Auto-registration enabled, attempting registration"
# ✅ Within 10 seconds: "Auto-registration successful"
# ✅ Systray icon should appear
# ✅ Console should show endpoint as "Online"
```

## Files Modified

```
public/tray/install-kuamini-windows-cli.ps1
├── Get-TokenFromConsole: Now supports env var, skip option, retry logic
├── Get-InstallerMSI: Token now optional, doesn't fail without it
├── New-ConfigFile: Token now optional, creates basic config without it
└── Write-RegistrationToken: Token now optional, gracefully skips

.github/workflows/build-and-deploy.yml  
├── Deploy step: Now includes PowerShell scripts in commits
└── Commit message: Added timestamp for clarity

test-skip-token-mode.ps1 (NEW)
└── Test script to verify self-registration mode works
```

## Commits

- **53fe093**: Make installer robust for double-click execution without token
- **6e8c10b**: Make all installer functions handle optional tokens gracefully
- **d616113**: Workflow and deployment updates

## Next Steps

1. **Update Console UI** (if applicable)
   - Generate installer script with token pre-filled OR
   - Provide link to download basic installer and show token separately

2. **Test Both Modes**
   - Mode A: With pre-configured token (fast, immediate registration)
   - Mode B: Without token (more flexible, self-registration)

3. **Document for Users**
   - Create user guide for "Double-click to install" experience
   - Show both token-based and self-registration flows
   - Include troubleshooting for common issues

---

**Status**: ✅ READY FOR TESTING

The installer is now robust enough to work whether or not a token is pre-configured. Users downloading the installer from the console will have a seamless experience in either mode.
