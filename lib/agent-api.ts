import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uuid(value: unknown): string | null {
  const candidate = text(value);
  return candidate && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

function agentLog(event: string, details: JsonObject) {
  console.info(`[agent-api] ${event}`, details);
}

function agentError(event: string, details: JsonObject) {
  console.warn(`[agent-api] ${event}`, details);
}

function decodeBase64Json(value: string): JsonObject | null {
  try {
    return asObject(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

function accountIdFromToken(token: string): string | null {
  const parts = token.trim().split(".");
  const payload = parts.length === 3 ? decodeBase64Json(parts[1]) : decodeBase64Json(token);
  if (!payload) return null;

  if (parts.length === 3 && process.env.AGENT_REGISTRATION_SECRET) {
    const signature = createHmac("sha256", process.env.AGENT_REGISTRATION_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");
    const actual = Buffer.from(parts[2]);
    const expected = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
  }

  return uuid(payload.account_id ?? payload.accountId);
}

async function bodyFor(request: Request): Promise<JsonObject | NextResponse> {
  try {
    return asObject(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }
}

async function endpointFor(agentId: string, accountId: string) {
  const result = await query<{ id: string; account_id: string }>(
    "SELECT id, account_id FROM endpoints WHERE agent_id = $1 LIMIT 1",
    [agentId],
  );
  const endpoint = result.rows[0];
  return endpoint?.account_id === accountId ? endpoint : null;
}

export async function registerAgent(request: Request) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;

  const agentId = text(body.agent_id ?? body.agentId);
  const token = text(body.installationToken ?? body.registration_token);
  const accountId = token ? accountIdFromToken(token) : null;
  if (!agentId || !accountId) {
    agentError("registration rejected", { agentId, reason: "missing agent_id or valid installation token" });
    return NextResponse.json({ error: "agent_id and a valid installation token are required" }, { status: 400 });
  }

  const account = await query<{ id: string }>("SELECT id FROM accounts WHERE id = $1 AND is_active = TRUE LIMIT 1", [accountId]);
  if (!account.rows[0]) {
    agentError("registration rejected", { agentId, accountId, reason: "account unavailable" });
    return NextResponse.json({ error: "Account is unavailable" }, { status: 403 });
  }

  const hostname = text(body.hostname) ?? "unknown-host";
  const os = (text(body.os) ?? text(body.platform) ?? "unknown").toLowerCase();
  const osVersion = text(body.os_version ?? body.osVersion);
  const agentVersion = text(body.agent_version ?? body.installerVersion);
  const ipAddress = text(body.local_ip ?? body.ip_address ?? body.ipAddress);
  const macAddress = text(body.mac_address ?? body.macAddress);
  const publicIp = text(body.public_ip ?? body.publicIp);
  const existing = await endpointFor(agentId, accountId);

  const endpoint = existing
    ? await query<{ id: string }>(
        `UPDATE endpoints SET hostname = $1, os = $2, os_version = $3, agent_version = $4,
         ip_address = $5, mac_address = $6, public_ip = $7, status = 'online',
         last_seen_at = NOW(), updated_at = NOW() WHERE id = $8 RETURNING id`,
        [hostname, os, osVersion, agentVersion, ipAddress, macAddress, publicIp, existing.id],
      )
    : await query<{ id: string }>(
        `INSERT INTO endpoints (account_id, agent_id, hostname, os, os_version, agent_version,
         ip_address, mac_address, public_ip, status, last_seen_at, registered_at, secured_by_kuamini, infected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'online', NOW(), NOW(), TRUE, FALSE) RETURNING id`,
        [accountId, agentId, hostname, os, osVersion, agentVersion, ipAddress, macAddress, publicIp],
      );
  const endpointId = endpoint.rows[0].id;

  const installation = await query<{ id: string }>(
    `INSERT INTO agent_instances (account_id, endpoint_id, agent_id, hostname, os, os_version,
     agent_version, ip_address, mac_address, last_heartbeat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (agent_id) DO UPDATE SET endpoint_id = EXCLUDED.endpoint_id, hostname = EXCLUDED.hostname,
     os = EXCLUDED.os, os_version = EXCLUDED.os_version, agent_version = EXCLUDED.agent_version,
     ip_address = EXCLUDED.ip_address, mac_address = EXCLUDED.mac_address, last_heartbeat = NOW(), updated_at = NOW()
     RETURNING id`,
    [accountId, endpointId, agentId, hostname, os, osVersion, agentVersion, ipAddress, macAddress],
  );
  const installationInstanceId = installation.rows[0].id;
  agentLog("registration accepted", { agentId, accountId, endpointId, installationInstanceId });
  return NextResponse.json({ agent_id: agentId, account_id: accountId, endpoint_id: endpointId, installation_instance_id: installationInstanceId });
}

export async function heartbeatAgent(request: Request) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;
  const agentId = text(body.agent_id ?? body.agentId);
  const accountId = uuid(body.account_id ?? body.accountId);
  const endpointId = uuid(body.endpoint_id ?? body.endpointId);
  const installationId = uuid(body.installation_instance_id ?? body.installationInstanceId);
  if (!agentId || !accountId || !endpointId || !installationId) {
    agentError("heartbeat rejected", { agentId, accountId, endpointId, reason: "missing identifiers" });
    return NextResponse.json({ error: "agent_id, account_id, endpoint_id, and installation_instance_id are required" }, { status: 400 });
  }

  const updated = await query<{ id: string }>(
    `UPDATE agent_instances SET last_heartbeat = NOW(), updated_at = NOW()
     WHERE id = $1 AND agent_id = $2 AND account_id = $3 AND endpoint_id = $4 RETURNING id`,
    [installationId, agentId, accountId, endpointId],
  );
  if (!updated.rows[0]) {
    agentError("heartbeat rejected", { agentId, accountId, endpointId, reason: "unknown registration" });
    return NextResponse.json({ error: "Unknown agent registration" }, { status: 404 });
  }
  await query("UPDATE endpoints SET status = 'online', last_seen_at = NOW(), updated_at = NOW() WHERE id = $1 AND account_id = $2", [endpointId, accountId]);
  agentLog("heartbeat accepted", { agentId, accountId, endpointId });
  return NextResponse.json({ ok: true, policies: [] });
}

export async function reportThreat(request: Request) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;
  const agentId = text(body.agent_id);
  const accountId = uuid(body.account_id);
  const endpointId = uuid(body.endpoint_id);
  const endpoint = agentId && accountId ? await endpointFor(agentId, accountId) : null;
  const resolvedEndpointId = endpointId ?? endpoint?.id;
  if (!agentId || !accountId || !resolvedEndpointId || !text(body.threat_name) || !text(body.severity)) {
    agentError("threat rejected", { agentId, accountId, endpointId, reason: "missing or invalid threat fields" });
    return NextResponse.json({ error: "agent, account, endpoint, threat_name, and severity are required" }, { status: 400 });
  }
  const threat = await query<{ id: string }>(
    `INSERT INTO threats (account_id, endpoint_id, name, description, severity, status, type, file_path,
     file_hash, process_name, process_id, detection_engine, detection_source, detected_at)
     VALUES ($1, $2, $3, $4, $5, 'detected', $6, $7, $8, $9, $10, $11, 'agent', COALESCE($12::timestamptz, NOW())) RETURNING id`,
    [accountId, resolvedEndpointId, text(body.threat_name), text(body.details) ?? null, text(body.severity)?.toLowerCase(), text(body.threat_type) ?? "unknown", text(body.file_path), text(body.file_hash), text(body.process_name), Number.isInteger(body.process_id) ? body.process_id : null, text(body.detection_engine), text(body.detected_at)],
  );
  agentLog("threat accepted", { agentId, accountId, endpointId: resolvedEndpointId, threatId: threat.rows[0].id });
  return NextResponse.json({ threat_id: threat.rows[0].id });
}

export async function reportScanSummary(request: Request) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;
  const accountId = uuid(body.account_id);
  const endpointId = uuid(body.endpoint_id);
  const scanId = text(body.scan_id);
  if (!accountId || !endpointId || !scanId || !text(body.scan_type)) return NextResponse.json({ error: "account_id, endpoint_id, scan_id, and scan_type are required" }, { status: 400 });
  await query(
    `INSERT INTO scan_summaries (account_id, endpoint_id, scan_id, scan_type, start_time, end_time, total_threats, severity_breakdown)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6::timestamptz, $7, $8::jsonb)
     ON CONFLICT (account_id, scan_id) DO UPDATE SET end_time = EXCLUDED.end_time, total_threats = EXCLUDED.total_threats,
     severity_breakdown = EXCLUDED.severity_breakdown, updated_at = NOW()`,
    [accountId, endpointId, scanId, text(body.scan_type), text(body.start_time), text(body.end_time), Number(body.total_threats) || 0, JSON.stringify(asObject(body.severity_breakdown))],
  );
  return NextResponse.json({ ok: true });
}

export async function updateThreatStatus(request: Request, threatId: string) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;
  const status = text(body.status);
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  const result = await query<{ id: string }>("UPDATE threats SET status = $1, resolved_at = CASE WHEN $1 IN ('resolved', 'quarantined', 'killed', 'allowed') THEN NOW() ELSE resolved_at END WHERE id = $2 RETURNING id", [status, threatId]);
  if (!result.rows[0]) return NextResponse.json({ error: "Threat not found" }, { status: 404 });
  return NextResponse.json({ ok: true, threat_id: threatId, status });
}

export async function getPolicies(request: Request) {
  const accountId = uuid(new URL(request.url).searchParams.get("account_id"));
  if (!accountId) return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  const policies = await query("SELECT * FROM policies WHERE account_id = $1 AND status = 'active'", [accountId]);
  return NextResponse.json(policies.rows);
}

export async function getScanCommand(request: Request) {
  const url = new URL(request.url);
  const accountId = uuid(url.searchParams.get("account_id"));
  const agentId = text(url.searchParams.get("agent_id"));
  const endpoint = agentId && accountId ? await endpointFor(agentId, accountId) : null;
  if (!endpoint || !accountId) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  const command = await query("SELECT id, scan_type FROM scan_commands WHERE account_id = $1 AND endpoint_id = $2 AND status = 'pending' ORDER BY created_at LIMIT 1", [accountId, endpoint.id]);
  return NextResponse.json({ has_pending_command: Boolean(command.rows[0]), command: command.rows[0] ?? null });
}

export async function completeScanCommand(request: Request) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;
  const commandId = uuid(body.command_id);
  if (!commandId) return NextResponse.json({ error: "command_id is required" }, { status: 400 });
  await query("UPDATE scan_commands SET status = $1, result_scan_id = $2, error_message = $3, completed_at = NOW() WHERE id = $4", [text(body.status) ?? "completed", text(body.scan_id), text(body.error_message), commandId]);
  return NextResponse.json({ ok: true });
}

