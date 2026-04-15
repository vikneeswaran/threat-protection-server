# DB Communication Matrix (P0)

This matrix documents how each major API route communicates with PostgreSQL tables in AWS RDS.

## API ↔ DB Mapping

| API Route | Read Tables | Write Tables | Criticality | Notes |
|---|---|---|---|---|
| `POST /api/agent/register` | `accounts`, `endpoints` | `endpoints`, `audit_logs` | Critical | Creates/updates endpoint identity and registration audit record. |
| `POST /api/agent/heartbeat` | `endpoints`, `endpoint_policies`, `policies` | `endpoints` | Critical | Updates endpoint liveness and returns policy payload. |
| `POST /api/agent/threat` | `endpoints`, `endpoint_policies`, `policies` | `threats`, `audit_logs` | Critical | Inserts threat and computes recommended action from policy. |
| `POST /api/agent/scan-summary` | `endpoints` | `scan_summaries`, `audit_logs` | High | Records completed scan summary and severity aggregation. |
| `GET /api/agent/scan-commands` | `endpoints`, `scan_commands` | `scan_commands` | High | Pulls next pending command and marks it `running`. |
| `POST /api/agent/scan-commands` | `endpoints` | `scan_commands` | High | Enqueues new scan command with priority. |
| `POST /api/agent/scan-commands-result` | `scan_commands` | `scan_commands`, `agent_instances` | High | Updates command completion state and updates agent scan metadata. |
| `POST /api/agent/deregister` | `endpoints` | `endpoints` (delete) | Critical | Deletes endpoint entry and relies on DB triggers for license counters. |

## High-Risk Paths

1. Endpoint identity mutations (`register`, `heartbeat`, `deregister`)
2. Threat ingestion and policy-based action recommendation
3. Command lifecycle state transitions (`pending` → `running` → `completed`)

## Observability Requirements

For every critical route, log these fields:

- `request_id` (generated UUID per request)
- `agent_id`
- `account_id`
- `endpoint_id` (if resolved)
- `db_operation` (`select`, `insert`, `update`, `delete`)
- `table_name`
- `result` (`success` / `failure`)
- `latency_ms`

## Data Integrity Checks (Daily)

1. Endpoint uniqueness drift check (`agent_id`, `hostname + mac_address`).
2. Threat records without endpoint relation.
3. Scan command rows stuck in `running` beyond expected timeout.
4. Endpoint rows still online but stale heartbeat timestamp.

## Ownership

- API owners: maintain route-level DB contract
- DBA/platform owner: maintain trigger/index health
- QA owner: verify high-risk data flows each release
