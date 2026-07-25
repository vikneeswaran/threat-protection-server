import { query } from "@/lib/db";

export interface EndpointSummary {
  total: number;
  windows: number;
  linux: number;
  macos: number;
  online: number;
  offline: number;
  infected: number;
  securedByKuamini: number;
}

export interface Endpoint {
  id: string;
  account_id: string;
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  ip_address: string;
  mac_address: string;
  status: string;
  last_seen_at: string;
  registered_at: string;
  created_at: string;
  updated_at: string;
  agent_id: string;
  public_ip: string;
  secured_by_kuamini: boolean;
  infected: boolean;
}

export interface EndpointsData {
  summary: EndpointSummary;
  endpoints: Endpoint[];
}

export async function getEndpointsData(
  accountId: string
): Promise<EndpointsData> {
  const [summaryResult, endpointResult] = await Promise.all([
    query<EndpointSummary>(
      `
      SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE os = 'windows')::int AS windows,
          COUNT(*) FILTER (WHERE os = 'linux')::int AS linux,
          COUNT(*) FILTER (WHERE os = 'macos')::int AS macos,
          COUNT(*) FILTER (WHERE status = 'online')::int AS online,
          COUNT(*) FILTER (WHERE status = 'offline')::int AS offline,
          COUNT(*) FILTER (WHERE infected = TRUE)::int AS infected,
          COUNT(*) FILTER (WHERE secured_by_kuamini = TRUE)::int AS "securedByKuamini"
      FROM endpoints
      WHERE account_id = $1;
      `,
      [accountId]
    ),

    query<Endpoint>(
      `
     SELECT
    id,
    account_id,
    hostname,
    os,
    os_version,
    agent_version,
    ip_address,
    mac_address,
    status,
    last_seen_at,
    registered_at,
    created_at,
    updated_at,
    agent_id,
    public_ip,
    secured_by_kuamini,
    infected
    FROM endpoints
    WHERE account_id = $1
  ORDER BY created_at DESC;
      `,
      [accountId]
    ),
  ]);

  return {
    summary: summaryResult.rows[0],
    endpoints: endpointResult.rows,
  };
}
export async function getEndpointById(
  id: string,
  accountId: string
): Promise<Endpoint | null> {
  const result = await query<Endpoint>(
    `
    SELECT
        id,
        account_id,
        hostname,
        os,
        os_version,
        agent_version,
        ip_address,
        mac_address,
        status,
        last_seen_at,
        registered_at,
        created_at,
        updated_at,
        agent_id,
        public_ip,
        secured_by_kuamini,
        infected
    FROM endpoints
    WHERE id = $1
      AND account_id = $2;
    `,
    [id, accountId]
  );

  return result.rows[0] ?? null;
}