export async function getThreatActionCommand(request: Request) {
  const url = new URL(request.url);
  const accountId = uuid(url.searchParams.get("account_id"));
  const agentId = text(url.searchParams.get("agent_id"));
  const endpoint = agentId && accountId ? await endpointFor(agentId, accountId) : null;
  if (!endpoint || !accountId) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  const command = await query("SELECT id, action, payload FROM threat_action_commands WHERE account_id = $1 AND endpoint_id = $2 AND status = 'pending' ORDER BY created_at LIMIT 1", [accountId, endpoint.id]);
  return NextResponse.json({ has_pending_command: Boolean(command.rows[0]), command: command.rows[0] ?? null });
}

export async function completeThreatActionCommand(request: Request) {
  const body = await bodyFor(request);
  if (body instanceof NextResponse) return body;
  const commandId = uuid(body.command_id);
  if (!commandId) return NextResponse.json({ error: "command_id is required" }, { status: 400 });
  await query("UPDATE threat_action_commands SET status = $1, error_message = $2, result_details = $3::jsonb, completed_at = NOW(), updated_at = NOW() WHERE id = $4", [text(body.status) ?? "completed", text(body.error_message), JSON.stringify(asObject(body.result_details)), commandId]);
  return NextResponse.json({ ok: true });
}