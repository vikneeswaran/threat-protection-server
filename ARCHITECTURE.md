# Kuamini Threat Protection Agent - Architecture Document

## Executive Summary

The Kuamini Threat Protection Agent is a comprehensive security solution consisting of a modern web-based management console and distributed endpoint security agents.
The system follows a client-server architecture with a cloud-hosted management platform and lightweight desktop agents deployed across Windows, macOS, and Linux endpoints.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kuamini Management Console                  │
│                      (Web Application)                          │
│                    Hosted on Vercel Platform                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑
              ┌─────────────────────────────┐
              │   REST API Layer            │
              │  (Next.js Route Handlers)   │
              └─────────────────────────────┘
                            ↓↑
              ┌─────────────────────────────┐
              │  Supabase Backend           │
              │ (PostgreSQL Database)       │
              └─────────────────────────────┘
                            ↓↑
    ┌──────────────────────────────────────────────────┐
    │         Distributed Desktop Agents               │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
    │  │ Windows  │  │  macOS   │  │  Linux   │       │
    │  │  Agent   │  │  Agent   │  │  Agent   │       │
    │  └──────────┘  └──────────┘  └──────────┘       │
    └──────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | Next.js | 16.0.7 |
| **React** | React | 19.2.0 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.1.9 |
| **Component Library** | Radix UI | Multiple (2024) |
| **Form Management** | React Hook Form | 7.60.0 |
| **Data Validation** | Zod | 3.25.76 |
| **Icons** | Lucide React | 0.454.0 |
| **State Management** | React Query / Context API | Latest |
| **Charts & Visualization** | Recharts | Latest |
| **UI Enhancements** | Radix UI, Shadcn/ui | Custom |

### 2.2 Frontend Development Environment

**Node.js Tooling:**
- **Runtime**: Node.js >=20.x
- **Package Manager**: pnpm >= 10.0.0
- **Dev Server**: Next.js dev server (hot reload)

**Development Scripts:**
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Code linting with ESLint
npm run test         # Run tests with Vitest
npm run test:ui      # Visual test runner
npm run type-check   # TypeScript type checking
npm run validate     # Full validation (lint + type check + tests)
```

### 2.3 Frontend Folder Structure

```
app/
├── page.tsx                    # Home page
├── layout.tsx                  # Root layout with theme provider
├── globals.css                 # Global styles
├── about/                      # About page
├── contact/                    # Contact page
├── api/                        # Backend API routes
│   ├── agent/                  # Agent-related endpoints
│   ├── auth/                   # Authentication endpoints
│   └── health/                 # Health check endpoint
├── securityAgent/              # Security agent UI pages
└── services/                   # Service components

components/
├── ui/                         # Reusable UI components (Radix UI based)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── form.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   └── [other-components]/
├── kuamini/                    # Custom Kuamini components
│   ├── header.tsx
│   ├── footer.tsx
│   ├── navigation.tsx
│   └── [page-components]/
├── security-agent/             # Security agent specific components
├── endpoint-tray-ui.tsx        # Agent tray UI
└── theme-provider.tsx          # Theme/dark mode provider

lib/
├── config.ts                   # Configuration (API URLs, agent settings)
├── utils.ts                    # Utility functions
├── supabase/
│   ├── admin.ts               # Supabase admin client
│   ├── client.ts              # Supabase client-side client
│   ├── proxy.ts               # Proxy client
│   └── server.ts              # Server-side client
└── types/                      # TypeScript type definitions

public/
├── icon.svg                    # Application icon
├── apple-icon.png
└── [other-assets]/             # Images and static assets

