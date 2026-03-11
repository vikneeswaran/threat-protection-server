# Code Signing Guide for Windows and macOS

## Overview

Code signing is essential for production distribution to prevent security warnings and ensure user trust. This guide covers the complete process for signing Windows executables and macOS applications.

---

## Windows Code Signing (Microsoft Authenticode)

### Quick Start (YubiKey EV)

Use this minimal flow for day-to-day signing:

```powershell
# 1) Verify token and cert visibility
certutil -scinfo

# 2) Set certificate thumbprint and SignTool path
$thumb = "A601BE630D3BA76BC6ECD38CB3470770D16648D4"
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

# 3) Sign MSI(s)
& $signtool sign /sha1 $thumb /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /v "public\tray\KuaminiSecurityClient-1.0.5.msi"

# 4) Sign scripts
$cert = Get-ChildItem Cert:\CurrentUser\My\$thumb
Set-AuthenticodeSignature -FilePath "public\tray\install-helper.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Set-AuthenticodeSignature -FilePath "public\tray\uninstall-kuamini-windows.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"

# 5) Verify
& $signtool verify /pa /v "public\tray\KuaminiSecurityClient-1.0.5.msi"
Get-AuthenticodeSignature "public\tray\install-helper.ps1" | Format-List Status,SignerCertificate,TimeStamperCertificate
```

### Prerequisites

**What You Need:**
- Windows development machine
- Code signing certificate (EV or Standard)
- Windows SDK (for SignTool.exe)
- Your built `.exe` or `.msi` installer

**Cost:**
- Standard Code Signing Certificate: $100-300/year
- EV (Extended Validation) Certificate: $400-600/year
- **Recommended:** EV certificate for instant SmartScreen reputation

---

### Step 1: Obtain a Code Signing Certificate

#### Option A: Extended Validation (EV) Certificate (RECOMMENDED)

