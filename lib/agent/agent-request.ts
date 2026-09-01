import { query } from "@/lib/db";

/*
 * The agent sends snake_case payloads (and nests the machine details in
 * "system_info"), while the console APIs were written against a
 * camelCase contract. These helpers accept both shapes so the shipped
 * agent builds can talk to the console without a protocol change.
 */

export type AgentRequestBody = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AgentIdentity {
  installationInstanceId: string | null;
  endpointId: string | null;
  agentId: string | null;
  accountId: string | null;
  installationToken: string | null;
}

export interface AgentSystemInfo {
  hostname: string | null;
  os: string | null;
  osVersion: string | null;
  agentVersion: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  publicIp: string | null;
}

export interface AgentThreatInput {
  name: string | null;
  description: string | null;
  severity: string | null;
  type: string | null;
  filePath: string | null;
  fileHash: string | null;
  processName: string | null;
  processId: number | null;
  detectionEngine: string | null;
  detectionSource: string | null;
}

export interface InstallationInstance {
  id: string;
  account_id: string;
  installation_token: string | null;
  installer_version: string | null;
  platform: string | null;
  status: string;
  expires_at: string | Date | null;
  endpoint_id: string | null;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed || trimmed === "null" || trimmed === "None") {
      return null;
    }

    return trimmed;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function pick(
  body: AgentRequestBody,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = readString(body[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function readUuid(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function getSystemInfoObject(
  body: AgentRequestBody
): AgentRequestBody {
  const systemInfo = body.system_info ?? body.systemInfo;

  return systemInfo && typeof systemInfo === "object"
    ? (systemInfo as AgentRequestBody)
    : {};
}

export function normalizeAgentIdentity(
  body: AgentRequestBody
): AgentIdentity {
  return {
    installationInstanceId: readUuid(
      pick(body, "installationInstanceId", "installation_instance_id")
    ),

    endpointId: readUuid(pick(body, "endpointId", "endpoint_id")),

    agentId: pick(body, "agentId", "agent_id"),

    accountId: readUuid(pick(body, "accountId", "account_id")),

    installationToken: pick(
      body,
      "installationToken",
      "installation_token",
      "registrationToken",
      "registration_token"
    ),
  };
}

export function normalizeOperatingSystem(
  value: string | null
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("win")) {
    return "windows";
  }

  if (
    normalized.startsWith("mac") ||
    normalized.startsWith("darwin") ||
    normalized === "osx"
  ) {
    return "macos";
  }

  if (normalized.startsWith("linux")) {
    return "linux";
  }

  return normalized;
}

export function normalizeSystemInfo(
  body: AgentRequestBody
): AgentSystemInfo {
  const systemInfo = getSystemInfoObject(body);

  return {
    hostname:
      pick(body, "hostname", "host_name") ??
      pick(systemInfo, "hostname", "host_name"),

    os: normalizeOperatingSystem(
      pick(body, "os") ??
        pick(systemInfo, "os") ??
        pick(body, "platform") ??
        pick(systemInfo, "platform")
    ),

    osVersion:
      pick(body, "osVersion", "os_version") ??
      pick(systemInfo, "osVersion", "os_version"),

    agentVersion:
      pick(
        body,
        "agentVersion",
        "agent_version",
        "installerVersion",
        "installer_version"
      ) ?? pick(systemInfo, "agentVersion", "agent_version"),

    ipAddress:
      pick(body, "ipAddress", "ip_address", "local_ip", "ip") ??
      pick(systemInfo, "ipAddress", "ip_address", "local_ip", "ip"),

    macAddress:
      pick(body, "macAddress", "mac_address", "mac") ??
      pick(systemInfo, "macAddress", "mac_address", "mac"),

    publicIp:
      pick(body, "publicIp", "public_ip") ??
      pick(systemInfo, "publicIp", "public_ip"),
  };
}

export function normalizeThreat(
  body: AgentRequestBody
): AgentThreatInput {
  const processId = pick(body, "processId", "process_id");

  const parsedProcessId = processId ? Number(processId) : Number.NaN;

  return {
    name: pick(body, "name", "threat_name", "threatName"),

    description: pick(body, "description"),

    severity: pick(body, "severity"),

    type: pick(body, "type", "threat_type", "threatType"),

    filePath: pick(body, "filePath", "file_path"),

    fileHash: pick(body, "fileHash", "file_hash"),

    processName: pick(body, "processName", "process_name"),

    processId: Number.isFinite(parsedProcessId)
      ? parsedProcessId
      : null,

    detectionEngine: pick(body, "detectionEngine", "detection_engine"),

    detectionSource: pick(body, "detectionSource", "detection_source"),
  };
}

const INSTANCE_COLUMNS = [
  "id",
  "account_id",
  "installation_token",
  "installer_version",
  "platform",
  "status",
  "expires_at",
  "endpoint_id",
];

const INSTANCE_SELECT = INSTANCE_COLUMNS.join(", ");

const INSTANCE_SELECT_PREFIXED = INSTANCE_COLUMNS.map(
  (column) => `i.${column}`
).join(", ");

async function findByInstanceId(
  installationInstanceId: string
): Promise<InstallationInstance | null> {
  const result = await query<InstallationInstance>(
    `SELECT ${INSTANCE_SELECT}
     FROM installation_instances
     WHERE id = $1
     LIMIT 1`,
    [installationInstanceId]
  );

  return result.rows[0] || null;
}

async function findByEndpointId(
  endpointId: string
): Promise<InstallationInstance | null> {
  const result = await query<InstallationInstance>(
    `SELECT ${INSTANCE_SELECT}
     FROM installation_instances
     WHERE endpoint_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [endpointId]
  );

  return result.rows[0] || null;
}

async function findByAgentId(
  agentId: string,
  accountId: string | null
): Promise<InstallationInstance | null> {
  const result = await query<InstallationInstance>(
    `SELECT ${INSTANCE_SELECT_PREFIXED}
     FROM installation_instances i
     INNER JOIN endpoints e ON e.id = i.endpoint_id
     WHERE e.agent_id = $1
       AND ($2::uuid IS NULL OR i.account_id = $2::uuid)
     ORDER BY i.created_at DESC
     LIMIT 1`,
    [agentId, accountId]
  );

  return result.rows[0] || null;
}

async function findUnlinkedByToken(
  installationToken: string
): Promise<InstallationInstance | null> {
  const result = await query<InstallationInstance>(
    `SELECT ${INSTANCE_SELECT}
     FROM installation_instances
     WHERE installation_token = $1
       AND endpoint_id IS NULL
       AND status = 'PENDING'
     ORDER BY created_at DESC
     LIMIT 1`,
    [installationToken]
  );

  return result.rows[0] || null;
}

async function findUnlinkedByAccount(
  accountId: string
): Promise<InstallationInstance | null> {
  const result = await query<InstallationInstance>(
    `SELECT ${INSTANCE_SELECT}
     FROM installation_instances
     WHERE account_id = $1
       AND endpoint_id IS NULL
       AND status = 'PENDING'
     ORDER BY created_at DESC
     LIMIT 1`,
    [accountId]
  );

  return result.rows[0] || null;
}

/*
 * Machine specific lookups. They are the only lookups that are safe
 * when several endpoints of the same account share one installation
 * token.
 */
async function resolveByMachineIdentity(
  identity: AgentIdentity
): Promise<InstallationInstance | null> {
  if (identity.installationInstanceId) {
    const instance = await findByInstanceId(
      identity.installationInstanceId
    );

    if (instance) {
      return instance;
    }
  }

  if (identity.endpointId) {
    const instance = await findByEndpointId(identity.endpointId);

    if (instance) {
      return instance;
    }
  }

  if (identity.agentId) {
    const instance = await findByAgentId(
      identity.agentId,
      identity.accountId
    );

    if (instance) {
      return instance;
    }
  }

  return null;
}

/*
 * Used by the heartbeat and threat APIs. The agent only knows its own
 * agent_id (and, once it has registered, the account and endpoint
 * ids), so the installation instance is resolved from whatever
 * identity information the request carries. A registration that is not
 * linked to an endpoint yet is claimed on the first heartbeat.
 */
export async function resolveInstallationInstance(
  identity: AgentIdentity
): Promise<InstallationInstance | null> {
  const machineInstance = await resolveByMachineIdentity(identity);

  if (machineInstance) {
    return machineInstance;
  }

  if (identity.installationToken) {
    const instance = await findUnlinkedByToken(
      identity.installationToken
    );

    if (instance) {
      return instance;
    }
  }

  if (identity.accountId) {
    return findUnlinkedByAccount(identity.accountId);
  }

  return null;
}

/*
 * Used by the registration API. Only an installation that is not
 * linked to an endpoint yet may be reused for an unknown machine,
 * otherwise two endpoints of the same account would share a single
 * registration.
 */
export async function resolveRegistrationInstance(
  identity: AgentIdentity
): Promise<InstallationInstance | null> {
  const machineInstance = await resolveByMachineIdentity(identity);

  if (machineInstance) {
    return machineInstance;
  }

  if (identity.installationToken) {
    return findUnlinkedByToken(identity.installationToken);
  }

  return null;
}