styles/
└── globals.css                 # Tailwind CSS configuration
```

### 2.4 Frontend Build & Deployment

**Build System:**
- Next.js with Turbopack for fast builds
- TypeScript strict mode enabled
- Image optimization disabled (unoptimized: true)
- ESM module system

**Deployment:**
- **Platform**: Vercel
- **Configuration**: vercel.json
- **Build Command**: `pnpm run build`
- **Install Command**: `pnpm install --frozen-lockfile`
- **Start Command**: `next start`

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
NEXT_PUBLIC_SUPABASE_REDIRECT_URL=<url>
NEXT_PUBLIC_API_BASE_URL=https://kuaminisystems.com/api/agent
SUPABASE_SERVICE_ROLE_KEY=<key>
INSTALLER_TOKEN_SECRET=<secret>
DEBUG_REGISTRATION=true|false
NODE_ENV=production|development
```

---

## 3. Backend Architecture

### 3.1 Backend Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | Next.js API Routes | 16.0.7 |
| **Runtime** | Node.js (Serverless on Vercel) | 20.x+ |
| **Language** | TypeScript | 5.x |
| **Database Client** | Supabase JS Client & Admin SDK | Latest |
| **Authentication** | Supabase Auth | Built-in |
| **Validation** | Zod | 3.25.76 |

### 3.2 Backend Architecture Pattern

The backend follows a **serverless architecture** with Next.js API Routes deployed on Vercel:

```
API Request → Vercel Edge Network → Next.js Route Handler → Supabase
```

### 3.3 API Structure

**Base URL**: `https://kuaminisystems.com/api/agent`

**API Endpoints:**

#### Agent Management
```
POST   /api/agent/register          # Register new endpoint
POST   /api/agent/heartbeat         # Agent heartbeat/status update
POST   /api/agent/threat            # Threat detection report
POST   /api/agent/deregister        # Deregister endpoint

GET    /api/agent/download          # Download agent/updates
POST   /api/agent/installers        # Get installer info
```

#### Authentication
```
POST   /api/auth/register-existing  # Register existing account
```

#### Health Check
```
GET    /api/health                  # API health & env check
```

### 3.4 API Route Handlers

**File Location**: `app/api/[module]/[endpoint]/route.ts`

**Key Features:**
- **Request Handling**: JSON body parsing with error recovery
- **Token Validation**: JWT signature verification with HMAC-SHA256
- **Admin Access**: Uses Supabase service role for elevated privileges
- **Error Handling**: Detailed error responses (debug mode optional)
- **Type Safety**: Full TypeScript support
- **Concurrent Requests**: Stateless serverless functions

**Example: Agent Registration Flow**

```typescript
// POST /api/agent/register
1. Parse JSON request body
2. Extract: token, hostname, os, os_version, agent_version, agent_id
3. Verify registration token (JWT or base64 format)
4. Decode token to get account_id
5. Check for existing endpoint (by agent_id or hostname+mac)
6. Insert/Update endpoint record in Supabase
7. Log audit trail
8. Return endpoint_id
```

### 3.5 Request/Response Examples

**Register Endpoint Request:**
```json
{
  "token": "eyJhY2NvdW50SWQiOiAidXNlcl8xMjMifQ.signature",
  "hostname": "DESKTOP-ABC123",
  "os": "Windows",
  "os_version": "11",
  "agent_version": "1.0.0",
  "agent_id": "agent-uuid-123",
  "ip_address": "192.168.1.100",
  "mac_address": "00:11:22:33:44:55"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Endpoint registered",
  "endpoint_id": "endpoint-uuid-456"
}
```

---

## 4. Database Architecture

### 4.1 Database Technology

| Component | Technology | Details |
|-----------|-----------|---------|
| **DBMS** | PostgreSQL | Managed via Supabase |
| **Hosting** | Supabase Cloud | Auto-scaling, backups, replication |
| **Authentication** | Supabase Auth | Row-level security (RLS) |
| **Real-time** | Supabase Realtime | Websocket subscriptions |

### 4.2 Database Schema

**Core Tables:**

#### 1. `accounts` - Organization/Account Management
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE,
  is_active BOOLEAN DEFAULT true,
  subscription_tier VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `endpoints` - Registered Devices/Agents
