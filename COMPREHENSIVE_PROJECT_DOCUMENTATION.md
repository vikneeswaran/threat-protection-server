# Kuamini Threat Protection Agent — Comprehensive Project Documentation

**Project Name:** Kuamini Threat Protection Agent  
**Version:** 0.1.0  
**Organization:** Kuamini Systems Private Limited  
**Production Domain:** https://kuaminisystems.com  
**Repository:** https://github.com/vikneeswaran/threat-protection-agent  
**Documentation Date:** February 7, 2026  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Scope](#product-scope)
3. [System Architecture](#system-architecture)
4. [Core Capabilities](#core-capabilities)
5. [Technology Stack](#technology-stack)
6. [Repository Layout](#repository-layout)
7. [Data Model](#data-model)
8. [API Surface](#api-surface)
9. [Security Model](#security-model)
10. [Build & Release](#build--release)
11. [Deployment](#deployment)
12. [Operations & Observability](#operations--observability)
13. [Testing & Quality](#testing--quality)
14. [Installation & Lifecycle](#installation--lifecycle)
15. [Known Gaps & Roadmap](#known-gaps--roadmap)

---

## Executive Summary

Kuamini Threat Protection Agent is a multi-tenant endpoint security platform consisting of a web console (Next.js), a cross-platform endpoint agent (Python), and a managed PostgreSQL backend (Supabase). It provides centralized threat visibility, license management, policy enforcement, and endpoint lifecycle management for organizations of all sizes.

---

## Product Scope

**Primary objectives**
- Centralized endpoint visibility and status tracking.
- Threat reporting with severity and lifecycle actions.
- Policy management and assignment across endpoints.
- License allocation with hierarchical account structure.
- Audit logging for compliance and traceability.

**Primary user personas**
- Super Admin: Global multi-tenant administration.
- Admin: Account management, policy and threat management.
- Operator: Operational actions on threats and endpoints.
- Viewer: Read-only monitoring.

---

## System Architecture

**High-level components**
1. **Web Console (Next.js App Router)**
   - UI for dashboards, endpoints, threats, policies, users, and installers.
   - Authenticated via Supabase Auth.
2. **Backend API (Next.js API Routes)**
   - Agent registration, heartbeat, and threat reporting.
   - Installer script generation per OS.
3. **Endpoint Agent (Python tray app)**
   - Cross-platform (Windows, macOS, Linux).
   - Handles registration, heartbeats, and policy synchronization.
4. **Database (Supabase / PostgreSQL)**
   - Multi-tenant schema with RLS (Row Level Security).
   - Audit logging for compliance.

---

## Core Capabilities

### Account & License Management
- 5-level hierarchical account model.
- License allocation and tracking across sub-accounts.
- License tiers with limits, pricing, and support level metadata.

### Endpoint Management
- Registration with embedded account token.
- Persistent agent identifiers.
- Status tracking (online/offline/disconnected).
- Endpoint details and history.

### Threat Management
- Threat intake with severity and status lifecycle.
- Action workflows (quarantine/kill/allow/resolve).
- History views and analytics.

### Policy Management
- Policy types: real-time protection, scheduled scans, exclusions, actions, network protection, and device control.
- Assignments to endpoints with defaults and overrides.

### Audit & Compliance
- Immutable audit log of administrative actions.
- Filters by date, user, action, and entity.

---

## Technology Stack

**Frontend**
- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4 + shadcn/ui (Radix primitives)

**Backend**
- Next.js API Routes
- Supabase Client + SSR utilities

**Database**
- Supabase PostgreSQL with RLS

**Agent**
- Python 3.10+, PyInstaller, pystray, psutil, requests

**Testing**
- Vitest, React Testing Library

---

## Repository Layout

Top-level structure (partial):
- app/: Next.js App Router pages and API routes
- components/: UI and dashboard components
- lib/: shared utilities, Supabase clients, types
- agent-tray/: Python agent, build scripts, installers
- scripts/: SQL migrations
- public/: static assets and agent bundles
- tests/: UI and integration tests

See full tree in [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).

---

## Data Model

Key tables:
- license_tiers
- accounts
- profiles
- account_settings
- endpoints
- policies
- endpoint_policies
- threats
- threat_actions
- audit_logs
- license_allocations

Schema details are maintained in [scripts/](scripts/).

---

## API Surface

**Agent endpoints**
- POST /api/agent/register
- POST /api/agent/heartbeat
- POST /api/agent/threat
- GET /api/agent/installers/[os]

**Health**
- GET /api/health

---

## Security Model

- Supabase Auth for console users.
- Service role key for agent endpoints.
- RLS on all tenant data.
- Role-based access control for console actions.
- HTTPS enforced in production.

---

## Build & Release

**Web**
- pnpm install
- pnpm dev
- pnpm build
- pnpm start

**Agent**
- Platform-specific PyInstaller scripts under agent-tray/build
- Optional code signing for macOS and Windows

---

## Deployment

- Vercel hosting for web console and API routes.
- Supabase for database and auth.
- Static agent bundles served from public/tray/.

---

## Operations & Observability

- Agent logs stored per platform.
- Web console leverages server logs from Vercel.
- Audit logs provide traceability of key admin actions.

---

## Testing & Quality

- Vitest unit and UI tests.
- ESLint and TypeScript type checks.
- CI/CD workflows in .github/workflows (if enabled).

---

## Installation & Lifecycle

**Agent installation**
- OS-specific installer scripts generated from console.
- Registration token embeds account context.

**Lifecycle**
- Register → Heartbeat → Policy sync → Threat reporting.
- Uninstall paths for Windows/macOS/Linux provided in docs.

---

## Known Gaps & Roadmap

**In progress**
- Fully integrated threat scanning engine.
- Advanced analytics and reporting.

**Planned**
- MFA/SSO
- Webhooks and third-party integrations
- Mobile apps
- Enhanced policy automation

---

## References

- [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)
- [INSTALLER_GUIDE.md](INSTALLER_GUIDE.md)
- [BUILD_GUIDE.md](BUILD_GUIDE.md)
- [DEPLOY_V0.md](DEPLOY_V0.md)
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- [TESTING.md](TESTING.md)
