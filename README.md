# Kuamini Threat Protection Agent

**Status**: ✅ Production Ready | **Version**: 2.1 | **Last Updated**: February 8, 2026

Complete endpoint security solution with centralized management console and distributed desktop agents for Windows, macOS, and Linux.

[**📲 Get Started**](#quick-start) | [**📚 Documentation**](#complete-documentation) | [**🔧 Development**](#for-developers)

---

## Overview

Kuamini provides:
- ✅ **Multi-platform agents** (Windows, macOS, Linux)
- ✅ **Centralized management console** (web-based)
- ✅ **Real-time threat detection** and response
- ✅ **Enterprise-grade security** with minimal overhead
- ✅ **Automatic updates** and policy management
- ✅ **Compliance & audit** logging

---

## Quick Start

### For End Users / System Administrators

**1. Get Your Registration Token**
- Log into: https://kuaminisystems.com/securityAgent
- Navigate to: **Installers**
- Copy your registration token

**2. Install Agent** (copy entire line and paste into terminal)

**Windows** (PowerShell as Administrator):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'YOUR_TOKEN'"
```

**macOS** (Terminal):
```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-macos.sh) YOUR_TOKEN
```

**Linux** (Terminal):
```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-linux.sh) YOUR_TOKEN
```

**3. Verify in Console**
- Return to https://kuaminisystems.com/securityAgent
- Go to **Endpoints** tab
- Verify status shows **Online** (green)

➡️ **Full installation guide**: See [INSTALLATION.md](INSTALLATION.md)

---

## Complete Documentation

### 📖 Core Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| **[INSTALLATION.md](INSTALLATION.md)** | Windows/macOS/Linux setup, uninstall, verification | End users, IT teams, admins |
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | Local dev setup, testing, code signing, debugging | Developers, engineers |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production deployment, monitoring, operations | DevOps, infrastructure, ops |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System design, components, threat detection | Architects, tech leads |

### 🎯 Quick Reference by Role

**I'm an end user/admin installing agents:**
→ Start with [INSTALLATION.md](INSTALLATION.md)

**I'm a developer making code changes:**
→ Start with [DEVELOPMENT.md](DEVELOPMENT.md)

**I'm deploying to production:**
→ Start with [DEPLOYMENT.md](DEPLOYMENT.md)

**I need to understand the architecture:**
→ Start with [ARCHITECTURE.md](ARCHITECTURE.md)

---

## System Architecture

```
┌─────────────────────────────────────┐
│  Management Console (Web App)       │
│  https://kuaminisystems.com         │
│  (Vercel + Next.js + React)         │
└───────────────┬─────────────────────┘
                │ REST API
                ↓