```sql
CREATE TABLE endpoints (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  agent_id UUID UNIQUE,
  hostname VARCHAR NOT NULL,
  os VARCHAR,              -- Windows, macOS, Linux
  os_version VARCHAR,
  agent_version VARCHAR,
  ip_address INET,
  mac_address MACADDR,
  status VARCHAR,          -- online, offline, warning
  last_seen_at TIMESTAMP,
  registered_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, hostname, mac_address)
);
```

#### 3. `threats` - Detected Threats/Alerts
```sql
CREATE TABLE threats (
  id UUID PRIMARY KEY,
  endpoint_id UUID REFERENCES endpoints(id),
  threat_type VARCHAR,     -- malware, suspicious, warning
  threat_details JSONB,
  file_path VARCHAR,
  severity VARCHAR,        -- critical, high, medium, low
  resolved BOOLEAN DEFAULT false,
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

#### 4. `audit_logs` - Action Tracking
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  action VARCHAR,          -- endpoint_registered, threat_detected, etc.
  entity_type VARCHAR,     -- endpoint, threat, account
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 5. `agent_versions` - Version Management
```sql
CREATE TABLE agent_versions (
  id UUID PRIMARY KEY,
  version VARCHAR UNIQUE,
  os_type VARCHAR,         -- Windows, macOS, Linux
  download_url VARCHAR,
  checksum VARCHAR,
  release_notes TEXT,
  is_stable BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.3 Row-Level Security (RLS)

- Accounts can only access their own endpoints
- Users can only see threats/logs for their account
- Service role key bypasses RLS (server-side operations)

### 4.4 Supabase Client Configuration

**Admin Client** (Server-side, bypasses RLS):
```typescript
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Public Client** (Client-side, respects RLS):
```typescript
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

---

## 5. Agent Desktop Application Architecture

### 5.1 Agent Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Language** | Python 3.x | Cross-platform compatibility |
| **UI Framework** | pystray | System tray icon & menu |
| **HTTP Client** | requests | API communication |
| **System Monitoring** | psutil | Process and system monitoring |
| **Image Processing** | Pillow (PIL) | Tray icon rendering |
| **Packaging** | PyInstaller | Executable bundling |

### 5.2 Agent Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│    Kuamini Security Client (Desktop Agent)       │
│                                                  │
│  ┌─ System Tray UI ────────────────────────┐   │
│  │ • Real-time status indicator            │   │
│  │ • Context menu (settings, dashboard)    │   │
│  │ • Alerts & notifications                │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌─ Core Services ──────────────────────────┐   │
│  │ • Threat engine                          │   │
│  │ • File system scanner                    │   │
│  │ • Memory monitor                         │   │
│  │ • Network security                       │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌─ Communication Layer ─────────────────────┐  │
│  │ • Heartbeat service (60s interval)       │  │
│  │ • Threat reporting                       │  │
│  │ • Command & control                      │  │
│  │ • Certificate/CA bundle management       │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
           ↓↑
    ┌──────────────────┐
    │ Management API   │
    │  (HTTPS)         │
    └──────────────────┘
```

### 5.3 Agent Directory Structure

```
agent-tray/
├── main.py                              # Main application entry point
├── requirements.txt                     # Python dependencies
├── config.json                          # Agent configuration
├── config.example.json                  # Configuration template
├── generate_config.py                   # Config generation utility
│
├── build/
│   ├── create-installer.ps1            # PowerShell installer builder
│   └── [build-artifacts]/
│
├── dist/
│   ├── KuaminiSecurityClient.exe       # Windows executable
│   ├── KuaminiSecurityClient-mac       # macOS executable
│   └── KuaminiSecurityClient-linux     # Linux executable
│
├── KuaminiSecurityClient.spec          # PyInstaller spec (universal)
├── KuaminiSecurityClient-win.spec      # PyInstaller spec (Windows)
├── KuaminiSecurityClient-mac.spec      # PyInstaller spec (macOS)
└── KuaminiSecurityClient-linux.spec    # PyInstaller spec (Linux)
```

### 5.4 Agent Dependencies

**From requirements.txt:**
```
pystray==0.19.4          # System tray integration
requests==2.31.0         # HTTP client for API calls
psutil==5.9.8           # System monitoring
Pillow>=10.0.0          # Image processing for tray icon
```

### 5.5 Agent Configuration

**config.json Structure:**
```json
{
  "api_base_url": "https://kuaminisystems.com/api/agent",
  "heartbeat_interval": 60,
  "scan_interval": 3600,
  "agent_id": "generated-uuid",
  "registration_token": "token-from-installer",
  "enable_auto_start": true,
  "log_level": "INFO"
}
```

### 5.6 Key Agent Features

**System Integration:**
- Singleton enforcement (only one instance running)
- Auto-start on Windows/macOS/Linux
- System tray integration with status indicator
- Windows Registry integration for auto-launch
- Cross-platform log file storage

**Communication:**
- HTTPS with certificate bundle verification
- Heartbeat every 60 seconds
- Full system threat scanning every 1 hour
- Token-based and token-less registration modes
- Graceful error handling and retry logic

**Security:**
- CA bundle configuration for SSL/TLS verification
- Token signature verification (HMAC-SHA256)
- Encrypted configuration storage
- Audit logging of all operations

### 5.7 Agent Deployment

**For Windows:**
```powershell
# Build installer
npm run build:installer

# Or with registration token
npm run build:agent:token

# Creates: KuaminiSecurityClient-Installer.exe
```

**For macOS:**
```bash
# Package as DMG or app bundle
pyinstaller KuaminiSecurityClient-mac.spec
```

**For Linux:**
```bash
# Package as tar.gz or rpm/deb
pyinstaller KuaminiSecurityClient-linux.spec
```

### 5.8 Agent Lifecycle

```
1. Installation
   ├── Extract agent binary
   ├── Create config file
   ├── Register with management server
   └── Add to system auto-start

2. Startup
   ├── Check for existing instance (singleton)
   ├── Load configuration
   ├── Initialize system monitoring
   ├── Create system tray icon
   └── Start heartbeat service

3. Runtime
   ├── Monitor system continuously
   ├── Send heartbeat every 60s
   ├── Run full scans every 1h
   ├── Report threats immediately
   └── Listen for management commands

4. Shutdown
   ├── Stop monitoring services
   ├── Upload final status
   ├── Clean up resources
   └── Optionally uninstall
```

---

## 6. Frontend-Backend Interaction Flow

### 6.1 Agent Registration Flow

```
┌─────────────────────────────────────────┐
│  Desktop Agent (Installer)              │
│  - Collects system info                 │
│  - Has registration token               │
└──────────────┬──────────────────────────┘
               │
               │ POST /api/agent/register
               │ { token, hostname, os, ... }
               │
               ↓
┌──────────────────────────────────────────┐
│  Next.js API Handler                    │
│  - Validate token (JWT or base64)       │
│  - Decode to get account_id             │
│  - Check duplicate endpoints            │
└──────────────┬──────────────────────────┘
               │
               │ Supabase Query
               │ SELECT/INSERT endpoints
               │
               ↓
┌──────────────────────────────────────────┐
│  Supabase PostgreSQL                    │
│  - Create/update endpoint record        │
│  - Return endpoint_id                   │
│  - Log audit event                      │
└──────────────┬──────────────────────────┘
               │
               │ Response with endpoint_id
               │
               ↓
┌──────────────────────────────────────────┐
│  Desktop Agent                          │
│  - Store endpoint_id locally            │
│  - Save configuration                   │
│  - Start heartbeat service              │
└──────────────────────────────────────────┘
```

### 6.2 Threat Detection & Reporting Flow

```
┌─────────────────────────────────────────┐
│  Desktop Agent                          │
│  - File system scan                     │
│  - Threat detected!                     │
└──────────────┬──────────────────────────┘
               │
               │ POST /api/agent/threat
               │ { endpoint_id, threat_data, ... }
               │
               ↓
┌──────────────────────────────────────────┐
│  Next.js API Handler                    │
│  - Validate endpoint_id                 │
│  - Parse threat details                 │
│  - Determine severity                   │
└──────────────┬──────────────────────────┘
               │
               │ Supabase Mutation
               │ INSERT threats table
               │
               ↓
┌──────────────────────────────────────────┐
│  Supabase PostgreSQL                    │
│  - Store threat record                  │
│  - Update endpoint status                │
│  - Trigger realtime alert               │
│  - Log audit event                      │
└──────────────┬──────────────────────────┘
               │
               │ Realtime Webhook
               │
               ↓
┌──────────────────────────────────────────┐
│  Management Console (Web UI)            │
│  - Real-time threat notification        │
│  - Dashboard update                     │
│  - Alert to user                        │
└──────────────────────────────────────────┘
```

### 6.3 Heartbeat Service Flow

```
Agent Startup
     │
     ├─ Interval Timer (60 seconds)
     │
     └─ Every cycle:
        ├─ Collect system status
        ├─ DNS/Network connectivity check
        ├─ POST /api/agent/heartbeat
        │  { endpoint_id, status, uptime, ... }
        │
        ├─ Server validates endpoint
        ├─ Update last_seen_at
        ├─ Set status = "online"
        │
        └─ Continue interval
```

---

## 7. Data Flow Architecture

### 7.1 Component Communication Matrix

| Component | Target | Protocol | Method | Data Type |
|-----------|--------|----------|--------|-----------|
| Web Browser | Next.js API | HTTPS | REST (JSON) | JSON |
| Desktop Agent | Next.js API | HTTPS | REST (JSON) | JSON |
| Next.js API | Supabase | Direct SQL | Supabase Client | SQL/Realtime |
| Dashboard | Database | WebSocket | Realtime Sub | Events |
| Admin Console | Supabase Auth | HTTPS | JWT | Token |

### 7.2 Authentication & Authorization

**Frontend Authentication:**
- Supabase Auth (email/password)
- JWT tokens stored in browser
- Row-level security on database

**Agent Authentication:**
- Registration token (JWT or base64)
- Account association via token
- Agent ID for subsequent calls

**API Authorization:**
- Service role key for admin operations
- User session validation
- Endpoint ownership verification

---

## 8. Environment & Infrastructure

### 8.1 Development Environment

```
Local Machine
├─ Node.js 20+
├─ pnpm 10+
├─ TypeScript 5
├─ IDE: VS Code
└─ Git for version control
```

**Local Development Servers:**
- Frontend: `localhost:3000` (Next.js dev server)
- API: `localhost:3000/api/*` (built into Next.js)
- Database: Supabase remote (cloud instance)

### 8.2 Production Environment

```
├─ Frontend & API: Vercel (Serverless)
├─ Database: Supabase (PostgreSQL on AWS)
├─ Domain: kuaminisystems.com
├─ CDN: Vercel Edge Network
└─ Storage: Supabase Object Storage (for installers)
```

### 8.3 Deployment Pipeline

```
1. Code Commit (Git)
   ↓
2. GitHub/Git Hook
   ↓
3. Vercel Auto-Deploy
   ├─ Install: pnpm install --frozen-lockfile
   ├─ Build: pnpm run build
   ├─ Type Check: tsc --noEmit
   └─ Lint: eslint .
   ↓
4. Deployment
   ├─ Next.js compilation
   ├─ API route bundling
   ├─ Static asset optimization
   └─ Deploy to edge network
   ↓
5. Live on Production
   └─ https://kuaminisystems.com
```

### 8.4 Environment Variables

**Frontend (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
NEXT_PUBLIC_SUPABASE_REDIRECT_URL=https://kuaminisystems.com
NEXT_PUBLIC_API_BASE_URL=https://kuaminisystems.com/api/agent
```

**Backend (.env.local):**
```
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
INSTALLER_TOKEN_SECRET=your-secret-key
DEBUG_REGISTRATION=false
NODE_ENV=production
```

---

## 9. Technology Summary

### 9.1 Frontend Stack
- **Framework**: Next.js 16.0.7 (React 19.2.0)
- **Language**: TypeScript 5.x ES2020
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI, Shadcn/ui
- **Build Tool**: Turbopack
- **Package Manager**: pnpm 10.x
- **Testing**: Vitest
- **Linting**: ESLint 9.x, TypeScript ESLint

### 9.2 Backend Stack
- **Runtime**: Node.js 20+ (Serverless on Vercel)
- **Framework**: Next.js 16.0.7 (API Routes)
- **Language**: TypeScript
- **Database ORM**: Supabase Client
- **Validation**: Zod
- **Authentication**: Supabase Auth with JWT

### 9.3 Database Stack
- **DBMS**: PostgreSQL 15+
- **Provider**: Supabase
- **Client**: Supabase JS SDK
- **Features**: RLS, Realtime, Auth, Storage

### 9.4 Desktop Agent Stack
- **Language**: Python 3.x
- **UI**: pystray (system tray)
- **HTTP**: requests library
- **System Monitoring**: psutil
- **Packaging**: PyInstaller
- **Supported OS**: Windows, macOS, Linux

### 9.5 DevOps Stack
- **Hosting**: Vercel
- **Database**: Supabase Cloud
- **Version Control**: Git
- **CI/CD**: Vercel Auto-Deploy
- **Monitoring**: Vercel Analytics

---

## 10. Security Architecture

### 10.1 Security Layers

```
┌────────────────────────────────────────┐
│  Transport Security (HTTPS/TLS)        │
│  - SSL/CA certificate verification     │
│  - Encrypted data in transit           │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│  Application Security                  │
│  - JWT token validation                │
│  - HMAC-SHA256 signature verification  │
│  - Rate limiting (Vercel)              │
│  - Input validation (Zod)              │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│  Database Security                     │
│  - Row-Level Security (RLS)            │
│  - Column-level encryption             │
│  - Audit logging                       │
│  - Service role separation             │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│  Agent Security                        │
│  - Token-based authentication          │
│  - CA bundle verification              │
│  - Configuration encryption            │
│  - Singleton enforcement               │
└────────────────────────────────────────┘
```

### 10.2 Secret Management

- API keys in environment variables
- Database credentials in Supabase vault
- Token secret for installer tokens
- Never committed to git (via .gitignore)

---

## 11. API Specification

### 11.1 Base Configuration

```typescript
// lib/config.ts
export const config = {
  productionDomain: "https://kuaminisystems.com",
  basePath: "/securityAgent",
  getApiBaseUrl: () => 
    process.env.NEXT_PUBLIC_API_BASE_URL || 
    `${config.productionDomain}/api/agent`
}
```

### 11.2 Endpoint Details

**Health Check:**
```
GET /api/health
Response: { ok: boolean, env: {...}, missing: [...] }
```

**Agent Registration:**
```
POST /api/agent/register
Body: { token, hostname, os, os_version, agent_version, agent_id, ip_address, mac_address }
Response: { success: boolean, endpoint_id: uuid }
```

**Heartbeat:**
```
POST /api/agent/heartbeat
Body: { endpoint_id, status, last_scan_time, threat_count }
Response: { success: boolean, timestamp: ISO8601 }
```

**Threat Reporting:**
```
POST /api/agent/threat
Body: { endpoint_id, threat_type, severity, file_path, details }
Response: { success: boolean, threat_id: uuid }
```

---

## 12. Performance Optimization

### 12.1 Frontend Optimizations

- **Next.js Image Optimization**: Custom configuration
- **Code Splitting**: Automatic route-based splitting
- **Caching**: Vercel edge caching for static assets
- **TypeScript**: Strict mode for compile-time safety
- **Tree Shaking**: Unused code elimination via ESBuild

### 12.2 Backend Optimizations

- **Serverless**: Automatic scaling with Vercel
- **Database Indexing**: On account_id, endpoint_id, status
- **Connection Pooling**: Supabase managed
- **Realtime Subscriptions**: Efficient websocket connections
- **RLS Policies**: Efficient row filtering

### 12.3 Agent Optimizations

- **Lazy Loading**: Services load on demand
- **Interval Optimization**: 60s heartbeat, 1h scans
- **Memory Efficient**: psutil for lightweight monitoring
- **Network Efficient**: Batch threat reporting

---

## 13. Scalability Architecture

### 13.1 Horizontal Scaling

**Frontend:**
- Vercel auto-scaling across global regions
- CDN edge caching for static assets
- Automatic load balancing

**Backend:**
- Serverless functions scale automatically
- Each request is independent and stateless
- Database connection pooling via Supabase

**Database:**
- PostgreSQL managed by Supabase
- Automatic replication and failover
- Read replicas for reporting queries

**Agents:**
- Distributed client architecture
- No agent-to-agent communication
- Scales with number of endpoints

### 13.2 Performance Metrics

- **Time to First Byte**: <100ms (Vercel Edge)
- **Database Query**: <50ms (indexed queries)
- **Agent Heartbeat**: <1s (HTTPS)
- **Threat Detection**: Real-time (within scan interval)

---

## 14. Integration Points

### 14.1 Third-Party Services

- **Supabase**: Database, Auth, Storage
- **Vercel**: Hosting, Deployment, Analytics
- **Google Fonts**: Geist font family (via next/font)
- **Vercel Analytics**: Usage tracking

### 14.2 External APIs

- Threat intelligence feeds (extensible)
- System notification services
- Email service (for alerts)

---

## 15. Development Workflow

### 15.1 Code Organization

**Type-Safe Development:**
- Full TypeScript for all code
- Strict mode enabled
- Zod validators for runtime safety
- Path aliases (@/* for imports)

**Component Pattern:**
- Server components by default (Next.js 16)
- Client components where needed
- Provider pattern for context

**API Development:**
- Route handlers in app/api
- Type-safe request/response
- Middleware for validation

### 15.2 Testing Strategy

```bash
# Unit tests
npm run test

# Test coverage
npm run test:coverage

# Visual test UI
npm run test:ui

# Watch mode
npm run test:watch
```

### 15.3 Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix

# Validation (all checks)
npm run validate
```

---

## 16. Known Limitations & Future Enhancements

### 16.1 Current Limitations

- Agent updates require manual installation
- No peer-to-peer agent communication
- Single Supabase deployment region
- Limited threat intelligence integration

### 16.2 Planned Enhancements

- Automatic agent updates via API
- Advanced threat analytics dashboard
- Machine learning threat detection
- Multi-region Supabase deployments
- Agent clustering for large deployments
- Mobile management app (React Native)

---

## 17. Documentation References

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **Radix UI Docs**: https://www.radix-ui.com/docs

---

## Appendix A: Configuration Files Reference

### A.1 package.json
- Defines all npm dependencies
- Scripts for development, build, testing
- Engine requirements (Node 20+, pnpm 10+)

### A.2 next.config.mjs
- Turbopack configuration
- TypeScript error handling
- Image optimization settings
- Dev indicators disable

### A.3 tsconfig.json
- Strict type checking
- ES2020 target
- Path aliases for imports
- JSX configuration

### A.4 API Config (lib/config.ts)
- API base URL configuration
- Agent heartbeat interval (60s)
- Agent scan interval (3600s)
- Agent version number

---

## Appendix B: API Response Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (no access) |
| 404 | Not found |
| 500 | Server error |

---

## Document Information

- **Version**: 1.0
- **Created**: February 2026
- **Product**: Kuamini Threat Protection Agent
- **Author**: Architecture Team
- **Last Updated**: February 8, 2026

---

