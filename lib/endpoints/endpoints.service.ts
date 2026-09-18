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
  effective_status: "online" | "offline";
  last_seen_at: string | null;
  registered_at: string;
  created_at: string;
  updated_at: string;
  agent_id: string;
  public_ip: string | null;
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
      WITH current_installations AS (
        SELECT DISTINCT ON (ii.endpoint_id)
          ii.endpoint_id,
          ii.status
        FROM installation_instances ii
        WHERE ii.account_id = $1
        ORDER BY
          ii.endpoint_id,
          ii.installed_at DESC NULLS LAST,
          ii.id DESC
      )

      SELECT
          COUNT(*)::int AS total,

          COUNT(*) FILTER (
            WHERE e.os = 'windows'
          )::int AS windows,

          COUNT(*) FILTER (
            WHERE e.os = 'linux'
          )::int AS linux,

          COUNT(*) FILTER (
            WHERE e.os = 'macos'
          )::int AS macos,

          COUNT(*) FILTER (
            WHERE e.last_seen_at IS NOT NULL
              AND e.last_seen_at >= NOW() - INTERVAL '2 minutes'
          )::int AS online,

          COUNT(*) FILTER (
            WHERE e.last_seen_at IS NULL
               OR e.last_seen_at < NOW() - INTERVAL '2 minutes'
          )::int AS offline,

          COUNT(*) FILTER (
            WHERE e.infected = TRUE
          )::int AS infected,

          COUNT(*) FILTER (
            WHERE e.secured_by_kuamini = TRUE
          )::int AS "securedByKuamini"

      FROM endpoints e

      LEFT JOIN current_installations ci
        ON ci.endpoint_id = e.id

      WHERE e.account_id = $1
        AND COALESCE(ci.status, '') <> 'UNINSTALLED';
      `,
      [accountId]
    ),

    query<Endpoint>(
      `
      WITH current_installations AS (
        SELECT DISTINCT ON (ii.endpoint_id)
          ii.endpoint_id,
          ii.status
        FROM installation_instances ii
        WHERE ii.account_id = $1
        ORDER BY
          ii.endpoint_id,
          ii.installed_at DESC NULLS LAST,
          ii.id DESC
      )

      SELECT
        e.id,
        e.account_id,
        e.hostname,
        e.os,
        e.os_version,
        e.agent_version,
        e.ip_address,
        e.mac_address,
        e.status,

        CASE
          WHEN e.last_seen_at IS NOT NULL
               AND e.last_seen_at >= NOW() - INTERVAL '2 minutes'
          THEN 'online'
          ELSE 'offline'
        END AS effective_status,

        e.last_seen_at,
        e.registered_at,
        e.created_at,
        e.updated_at,
        e.agent_id,
        e.public_ip,
        e.secured_by_kuamini,
        e.infected

      FROM endpoints e

      LEFT JOIN current_installations ci
        ON ci.endpoint_id = e.id

      WHERE e.account_id = $1
        AND COALESCE(ci.status, '') <> 'UNINSTALLED'

      ORDER BY e.created_at DESC;
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
    WITH current_installation AS (
      SELECT
        ii.endpoint_id,
        ii.status
      FROM installation_instances ii
      WHERE ii.endpoint_id = $1
        AND ii.account_id = $2
      ORDER BY
        ii.installed_at DESC NULLS LAST,
        ii.id DESC
      LIMIT 1
    )

    SELECT
        e.id,
        e.account_id,
        e.hostname,
        e.os,
        e.os_version,
        e.agent_version,
        e.ip_address,
        e.mac_address,
        e.status,

        CASE
          WHEN e.last_seen_at IS NOT NULL
               AND e.last_seen_at >= NOW() - INTERVAL '2 minutes'
          THEN 'online'
          ELSE 'offline'
        END AS effective_status,

        e.last_seen_at,
        e.registered_at,
        e.created_at,
        e.updated_at,
        e.agent_id,
        e.public_ip,
        e.secured_by_kuamini,
        e.infected

    FROM endpoints e

    LEFT JOIN current_installation ci
      ON ci.endpoint_id = e.id

    WHERE e.id = $1
      AND e.account_id = $2
      AND COALESCE(ci.status, '') <> 'UNINSTALLED';
    `,
    [id, accountId]
  );

  return result.rows[0] ?? null;
}