┌─────────────────────────────────────┐
│  Backend API (Next.js Routes)       │
│  /api/agent/* endpoints             │
└───────────────┬─────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│  Supabase Database (PostgreSQL)     │
│  Endpoints, tokens, configs, logs   │
└─────────────────────────────────────┘
                ↑
                │ Heartbeat & Updates
                │
    ┌───────────┴───────────┬────────────┐
    ↓                       ↓            ↓
┌─────────┐          ┌──────────┐  ┌─────────┐
│ Windows │          │ macOS    │  │ Linux   │
│ Agent   │          │ Agent    │  │ Agent   │
└─────────┘          └──────────┘  └─────────┘
```

**Key Components:**
- **Frontend**: Next.js + React + TypeScript (modern UI, responsive)
- **Backend**: Next.js API routes (serverless, Vercel)
- **Database**: Supabase PostgreSQL (auto-backup, RLS security)
- **Agents**: Python + PyInstaller (cross-platform, lightweight)

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

---

## Features

### 🛡️ Security

- **Threat Detection**: Real-time malware, PUP, and behavior analysis
- **Policy Enforcement**: Centralized security policies
- **Compliance**: Audit logging, privacy controls
- **Code Signing**: All installers signed and authenticated
- **Encryption**: HTTPS for all communications, encrypted storage

### ⚙️ Management

- **Auto-update**: Agents automatically download updates
- **Remote Config**: Push configuration changes instantly
- **Licensing**: Tier-based license management
- **Reporting**: Threat statistics, compliance reports
- **Role-based Access**: Admin, manager, viewer roles

### 📊 Monitoring

- **Real-time Dashboard**: Endpoint status, threat counts
- **Alert System**: Email/webhook notifications
- **Audit Logs**: Complete activity history
- **Performance Metrics**: CPU, memory, scan efficiency
- **Threat Analytics**: Attack patterns, outbreak detection

---

## For Developers

### Development Environment Setup

```bash
# Clone repository
git clone https://github.com/kuamini/threat-protection-agent.git
cd threat-protection-agent

# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Run tests
pnpm test -- --run

# Full validation (lint + type-check + tests)
pnpm run validate
```

**Requirements:**
- Node.js v20.20.0+
- Python 3.11+ (for agent builds)
- pnpm v10.0.0+

➡️ **Full dev guide**: See [DEVELOPMENT.md](DEVELOPMENT.md)

### Project Structure

```
threat-protection-agent/
├── app/                   # Next.js frontend + API routes
│   ├── page.tsx          # Home page
│   ├── api/              # Backend endpoints
│   │   ├── agent/        # Agent-related endpoints
│   │   └── auth/         # Authentication endpoints
│   └── securityAgent/    # Security agent UI pages
├── components/           # React components
│   ├── ui/              # UI components (Radix UI)
│   ├── kuamini/         # Custom components
│   └── security-agent/  # Security features
├── agent-tray/          # Desktop agent (Python)
│   ├── main.py          # Agent entry point
│   ├── threat_detection/  # Threat detection engine
│   └── requirements.txt  # Python dependencies
├── lib/                 # Utilities, types, config
├── tests/               # Unit tests (Vitest)
├── public/              # Static assets, installers
└── scripts/             # Database migrations, seeds
```

### Common Development Tasks

```bash
# Start dev server
pnpm run dev

# Run specific test
pnpm test -- utils.test.ts

# Type check only
pnpm run type-check

# Fix linting issues
pnpm run lint:fix

# Build production
pnpm run build
pnpm run start

# Debug with console output
DEBUG=kuamini:* pnpm run dev
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for complete development guide.

---

## Installation by Platform

Quick links to platform-specific guides (all in [INSTALLATION.md](INSTALLATION.md)):

<details>
<summary><b>Windows (10+, Server 2016+)</b></summary>

```powershell
# One-line install
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex(New-Object System.Net.WebClient).DownloadString('https://kuaminisystems.com/tray/install-kuamini-windows-cli.ps1'); Main -Token 'YOUR_TOKEN'"
```

- Admin rights required
- ~50 MB disk space
- Runs automatically on startup
- System tray icon for status
- [Full Windows guide →](INSTALLATION.md#windows-installation)

</details>

<details>
<summary><b>macOS (10.15+)</b></summary>

```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-macos.sh) YOUR_TOKEN
```

- Place in Applications folder
- ~50 MB disk space
- LaunchAgent for auto-start
- Menu bar icon for status
- [Full macOS guide →](INSTALLATION.md#macos-installation)

</details>

<details>
<summary><b>Linux (Ubuntu 18+, CentOS 7+, Debian 10+)</b></summary>

```bash
bash <(curl -s https://kuaminisystems.com/tray/install-kuamini-linux.sh) YOUR_TOKEN
```

- Sudo access required
- ~50 MB disk space
- Systemd service for auto-start
- Tray icon (if supported)
- [Full Linux guide →](INSTALLATION.md#linux-installation)

</details>

---

## Deployment

### Development Workflow

```bash
git checkout -b feature/my-feature
# ... make changes ...
pnpm run validate    # ← Run before push!
git push origin feature/my-feature
# Create Pull Request
```

### Production Deployment

```bash
# In Vercel dashboard or via CLI:
vercel deploy --prod

# Verify deployment:
curl https://kuaminisystems.com/api/health
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Pre-deployment checklist
- Environment configuration
- Monitoring & alerting
- Incident response
- Backup & recovery

---

## System Requirements

### Windows Agent
- OS: Windows 10 (64-bit) or Windows Server 2016+
- RAM: 100 MB minimum
- Disk: 50 MB
- Network: HTTPS (port 443)

### macOS Agent
- OS: macOS 10.15 (Catalina) or later
- RAM: 100 MB minimum
- Disk: 50 MB
- Network: HTTPS (port 443)

### Linux Agent
- OS: Ubuntu 18.04+, CentOS 7+, Debian 10+
- RAM: 100 MB minimum
- Disk: 50 MB
- Network: HTTPS (port 443)

### Server Requirements (Self-Hosted)
- Node.js v20.x
- PostgreSQL 13+
- 2 GB RAM minimum
- HTTPS certificate

---

## Configuration

### Agent Configuration File

Located in:
- **Windows**: `%LOCALAPPDATA%\KuaminiSecurityClient\config.json`
- **macOS**: `~/.kuamini/config.json`
- **Linux**: `/etc/kuamini/config.json`

Example configuration:
```json
{
  "api_base_url": "https://kuaminisystems.com/api/agent",
  "heartbeat_interval": 60,
  "scan_interval": 3600,
  "log_level": "INFO",
  "enable_auto_start": true
}
```

### Environment Setup (Development)

```bash
# Copy example and configure
cp .env.example .env.local

# Edit with your settings
nano .env.local

# Required variables:
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_API_BASE_URL=https://...
INSTALLER_TOKEN_SECRET=...
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Agent won't start** | Check logs in %LOCALAPPDATA%, restart service |
| **"Invalid Token" error** | Get fresh token from console, ensure copied completely |
| **Agent offline in console** | Verify HTTPS access to kuaminisystems.com, check firewall |
| **High CPU usage** | Increase `scan_interval` in config.json |
| **TypeScript errors in dev** | Run `pnpm run type-check`, check imports |
| **Tests failing** | Run `pnpm install`, clear cache: `rm -rf .next` |

See [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md) for complete troubleshooting.

Also check [DEVELOPMENT.md](DEVELOPMENT.md#troubleshooting--common-issues) for dev-specific issues.

---

## API Reference

### Key Endpoints

All endpoints prefixed with: `https://kuaminisystems.com/api/agent`

**Agent Registration:**
```
POST /register
  Payload: { token, hostname, os, os_version }
  Returns: { endpoint_id, api_key, config }
```

**Heartbeat/Status:**
```
POST /heartbeat
  Payload: { agent_id, hostname, status, threats_count }
  Returns: { ok: true }
```

**Threat Report:**
```
POST /threat
  Payload: { agent_id, threat_data, timestamp }
  Returns: { ok: true }
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete API documentation.

---

## Security & Compliance

- ✅ **HTTPS Only**: All communications encrypted
- ✅ **Code Signing**: Windows MSI and PowerShell scripts signed
- ✅ **Token Expiration**: Registration tokens expire after 7 days
- ✅ **Rate Limiting**: API rate limits to prevent abuse
- ✅ **Data Encryption**: Sensitive data encrypted in transit and at rest
- ✅ **Audit Logging**: All actions logged for compliance
- ✅ **RLS Security**: Database row-level security enforced

See [THREAT_DETECTION_SAFETY.md](THREAT_DETECTION_SAFETY.md) for security details.

---

## Support & Contact

**Documentation:**
- 📖 [INSTALLATION.md](INSTALLATION.md) - Setup guide
- 🔧 [DEVELOPMENT.md](DEVELOPMENT.md) - Dev guide
- 🚀 [DEPLOYMENT.md](DEPLOYMENT.md) - Ops guide
- 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md) - System design

**Resources:**
- 🌐 [Web Console](https://kuaminisystems.com/securityAgent)
- 🐛 [Bug Reports](https://github.com/kuamini/threat-protection-agent/issues)
- 📧 [Email Support](mailto:support@kuaminisystems.com)
- 💬 [Community Discussions](https://github.com/kuamini/threat-protection-agent/discussions)

**Updates:**
- Follow [DEPLOMENT.md](DEPLOYMENT.md) for release notes
- Check GitHub releases for version history

---

## License

Kuamini Threat Protection Agent is released under the **Proprietary License**.

See LICENSE file for details.

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm run validate` to verify
5. Submit a pull request

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed contribution guidelines.

---

**✨ Built with Next.js, React, TypeScript, Supabase, and Python**

**Get Started**: [INSTALLATION.md](INSTALLATION.md) | **Develop**: [DEVELOPMENT.md](DEVELOPMENT.md) | **Deploy**: [DEPLOYMENT.md](DEPLOYMENT.md)
