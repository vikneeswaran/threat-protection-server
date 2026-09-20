# Kuamini Threat Protection — Project Architecture Overview

> Scope: concise orientation for the two cooperating repositories as of **September 20, 2026**.
>
> Repositories: [threat-protection-server](https://github.com/vikneeswaran/threat-protection-server) and [threat-protection-agent](https://github.com/vikneeswaran/threat-protection-agent).

## 1. Product and repository boundaries

Kuamini Threat Protection is an endpoint-security platform. The **server repository** contains the web console, server-side APIs, authentication, database access, policy/threat workflows, and installer-generation endpoints. The **agent repository** contains the endpoint client that runs on customer devices, performs local security scans, communicates with the server, and produces Windows/macOS/Linux installation packages.

The high-level relationship is:

```text
Browser / Security Console
          │ HTTPS
          ▼
Next.js server + API routes ─────── PostgreSQL / AWS RDS
          ▲                                      │
          │ HTTPS registration, heartbeat,      │ policies, endpoints,
          │ scans, threats, actions              │ threats, audit data
          │                                      │
Endpoint Security Agent ◄──── installer download/token generation
(Windows/macOS/Linux)
```

## 2. Server repository

### Frontend

- **Framework:** Next.js with the App Router.
- **Language:** TypeScript and React.
- **UI:** Tailwind CSS, Radix UI primitives, Lucide icons, charts with Recharts, and form validation with React Hook Form plus Zod.
- **Application areas:** authentication pages, account/user administration, endpoint inventory, policies, threats, scans, installers, settings, and the security-agent console under `app/securityAgent`.
- **Client/server split:** Next.js server components and API route handlers are combined with client components for interactive dashboards, forms, menus, downloads, session timeout, and notifications.

### Backend and API

The backend is implemented inside Next.js using route handlers under `app/api`. It is not a separate Express service. Typical responsibilities include:

- Local account authentication, password hashing, email verification, password reset, server-side sessions, and inactivity logout.
- Account hierarchy, roles, licenses, profiles, endpoint lifecycle, policies, threat records, scan summaries, audit logs, and account settings.
- Agent APIs for registration, heartbeat, threat reporting, scan summaries, remote scan commands, threat-action commands, and deregistration.
- Account-specific Windows installer generation. The server packages the installer, writes a registration token/configuration, and returns a download archive.
- Input validation and authorization using session helpers, role checks, account ownership, and PostgreSQL row-level security/migration support.

Important server libraries include `pg` for PostgreSQL, `bcryptjs` for password hashing, `jsonwebtoken` for agent/installer tokens, `axios`/`requests-style HTTP integrations`, `nodemailer` for email, `archiver` and `adm-zip` for packages, and Vitest/Testing Library for tests.

### Database

The application uses **PostgreSQL**, accessed through a shared `pg.Pool` in `lib/db`. Production documentation describes **AWS RDS for PostgreSQL**; the application receives the connection string through `DATABASE_URL` (or local `POSTGRES_*` variables). Production SSL is enabled by the database client configuration.

Core data areas include:

- `app_users`, `app_sessions`, and email-verification token tables.
- `accounts`, `profiles`, license tiers, and account settings.
- `endpoints` and agent/installation instance records.
- `policies`, `threats`, threat actions, action policies, audit logs, scan summaries, and remote scan commands.

Database scripts create UUID/crypto extensions, indexes, triggers, account-license counters, default account settings, migrations, and row-level security policies. The data model is multi-tenant: most operational records are tied to `account_id`, and access is restricted to the user’s account or permitted descendant accounts.

## 3. Endpoint agent repository

### Runtime and client UI

- **Language:** Python 3.11 in the build pipeline.
- **Tray client:** `pystray` with Pillow-based status icons and notifications.
- **Networking:** `requests` over HTTPS.
- **Host inspection:** `psutil`, Python platform/socket APIs, and OS-specific process/network information.
- **Configuration/logging:** JSON configuration plus platform-specific files and logs. Windows uses `ProgramData`/`LOCALAPPDATA`; macOS and Linux use user data/log directories.
- **Packaging:** PyInstaller. Windows uses MSI/PowerShell packaging, macOS uses a `.pkg`, and Linux produces a tarball/onedir distribution. The CI workflow builds all three platforms using GitHub-hosted runners.

### Agent responsibilities

At startup the agent loads or creates configuration, obtains the registration token, creates an agent identity, and registers with the server. The registration response supplies/persists the account, endpoint, and installation-instance identifiers. The agent then sends periodic heartbeats containing identity, hostname, OS/version, local IP, MAC address, public IP, and agent version.

The `threat_detection` module provides:

- File-system scanning and hash/signature checks.
- Heuristic and pattern-based detection, including ransomware-style extensions.
- Process, resource, network, and Windows Registry monitoring.
- Quick, full, and real-time scan modes.
- Threat reporting and scan-summary reporting.
- Local remediation such as quarantine, kill, delete, restore, and allow/whitelist.

The agent polls the server for remote scan commands and threat-action commands, executes them locally, and reports completion/results. Server-delivered policies can change scan intervals, scan mode, real-time monitoring, and automatic remediation behavior.

## 4. End-to-end operational flow

1. An authenticated console user requests an installer.
2. The server validates the account and creates an account-specific package containing the installer, configuration, and a signed/validated registration token.
3. The customer installs the package on an endpoint.
4. The agent reads the token, calls the registration endpoint, and persists returned identifiers.
5. Heartbeats keep endpoint status current and deliver policies/update metadata.
6. The agent scans locally, reports threats and summaries, and executes approved actions.
7. The console reads PostgreSQL-backed data to display endpoint health, policies, scan history, threats, and remediation status.

## 5. AWS and delivery architecture

The documented production topology is:

- **AWS EC2:** Ubuntu 22.04, Node.js 20+, pnpm 10, and PM2. The Next.js application runs internally on port 3000 as `kuamini-prod`.
- **Reverse proxy:** nginx is optional/recommended for public HTTP/HTTPS termination and forwarding to localhost:3000.
- **AWS RDS:** PostgreSQL, private to the VPC/security-group design; production guidance recommends backups and Multi-AZ availability.
- **GitHub Actions:** pull-request quality gate runs lint, TypeScript checks, and tests. Deployment is intentionally manual (`workflow_dispatch`): the workflow connects to EC2 over SSH, pulls/builds the selected branch, and restarts PM2.
- **Secrets:** GitHub Actions/EC2 environment variables such as EC2 host/user/key, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and optional SMTP settings. Production secrets should remain outside Git and use restrictive file permissions.

## 6. Development, testing, and key considerations

Server local setup is Node.js 20+ with pnpm 10+: `pnpm install`, `pnpm dev`, then `pnpm lint`, `pnpm run type-check`, and `pnpm test`. Agent setup is a Python virtual environment followed by `pip install -r agent-tray/requirements.txt` and `python main.py`. Agent builds are manually dispatched through `.github/workflows/build-agents.yml`; artifacts are published under `public/tray`.

Primary integration risks to watch are token compatibility, endpoint/account identifiers, API base URL consistency, database migrations, installer version alignment, and secure handling of registration tokens. The repositories contain historical documentation for earlier agent versions, while the current agent build workflow declares version **1.0.44**; verify the workflow and generated artifacts when documenting or releasing a specific version.
