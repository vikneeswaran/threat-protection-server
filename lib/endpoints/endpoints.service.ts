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
  hostname: string;
  ip_address: string;
  public_ip: string;
  os: string;
  os_version: string;
  agent_version: string;
  status: string;
  infected: boolean;
  secured_by_kuamini: boolean;
}

export interface EndpointsData {
  summary: EndpointSummary;
  endpoints: Endpoint[];
}

export async function getEndpointsData(
  accountId: string
): Promise<EndpointsData> {
  const [summaryResult, endpointResult] = await Promise.all([
    query(
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

    query(
      `
      SELECT
          id,
          hostname,
          ip_address,
          public_ip,
          os,
          os_version,
          agent_version,
          status,
          infected,
          secured_by_kuamini
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