# Windows Defender False Positive - PyInstaller Detection

## Issue

Windows Defender is flagging the KuaminiSecurityClient.exe as malware:
- **Detected as**: `Trojan: Win32/Sabsik.F.L.A!ml`
- **Root cause**: PyInstaller-bundled executables have characteristics similar to malware (bundled Python runtime, encrypted resources)
- **Impact**: Agent cannot run, preventing endpoint registration even after installation

## Solutions

### Solution 1: Code-Signing (Production - Recommended)

**What**: Digitally sign the executable with a code-signing certificate
**Benefits**: 
- Eliminates Windows Defender false positives
- Builds user trust (verified publisher)
- Required for enterprise deployment

**Cost**: $150-400/year for code-signing certificate (Authenticode)

**Implementation**:
1. Purchase code-signing certificate (e.g., from DigiCert, Sectigo, GlobalSign)
2. Update PyInstaller build process to sign the executable
3. Update WiX to sign the MSI 
4. Rebuild and deploy

**Timeline**: 1-2 days after certificate acquisition

---

### Solution 2: Windows Defender Exclusions (Development/Testing)

**What**: Tell Windows Defender to skip scanning the agent
**Benefits**: Immediate, no cost
**Drawbacks**: Users must do this manually, poor UX, requires admin

**For Users**:
```powershell
# Run as Administrator
Add-MpPreference -ExclusionPath "C:\Program Files\Kuamini Security Client" -Force
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\KuaminiSecurityClient" -Force
```

**Via Company Policy** (if deployed via Group Policy):
- Add paths to Windows Defender exclusion policy
- Roll out via SCCM/Intune

---

### Solution 3: PyInstaller Optimization (Medium-term)

**What**: Rebuild agent with PyInstaller options to reduce malware-like characteristics
**Attempts**:
- `--onefile` vs `--onedir` (current uses onedir) - try onefile
- Change compression/bundling settings
- Remove optional modules not needed
- Use UPX compression sparingly

**Effectiveness**: 30-50% chance of reducing false positives, not guaranteed

**Timeline**: 1-2 hours to test

---

### Solution 4: SmartScreen Bypass (Development Only)

**What**: Locally disable SmartScreen/Windows Defender scanning
**Note**: NOT suitable for production/user machines

```powershell
# Temporarily disable SmartScreen (dev only)
Set-MpPreference -DisableRealtimeMonitoring $true

# Re-enable
Set-MpPreference -DisableRealtimeMonitoring $true
```

---

## Recommended Approach

### Short-term (Current)
1. **Document the issue** - Create help article for users about Windows Defender
2. **Provide exclusion script** - Include PowerShell script in help docs to add exclusions
3. **Use helper script** - New `install-helper.ps1` in console download bundle handles setup

### Medium-term (Next sprint)
1. **Try PyInstaller optimization** - Test with `--onefile` and compression settings
2. **Test detection rate** - Scan rebuilt exe on VirusTotal
3. **Monitor false positive reports** - Track user feedback

### Long-term (Production)
1. **Acquire code-signing certificate**
2. **Implement signing in build pipeline**
3. **Deploy signed version to console**
4. **Publish update notes**: "Now digitally signed - no more antivirus blocks"

---

## Current Status

**Installer Bundle** (`install-helper.ps1`):
- ✅ New PowerShell helper script added to console downloads
- ✅ Script handles token passing to MSI
- ✅ Script creates config directory and backs up token
- ✅ Script provides clear instructions to user
- ✅ Script logs installation status

**Test Steps for User** (once you have admin access):
```powershell
# 1. Download ZIP from console
# 2. Extract ZIP folder
# 3. Open PowerShell as Administrator
cd C:\Users\username\Downloads\KuaminiSecurityClient-xxxxx
PowerShell.exe -ExecutionPolicy Bypass -File install-helper.ps1
```

---

## References

- PyInstaller known issues: https://github.com/pyinstaller/pyinstaller/wiki/Windows-Defender-false-positives
- Code-signing for Windows: https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-functions
- Windows Defender exclusions: https://docs.microsoft.com/en-us/windows/security/threat-protection/windows-defender-antivirus/configure-exclusions-windows-defender-antivirus