**Providers:**
- DigiCert (https://www.digicert.com) - Most popular
- Sectigo (https://sectigo.com)
- GlobalSign (https://www.globalsign.com)

**Why EV Certificate?**
- ✅ Instant Microsoft SmartScreen reputation
- ✅ No "Unknown Publisher" warnings
- ✅ Higher user trust
- ✅ Required for Windows Kernel drivers
- ❌ More expensive ($400-600/year)
- ❌ Requires hardware USB token (included)

**Application Process:**
1. Go to provider website (e.g., DigiCert)
2. Select "EV Code Signing Certificate"
3. Complete organization validation:
   - Business registration documents
   - D-U-N-S number (free from Dun & Bradstreet)
   - Phone verification
   - Government-issued ID
4. Processing time: 3-7 business days
5. Receive USB token by mail

#### Option B: Standard Code Signing Certificate

**Providers:**
- Same as above (DigiCert, Sectigo, GlobalSign)
- Also: Comodo, SSL.com, Certum

**Process:**
1. Select "Standard Code Signing Certificate"
2. Provide business verification documents
3. Receive certificate file (`.pfx` or `.p12`)
4. Processing time: 1-3 business days

**Note:** Standard certificates require building SmartScreen reputation over time (can take weeks/months).

---

### Step 2: Install Windows SDK

**Download & Install:**

```powershell
# Option 1: Download Windows SDK
# Go to: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
# Install only "Windows SDK Signing Tools for Desktop Apps"

# Option 2: Check if already installed
Get-Command signtool -ErrorAction SilentlyContinue

# Typical location:
# C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe
```

**Add to PATH (Optional):**

```powershell
# Add Windows SDK to your PATH
$sdkPath = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64"
$env:PATH += ";$sdkPath"

# Verify
signtool /?
```

---

### Step 3: Sign Your Windows Executable

#### Recommended: EV Certificate on YubiKey (CA-Issued)

This is the validated flow for hardware-backed signing keys.

1. Insert YubiKey and verify smart card access:

```powershell
certutil -scinfo
```

2. Confirm your signing cert appears and private key verifies in the output.

3. If needed, import public cert/chain into Windows certificate stores:

```powershell
# Signing cert (Current User personal store)
certutil -user -addstore My "C:\Users\<you>\Certificates\KuaminiCodeSigning.cer"

# Optional but recommended chain install
certutil -addstore CA "C:\Users\<you>\Certificates\intermediateCA.crt"
certutil -addstore CA "C:\Users\<you>\Certificates\IntermediateCertificate1.crt"
certutil -addstore CA "C:\Users\<you>\Certificates\IntermediateCertificate2.crt"
certutil -addstore Root "C:\Users\<you>\Certificates\RootCertificate.crt"
```

4. Get certificate thumbprint from `CurrentUser\\My`:

```powershell
Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -like "*Kuamini Systems Private Limited*" } |
  Select-Object Subject, Thumbprint, HasPrivateKey, NotAfter
```

5. Sign MSI artifacts with SignTool (PIN prompt from YubiKey):

```powershell
$thumb = "<YOUR_THUMBPRINT>"
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

& $signtool sign /sha1 $thumb /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /v "public\tray\KuaminiSecurityClient-1.0.5.msi"
& $signtool sign /sha1 $thumb /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /v "public\tray\KuaminiSecurityClient-<account>.msi"
```

6. Sign PowerShell installer/uninstaller scripts (Authenticode):

```powershell
$thumb = "<YOUR_THUMBPRINT>"
$cert = Get-ChildItem Cert:\CurrentUser\My\$thumb

Set-AuthenticodeSignature -FilePath "public\tray\install-helper.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Set-AuthenticodeSignature -FilePath "public\tray\uninstall-kuamini-windows.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Set-AuthenticodeSignature -FilePath "uninstallers\uninstall-kuamini-windows.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Set-AuthenticodeSignature -FilePath "uninstallers\uninstall-kuamini-windows-robust.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Set-AuthenticodeSignature -FilePath "uninstallers\uninstall-kuamini-windows-v3.1.ps1" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
```

#### For EV Certificate (USB Token)

```powershell
# 1. Insert USB token
# 2. Enter PIN when prompted

# 3. Sign the executable
signtool sign `
  /n "Your Company Name" `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  /fd SHA256 `
  /v `
  "path\to\KuaminiSecurityClient.exe"

# Sign MSI installer
signtool sign `
  /n "Your Company Name" `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  /fd SHA256 `
  /v `
  "path\to\KuaminiSecurityClient-Installer.msi"
```

#### For Standard Certificate (.pfx file)

```powershell
# Sign with PFX certificate
signtool sign `
  /f "C:\path\to\certificate.pfx" `
  /p "YourCertificatePassword" `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  /fd SHA256 `
  /v `
  "path\to\KuaminiSecurityClient.exe"
```

#### Automated Signing Script

Create `sign-windows.ps1`:

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$CertificatePath,
    
    [Parameter(Mandatory=$false)]
    [string]$CertificatePassword,
    
    [Parameter(Mandatory=$false)]
    [string]$SubjectName
)

# Find signtool
$signtool = Get-Command signtool -ErrorAction SilentlyContinue
if (-not $signtool) {
    $sdkPaths = @(
        "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe",
        "C:\Program Files (x86)\Windows Kits\10\bin\*\x86\signtool.exe"
    )
    
    foreach ($pattern in $sdkPaths) {
        $found = Get-ChildItem $pattern -ErrorAction SilentlyContinue | 
                 Sort-Object -Descending | 
                 Select-Object -First 1
        if ($found) {
            $signtool = $found.FullName
            break
        }
    }
}

if (-not $signtool) {
    Write-Error "SignTool not found. Install Windows SDK."
    exit 1
}

Write-Host "Using SignTool: $signtool" -ForegroundColor Green

# Build signing command
$signArgs = @(
    "sign",
    "/tr", "http://timestamp.digicert.com",
    "/td", "SHA256",
    "/fd", "SHA256",
    "/v"
)

if ($CertificatePath) {
    # Standard certificate
    $signArgs += "/f", $CertificatePath
    if ($CertificatePassword) {
        $signArgs += "/p", $CertificatePassword
    }
} elseif ($SubjectName) {
    # EV certificate (USB token)
    $signArgs += "/n", $SubjectName
} else {
    Write-Error "Specify either -CertificatePath or -SubjectName"
    exit 1
}

$signArgs += $FilePath

# Execute signing
Write-Host "Signing: $FilePath" -ForegroundColor Cyan
& $signtool $signArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully signed: $FilePath" -ForegroundColor Green
} else {
    Write-Error "✗ Signing failed with exit code: $LASTEXITCODE"
    exit $LASTEXITCODE
}
```

**Usage:**

```powershell
# EV Certificate (USB token)
.\sign-windows.ps1 -FilePath "dist\KuaminiSecurityClient.exe" -SubjectName "Kuamini Systems Private Limited"

# Standard Certificate
.\sign-windows.ps1 -FilePath "dist\KuaminiSecurityClient.exe" -CertificatePath "cert.pfx" -CertificatePassword "password"
```

---

### Step 4: Verify Signature

```powershell
# Verify signature
signtool verify /pa /v "path\to\KuaminiSecurityClient.exe"

# Verify PowerShell script signature
Get-AuthenticodeSignature "path\to\install-helper.ps1" | Format-List Status,SignerCertificate,TimeStamperCertificate

# Check details in File Properties
# Right-click EXE → Properties → Digital Signatures tab
```

For this project, verify all signed Windows scripts:

```powershell
$targets = @(
  "public\tray\install-helper.ps1",
  "public\tray\uninstall-kuamini-windows.ps1",
  "uninstallers\uninstall-kuamini-windows.ps1",
  "uninstallers\uninstall-kuamini-windows-robust.ps1",
  "uninstallers\uninstall-kuamini-windows-v3.1.ps1"
)

foreach ($t in $targets) {
  if (Test-Path $t) {
    Get-AuthenticodeSignature $t | Select-Object Path, Status, SignerCertificate | Format-List
  }
}
```

**What to Look For:**
- ✅ Certificate shows your company name
- ✅ Timestamp is present (ensures signature validity after cert expires)
- ✅ "This digital signature is OK" message

---

### Step 5: Build SmartScreen Reputation (Standard Cert Only)

### Distribution Note (All Machines)

Signed artifacts are portable. Once MSI/PS1 files are signed and timestamped, the signature remains valid on any machine where the trust chain is recognized.

For broad compatibility across endpoints:
1. Always timestamp signatures.
2. Keep intermediate/root CA certificates current on managed endpoints.
3. Verify with `signtool verify` and `Get-AuthenticodeSignature` in CI or release checks.

**For Standard Certificates:**
- Initial distribution will show SmartScreen warning
- After ~2000+ downloads with no malware reports, warnings reduce
- After ~10,000+ downloads, warnings disappear
- Timeframe: 2-6 months typically

**Tips to Build Reputation:**
1. Submit to Microsoft for analysis: https://www.microsoft.com/en-us/wdsi/filesubmission
2. Encourage users to click "More info" → "Run anyway"
3. Distribute through trusted channels
4. Maintain consistent signing (same certificate)

---

## macOS Code Signing and Notarization (Apple)

### Prerequisites

**What You Need:**
- macOS development machine (10.13.6 or later)
- Apple Developer account ($99/year)
- Xcode and Command Line Tools
- Your built `.app` or `.pkg`

**Cost:**
- Apple Developer Program: $99/year

---

### Step 1: Join Apple Developer Program

1. **Sign up:**
   - Go to https://developer.apple.com/programs/
   - Click "Enroll"
   - Sign in with your Apple ID
   - Choose "Company/Organization" (requires D-U-N-S number)
   - Complete enrollment form
   - Pay $99/year fee

2. **D-U-N-S Number (for companies):**
   - Get free from: https://developer.apple.com/support/D-U-N-S/
   - Processing time: 5-10 business days
   - Required for company enrollment

3. **Approval:**
   - Enrollment review: 24-48 hours
   - Company verification: 3-7 business days

---

### Step 2: Create Certificates

#### A. Generate Certificate Signing Request (CSR)

```bash
# On your Mac:
# 1. Open "Keychain Access" app
# 2. Menu: Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority
# 3. Fill in:
#    - User Email: your@email.com
#    - Common Name: Your Company Name
#    - CA Email: Leave blank
#    - Request: "Saved to disk"
# 4. Save as: CertificateSigningRequest.certSigningRequest
```

#### B. Create Developer ID Certificate

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click "+" to create new certificate
3. Select **"Developer ID Application"** (for signing apps)
4. Upload your CSR file
5. Download the certificate (`.cer` file)
6. Double-click to install in Keychain

#### C. Create Installer Certificate (for PKG)

1. In same portal, click "+" again
2. Select **"Developer ID Installer"** (for signing PKG files)
3. Upload CSR
4. Download and install certificate

---

### Step 3: Install Xcode Command Line Tools

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
# Should show: /Library/Developer/CommandLineTools

# Verify codesign is available
which codesign
# Should show: /usr/bin/codesign
```

---

### Step 4: Find Your Signing Identity

```bash
# List all signing identities
security find-identity -v -p codesigning

# Output example:
# 1) ABC123... "Developer ID Application: Kuamini Systems Private Limited (TEAM123)"
# 2) DEF456... "Developer ID Installer: Kuamini Systems Private Limited (TEAM123)"

# Save the identity name for later
SIGNING_IDENTITY="Developer ID Application: Kuamini Systems Private Limited (TEAM123)"
```

---

### Step 5: Sign Your macOS Application

#### Sign .app Bundle

```bash
# Navigate to your app
cd agent-tray/dist

# Sign the app bundle
codesign --sign "Developer ID Application: Kuamini Systems Private Limited" \
  --force \
  --options runtime \
  --timestamp \
  --deep \
  --verbose \
  KuaminiSecurityClient.app

# Verify signature
codesign --verify --deep --strict --verbose=2 KuaminiSecurityClient.app
spctl --assess --verbose=4 --type execute KuaminiSecurityClient.app
```

#### Sign .pkg Installer

```bash
# Create PKG (if not already created)
pkgbuild --root KuaminiSecurityClient.app \
  --identifier com.kuamini.securityclient \
  --version 1.0.0 \
  --install-location /Applications \
  --sign "Developer ID Installer: Kuamini Systems Private Limited" \
  KuaminiSecurityClient-1.0.0.pkg

# Or sign existing PKG
productsign --sign "Developer ID Installer: Kuamini Systems Private Limited" \
  KuaminiSecurityClient-unsigned.pkg \
  KuaminiSecurityClient-signed.pkg
```

#### Automated Signing Script

Create `sign-macos.sh`:

```bash
#!/bin/bash

set -e

APP_PATH="$1"
SIGNING_IDENTITY="$2"

if [ -z "$APP_PATH" ] || [ -z "$SIGNING_IDENTITY" ]; then
    echo "Usage: $0 <app-path> <signing-identity>"
    echo "Example: $0 dist/MyApp.app 'Developer ID Application: Company Name'"
    exit 1
fi

if [ ! -e "$APP_PATH" ]; then
    echo "Error: App not found at $APP_PATH"
    exit 1
fi

echo "🔐 Signing $APP_PATH..."

# Sign the app with hardened runtime
codesign --sign "$SIGNING_IDENTITY" \
  --force \
  --options runtime \
  --timestamp \
  --deep \
  --verbose \
  "$APP_PATH"

echo "✓ Signed successfully"

# Verify signature
echo "📋 Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "✅ Signature verified"

# Check Gatekeeper assessment
echo "🛡️  Checking Gatekeeper..."
spctl --assess --verbose=4 --type execute "$APP_PATH" || true

echo "🎉 Code signing complete!"
```

**Usage:**

```bash
chmod +x sign-macos.sh
./sign-macos.sh "dist/KuaminiSecurityClient.app" "Developer ID Application: Kuamini Systems Private Limited"
```

---

### Step 6: Notarize with Apple

**Why Notarization?**
- Required for macOS 10.15+ (Catalina and later)
- Prevents "unidentified developer" warnings
- Apple scans for malware
- Users can install without right-click workaround

#### A. Create App-Specific Password

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Security → App-Specific Passwords → Generate
4. Enter name: "Notarization Tool"
5. Copy the 16-character password (e.g., `abcd-efgh-ijkl-mnop`)

#### B. Store Credentials in Keychain

```bash
# Store credentials securely
xcrun notarytool store-credentials "notarytool-profile" \
  --apple-id "your-email@example.com" \
  --team-id "TEAM123ABC" \
  --password "abcd-efgh-ijkl-mnop"

# Find your Team ID at: https://developer.apple.com/account
```

#### C. Create Notarization-Ready ZIP/DMG

```bash
# Option 1: Create ZIP
cd dist
ditto -c -k --keepParent KuaminiSecurityClient.app KuaminiSecurityClient.zip

# Option 2: Create DMG (recommended for distribution)
hdiutil create -volname "Kuamini Security Client" \
  -srcfolder KuaminiSecurityClient.app \
  -ov -format UDZO \
  KuaminiSecurityClient.dmg

# Sign the DMG
codesign --sign "Developer ID Application: Kuamini Systems Private Limited" \
  --timestamp \
  KuaminiSecurityClient.dmg
```

#### D. Submit for Notarization

```bash
# Submit ZIP or DMG
xcrun notarytool submit KuaminiSecurityClient.zip \
  --keychain-profile "notarytool-profile" \
  --wait

# Or submit PKG
xcrun notarytool submit KuaminiSecurityClient-1.0.0.pkg \
  --keychain-profile "notarytool-profile" \
  --wait

# Output shows:
# - Submission ID
# - Status (Accepted/Invalid/In Progress)
# - Processing time: 2-15 minutes typically
```

#### E. Check Notarization Status

```bash
# Check status manually
xcrun notarytool info <SUBMISSION_ID> \
  --keychain-profile "notarytool-profile"

# View notarization log
xcrun notarytool log <SUBMISSION_ID> \
  --keychain-profile "notarytool-profile"
```

#### F. Staple Notarization Ticket

```bash
# After notarization succeeds, staple the ticket
xcrun stapler staple KuaminiSecurityClient.app

# For DMG
xcrun stapler staple KuaminiSecurityClient.dmg

# For PKG
xcrun stapler staple KuaminiSecurityClient-1.0.0.pkg

# Verify stapling
xcrun stapler validate KuaminiSecurityClient.app
```

#### Complete Notarization Script

Create `notarize-macos.sh`:

```bash
#!/bin/bash

set -e

APP_PATH="$1"
BUNDLE_ID="$2"
PROFILE_NAME="${3:-notarytool-profile}"

if [ -z "$APP_PATH" ] || [ -z "$BUNDLE_ID" ]; then
    echo "Usage: $0 <app-path> <bundle-id> [profile-name]"
    echo "Example: $0 dist/MyApp.app com.company.myapp notarytool-profile"
    exit 1
fi

echo "📦 Creating distribution archive..."

# Create ZIP for notarization
ZIP_PATH="${APP_PATH%.*}.zip"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "✓ Created: $ZIP_PATH"

echo "🚀 Submitting for notarization..."

# Submit and wait
xcrun notarytool submit "$ZIP_PATH" \
  --keychain-profile "$PROFILE_NAME" \
  --wait

if [ $? -ne 0 ]; then
    echo "❌ Notarization failed"
    exit 1
fi

echo "✅ Notarization successful"

echo "📎 Stapling ticket..."

# Staple the ticket to the app
xcrun stapler staple "$APP_PATH"

echo "✓ Stapled successfully"

# Validate
echo "🔍 Validating..."
xcrun stapler validate "$APP_PATH"

echo "🎉 Notarization complete!"
echo "Your app is ready for distribution: $APP_PATH"

# Clean up ZIP
rm "$ZIP_PATH"
```

**Usage:**

```bash
chmod +x notarize-macos.sh
./notarize-macos.sh "dist/KuaminiSecurityClient.app" "com.kuamini.securityclient"
```

---

### Step 7: Verify Everything Works

```bash
# 1. Check code signature
codesign -dv --verbose=4 KuaminiSecurityClient.app

# 2. Check notarization
spctl -a -vvv -t install KuaminiSecurityClient.app

# 3. Verify stapled ticket
stapler validate KuaminiSecurityClient.app

# 4. Test Gatekeeper
# Copy app to another Mac or different folder
# Double-click to open
# Should open without warnings
```

---

## Common Issues & Troubleshooting

### Windows Issues

#### "SignTool not found"
```powershell
# Install Windows SDK
# Or add to PATH manually
$env:PATH += ";C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64"
```

#### "No certificates were found that met all criteria"
- Ensure certificate is installed in "Personal" store in Keychain
- For EV cert, ensure USB token is inserted
- Use `/n` with exact subject name from certificate

#### "Timestamp server unavailable"
```powershell
# Try alternative timestamp servers
/tr http://timestamp.sectigo.com
/tr http://timestamp.globalsign.com/?signature=sha2
/tr http://timestamp.comodoca.com
```

### macOS Issues

#### "No identity found"
```bash
# Re-download certificate from Apple Developer portal
# Double-click to install in Keychain
# Verify: security find-identity -v -p codesigning
```

#### "invalid signature (code or signature have been modified)"
```bash
# Clean and rebuild
rm -rf dist/
pyinstaller YourApp.spec --clean

# Sign again
codesign --sign "..." --force --options runtime --timestamp --deep dist/YourApp.app
```

#### Notarization "Invalid" status
```bash
# View detailed logs
xcrun notarytool log <SUBMISSION_ID> --keychain-profile "notarytool-profile"

# Common issues:
# - Missing hardened runtime: Add --options runtime
# - Unsigned nested frameworks
# - Invalid entitlements
```

#### "The executable does not have the hardened runtime enabled"
```bash
# Must include --options runtime when signing
codesign --sign "..." --options runtime ...
```

#### Gatekeeper still blocks after notarization
```bash
# Verify stapling
stapler validate YourApp.app

# If not stapled, staple manually
stapler staple YourApp.app

# Remove quarantine for testing (local only)
xattr -d com.apple.quarantine YourApp.app
```

---

## Integration with Build Pipeline

### Automated Windows Signing

Update your build script to sign automatically:

```powershell
# build-and-sign-windows.ps1
param(
    [string]$CertPath,
    [string]$CertPassword
)

# Build
Write-Host "Building..." -ForegroundColor Cyan
npm run build:agent:windows

# Sign
$exePath = "dist\KuaminiSecurityClient.exe"
if (Test-Path $exePath) {
    Write-Host "Signing..." -ForegroundColor Cyan
    signtool sign /f $CertPath /p $CertPassword `
      /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 `
      $exePath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Signed successfully" -ForegroundColor Green
    }
}
```

### Automated macOS Signing & Notarization

```bash
#!/bin/bash
# build-sign-notarize-macos.sh

set -e

SIGNING_IDENTITY="Developer ID Application: Your Company"
BUNDLE_ID="com.company.app"

# Build
echo "🔨 Building..."
npm run build:agent:macos

# Sign
echo "🔐 Signing..."
codesign --sign "$SIGNING_IDENTITY" \
  --force --options runtime --timestamp --deep \
  dist/YourApp.app

# Notarize
echo "🚀 Notarizing..."
ZIP_PATH="dist/YourApp.zip"
ditto -c -k --keepParent dist/YourApp.app "$ZIP_PATH"

xcrun notarytool submit "$ZIP_PATH" \
  --keychain-profile "notarytool-profile" \
  --wait

# Staple
echo "📎 Stapling..."
xcrun stapler staple dist/YourApp.app

# Verify
echo "✅ Verifying..."
spctl -a -vvv -t install dist/YourApp.app

echo "🎉 Build, sign, and notarization complete!"
```

---

## Best Practices

### Security
- ✅ Never commit certificates or passwords to git
- ✅ Use environment variables for sensitive data
- ✅ Rotate certificates before expiration
- ✅ Keep USB tokens (EV certs) physically secure

### Signing
- ✅ Always include timestamp server (ensures signature validity after cert expires)
- ✅ Use SHA256 hash algorithm (SHA1 is deprecated)
- ✅ Sign all executables, DLLs, and installers
- ✅ Verify signatures after signing

### Distribution
- ✅ Test installers on clean machines before release
- ✅ Keep signed installers in secure storage
- ✅ Document certificate details (expiration, issuer)
- ✅ Monitor SmartScreen reputation (Windows)

### Automation
- ✅ Store secrets in CI/CD secret management
- ✅ Automate signing in release pipeline
- ✅ Test signed builds before public release
- ✅ Keep build logs for audit

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| **Windows EV Certificate** | $400-600 | Annual |
| **Windows Standard Certificate** | $100-300 | Annual |
| **Apple Developer Program** | $99 | Annual |
| **D-U-N-S Number** | Free | One-time |
| **Total (EV + Apple)** | ~$500-700 | Annual |
| **Total (Standard + Apple)** | ~$200-400 | Annual |

---

## Certificate Renewal Checklist

### 30 Days Before Expiration:
- [ ] Purchase renewal from certificate provider
- [ ] Complete any required re-verification
- [ ] Update payment information

### 7 Days Before Expiration:
- [ ] Download new certificate
- [ ] Install in Keychain (macOS) or Certificate Store (Windows)
- [ ] Update signing scripts with new identity
- [ ] Test signing with new certificate

### Day of Expiration:
- [ ] Switch all builds to new certificate
- [ ] Archive old certificate securely
- [ ] Update documentation

---

## Quick Reference

### Windows Commands
```powershell
# Sign EXE
signtool sign /n "Company" /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 file.exe

# Verify
signtool verify /pa /v file.exe
```

### macOS Commands
```bash
# Sign app
codesign --sign "Developer ID Application: Company" --options runtime --timestamp --deep app.app

# Notarize
xcrun notarytool submit app.zip --keychain-profile "profile" --wait

# Staple
xcrun stapler staple app.app

# Verify
spctl -a -vvv -t install app.app
```

---

## Support Resources

**Windows:**
- Microsoft Code Signing: https://docs.microsoft.com/en-us/windows-hardware/drivers/install/code-signing-best-practices
- SignTool Documentation: https://docs.microsoft.com/en-us/windows/win32/seccrypto/signtool

**macOS:**
- Apple Developer: https://developer.apple.com/support/code-signing/
- Notarization Guide: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- Notarytool: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow

**Certificates:**
- DigiCert: https://www.digicert.com/support/
- Sectigo: https://sectigo.com/support

---

**Last Updated:** February 8, 2026  
**Document Version:** 1.0
