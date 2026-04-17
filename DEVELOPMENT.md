# Development Guide

**Status**: ✅ Complete  
**Last Updated**: April 16, 2026  
**Version**: 2.0

Complete local development setup, code signing, testing, and troubleshooting guide.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Development Workflow](#development-workflow)
3. [Testing & Validation](#testing--validation)
4. [Code Signing](#code-signing)
5. [Debugging](#debugging)
6. [Troubleshooting & Common Issues](#troubleshooting--common-issues)

---

## Development Environment Setup

### System Requirements

- **Node.js**: v20.20.0 or higher
- **pnpm**: v10.0.0 or higher (package manager)
- **Python**: 3.11+ (for agent-tray builds)
- **Git**: Latest version
- **OS**: Windows, macOS, or Linux

### Verify Your Environment

```bash
# Check Node.js version
node --version      # Should be v20.20.0 or higher
npm --version       # Should be v10.8.2 or higher

# Check Python version (for agent builds)
python --version    # Should be 3.11+

# Check git
git --version
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/kuamini/threat-protection-agent.git
cd threat-protection-agent

# Install dependencies using pnpm
pnpm install

# Verify installation
pnpm run --help
```

### Node.js & pnpm Installation

**Windows (using Chocolatey):**
```powershell
choco install nodejs python
npm install -g pnpm
```

**macOS (using Homebrew):**
```bash
brew install node python pnpm
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install nodejs python3
npm install -g pnpm
```

---

## Development Workflow

### Git Workflow: Feature Branches

```bash
# 1. Start with main branch, ensure up-to-date
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name
# OR for bug fixes:
git checkout -b fix/bug-description

# 3. Make your changes
# Edit files...

# 4. Stage and commit
git add .
git commit -m "feat: add new feature"
# OR
git commit -m "fix: resolve issue"
# OR
git commit -m "docs: update documentation"
# OR
git commit -m "refactor: improve code structure"
```

### Development Server

```bash
# Start the Next.js development server
pnpm run dev

# Server runs at http://localhost:3000
# Hot reload enabled - changes appear immediately
```

### Running Tests During Development

```bash
# Watch mode (for TDD)
pnpm test -- --watch

# Run once
pnpm test -- --run

# With coverage report
pnpm test -- --coverage

# UI test runner (visual)
pnpm run test:ui
```

### Type Checking

```bash
# Check TypeScript types without building
pnpm run type-check

# Watch mode (continuous checking)
pnpm run type-check -- --watch
```

### Code Linting

```bash
# Check for linting issues
pnpm run lint

# Auto-fix fixable issues
pnpm run lint:fix
```

---

## Testing & Validation

### Quick Test (3-5 minutes)

Run before pushing to feature branch:

```bash
pnpm install
pnpm test -- --run
pnpm run type-check
```

**Success criteria:**
- ✅ All tests pass
- ✅ Zero TypeScript errors

### Full Validation (5-10 minutes) ⭐ RECOMMENDED

Run before creating pull request:

```bash
pnpm run validate
```

This runs:
1. ESLint (code style)
2. TypeScript (type checking)
3. Vitest (unit tests)

**Success criteria:**
- ✅ ESLint passes (warnings ok for intentional patterns)
- ✅ Zero TypeScript errors
- ✅ All tests pass

### Complete Test with Coverage (10-15 minutes)

```bash
# Install dependencies
pnpm install

# Run full validation
pnpm run validate

# Generate coverage report
pnpm test -- --coverage

# View coverage report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Test Organization

Tests are located in [tests/](tests/) directory with structure:

```
tests/
├── setup.ts                 # Test configuration
├── utils.test.ts           # Unit tests for utilities
└── [component].test.ts      # Component-specific tests
```

### Writing Tests

Example test using Vitest:

```typescript
import { describe, it, expect } from 'vitest';
import { formatEndpointStatus } from '@/lib/endpoint-status';

describe('formatEndpointStatus', () => {
  it('should format online status', () => {
    const result = formatEndpointStatus('online');
    expect(result).toBe('Online');
  });

  it('should format offline status', () => {
    const result = formatEndpointStatus('offline');
    expect(result).toBe('Offline');
  });
});
```

### Testing API Endpoints

```bash
# Start development server
pnpm run dev

# In another terminal, test endpoint
curl http://localhost:3000/api/health
```

---

## Code Signing

Code signing is required for production distribution to Windows and macOS. This prevents security warnings and builds user trust.

### Prerequisites

- Windows development machine
- Code signing certificate (EV or Standard)
- Windows SDK installed (for SignTool.exe)

### Windows Code Signing (Quick Reference)

#### Step 1: Obtain EV Code Signing Certificate

**Recommended providers:**
- DigiCert (https://www.digicert.com)
- Sectigo (https://sectigo.com)
- GlobalSign (https://www.globalsign.com)

**Why EV?**
- ✅ Instant SmartScreen reputation
- ✅ No "Unknown Publisher" warnings
- ✅ Higher user trust
- ❌ More expensive ($400-600/year)
- ❌ Requires hardware USB token

**Why Standard?**
- ✅ Cheaper ($100-300/year)
- ❌ Requires building reputation over time
- ❌ "Unknown Publisher" warnings initially

#### Step 2: Install Windows SDK

```powershell
# Download from:
# https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

# Or verify if already installed:
Get-Command signtool -ErrorAction SilentlyContinue

# Typical path:
# C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe
```

#### Step 3: Sign MSI (EV Certificate on YubiKey)

```powershell
# 1. Verify YubiKey is inserted
certutil -scinfo

# 2. Set certificate thumbprint and SignTool path
$thumb = "A601BE630D3BA76BC6ECD38CB3470770D16648D4"  # Your cert thumbprint
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

# 3. Sign MSI
& $signtool sign /sha1 $thumb /fd SHA256 /td SHA256 `
  /tr http://timestamp.digicert.com /v `
  "public\tray\KuaminiSecurityClient-1.0.5.msi"

# 4. Sign PowerShell scripts
$cert = Get-ChildItem Cert:\CurrentUser\My\$thumb
Set-AuthenticodeSignature -FilePath "public\tray\install-helper.ps1" `
  -Certificate $cert `
  -TimestampServer "http://timestamp.digicert.com"

# 5. Verify signature
& $signtool verify /pa /v "public\tray\KuaminiSecurityClient-1.0.5.msi"
Get-AuthenticodeSignature "public\tray\install-helper.ps1" | Format-List
```

#### Step 4: Sign PowerShell Scripts

```powershell
# Get certificate from store
$cert = Get-ChildItem Cert:\CurrentUser\My\<THUMBPRINT>

# Sign script
Set-AuthenticodeSignature -FilePath "script-path.ps1" `
  -Certificate $cert `
  -TimestampServer "http://timestamp.digicert.com"

# Verify
Get-AuthenticodeSignature "script-path.ps1" | Format-List Status,SignerCertificate
```

### macOS Code Signing

See [CODE_SIGNING_GUIDE.md](CODE_SIGNING_GUIDE.md) for detailed macOS code signing with Apple Developer ID.

### Building Installers

```bash
# Windows installer from repo root
pnpm run build:installer

# Windows installer with embedded registration token flow
pnpm run build:agent:token

# Cross-platform PyInstaller builds (run from agent-tray/)
cd agent-tray
pip install -r requirements.txt
pyinstaller KuaminiSecurityClient-win.spec
pyinstaller KuaminiSecurityClient-mac.spec
pyinstaller KuaminiSecurityClient-linux.spec
```

---

## Debugging

### Enable Debug Logging

**Development Server:**
```bash
DEBUG=kuamini:* pnpm run dev
```

**Test Mode:**
```bash
DEBUG=kuamini:* pnpm test -- --run
```

### Debug in VS Code

#### 1. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js Dev Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "args": ["./node_modules/.bin/next", "dev"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "args": ["run", "test", "--", "--run"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

#### 2. Set Breakpoints

Click on line number in editor to set breakpoint.

#### 3. Start Debugging

Press **F5** or select configuration in Debug view.

### Debug Agent Locally

**Windows:**
```powershell
# Run agent with debug logging
$env:DEBUG="kuamini:*"
& "C:\Program Files (x86)\Kuamini Security Client\KuaminiSecurityClient.exe"

# Monitor logs in real-time
Get-Content "$env:LOCALAPPDATA\KuaminiSecurityClient\agent.log" -Wait
```

**macOS:**
```bash
# Run with debug output
DEBUG=kuamini:* /Applications/KuaminiSecurityClient.app/Contents/MacOS/KuaminiSecurityClient

# Monitor logs
tail -f ~/.kuamini/agent.log
```

**Linux:**
```bash
# Run with debug output
DEBUG=kuamini:* /usr/bin/KuaminiSecurityClient

# Monitor logs
sudo tail -f /var/log/kuamini/agent.log
```

---

## Troubleshooting & Common Issues

### Common Issues & Solutions

#### TypeScript Errors on Startup

**Problem:** TypeScript errors prevent dev server from starting

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
pnpm install

# Run type check
pnpm run type-check
```

#### Tests Not Running

**Problem:** `pnpm test` fails with module errors

**Solution:**
```bash
# Ensure test setup is correct
cat tests/setup.ts

# Clear test cache
pnpm test -- --clearCache

# Run with verbose output
DEBUG=vitest:* pnpm test -- --run

# Check for circular dependencies
pnpm run lint
```

#### API Endpoints Not Responding

**Problem:** `curl http://localhost:3000/api/*` returns 404

**Solutions:**
1. Verify dev server is running: `pnpm run dev`
2. Check API route file exists in [app/api/](app/api/)
3. Verify route naming convention: `app/api/[route]/route.ts`
4. Check for TypeScript errors: `pnpm run type-check`
5. Restart dev server: `Ctrl+C` then `pnpm run dev`

#### Environment Variables Not Loaded

**Problem:** `NEXT_PUBLIC_*` variables undefined in browser

**Solution:**
```bash
# 1. Create .env.local (not committed)
cp .env.example .env.local

# 2. Add your variables
DATABASE_URL=postgresql://...
SESSION_SECRET=...

# 3. Restart dev server
# (Dev server reads env vars on startup)
```

#### Agent Won't Register Locally

**Problem:** Agent can't connect to local API

**Solution:**
```bash
# 1. Ensure dev server is running
pnpm run dev

# 2. Check API endpoint is accessible
curl http://localhost:3000/api/health

# 3. Update agent config to point to localhost
# Windows:
# Edit: %LOCALAPPDATA%\KuaminiSecurityClient\config.json
# Change: "api_base_url": "http://localhost:3000"

# 4. Restart agent
# (Agent reads config on startup)
```

#### Port 3000 Already in Use

**Problem:** Dev server won't start because port 3000 is taken

**Solution:**
```bash
# Option 1: Use different port
PORT=3001 pnpm run dev

# Option 2: Find and kill process using port 3000
# Windows:
netstat -ano | find ":3000"
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

### Getting Help

1. **Check logs**: Developer console (F12) or server logs
2. **Review error message**: Usually gives location of issue
3. **Search GitHub issues**: https://github.com/kuamini/threat-protection-agent/issues
4. **Check documentation**: See other markdown files in root
5. **Run diagnostics**: `pnpm run validate` to identify issues

### Debug Commands Reference

```bash
# Development
pnpm run dev                    # Start dev server
pnpm test -- --watch          # Run tests in watch mode
pnpm run type-check           # Check types
pnpm run lint                 # Run linter
pnpm run validate             # Full validation

# Testing
pnpm test -- --run            # Run tests once
pnpm run test:ui              # Visual test runner
pnpm test -- --coverage       # With coverage

# Code Signing
signtool sign /sha1 <thumb> /fd SHA256 ...  # Windows
codesign -s <identity> ...                   # macOS

# Building
pnpm run build                # Production build
pnpm run start                # Run production build locally
```

For detailed troubleshooting, use this guide's [Troubleshooting & Common Issues](#troubleshooting--common-issues) section.
