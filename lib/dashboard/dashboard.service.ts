import { query } from "@/lib/db";

export interface DashboardData {
  endpointHealth: {
    total: number;
    online: number;
    offline: number;
    disconnected: number;
    pending: number;
    quarantined: number;
  };

  threats: {
    total: number;
    detected: number;
    resolved: number;
    quarantined: number;
    killed: number;
    allowed: number;
  };

  policies: {
    total: number;
    active: number;
    draft: number;
    disabled: number;
  };

  licenses: {
    total: number;
    allocated: number;
    used: number;
    available: number;
    utilization: number;
    expiresAt: string | null;
  };
}

export async function getDashboardData(
  accountId: string
): Promise<DashboardData> {
  const [
    endpointResult,
    threatResult,
    policyResult,
    accountResult,
  ] = await Promise.all([
    query(
      `
      SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='online')::int AS online,
          COUNT(*) FILTER (WHERE status='offline')::int AS offline,
          COUNT(*) FILTER (WHERE status='disconnected')::int AS disconnected,
          COUNT(*) FILTER (WHERE status='pending')::int AS pending,
          COUNT(*) FILTER (WHERE status='quarantined')::int AS quarantined
      FROM endpoints
      WHERE account_id = $1;
      `,
      [accountId]
    ),

    query(
      `
      SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='detected')::int AS detected,
          COUNT(*) FILTER (WHERE status='resolved')::int AS resolved,
          COUNT(*) FILTER (WHERE status='quarantined')::int AS quarantined,
          COUNT(*) FILTER (WHERE status='killed')::int AS killed,
          COUNT(*) FILTER (WHERE status='allowed')::int AS allowed
      FROM threats
      WHERE account_id = $1;
      `,
      [accountId]
    ),

    query(
      `
      SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='active')::int AS active,
          COUNT(*) FILTER (WHERE status='draft')::int AS draft,
          COUNT(*) FILTER (WHERE status='disabled')::int AS disabled
      FROM policies
      WHERE account_id = $1;
      `,
      [accountId]
    ),

    query(
      `
      SELECT
          total_licenses,
          allocated_licenses,
          used_licenses,
          license_expires_at
      FROM accounts
      WHERE id = $1;
      `,
      [accountId]
    ),
  ]);

  const endpoint = endpointResult.rows[0];
  const threat = threatResult.rows[0];
  const policy = policyResult.rows[0];
  const account = accountResult.rows[0];

  const totalLicenses = account?.total_licenses ?? 0;
  const allocatedLicenses = account?.allocated_licenses ?? 0;
  const usedLicenses = account?.used_licenses ?? 0;

  const availableLicenses = Math.max(
    totalLicenses - usedLicenses,
    0
  );

  const utilization =
    totalLicenses > 0
      ? Number(((usedLicenses / totalLicenses) * 100).toFixed(2))
      : 0;

  return {
    endpointHealth: {
      total: endpoint?.total ?? 0,
      online: endpoint?.online ?? 0,
      offline: endpoint?.offline ?? 0,
      disconnected: endpoint?.disconnected ?? 0,
      pending: endpoint?.pending ?? 0,
      quarantined: endpoint?.quarantined ?? 0,
    },

    threats: {
      total: threat?.total ?? 0,
      detected: threat?.detected ?? 0,
      resolved: threat?.resolved ?? 0,
      quarantined: threat?.quarantined ?? 0,
      killed: threat?.killed ?? 0,
      allowed: threat?.allowed ?? 0,
    },

    policies: {
      total: policy?.total ?? 0,
      active: policy?.active ?? 0,
      draft: policy?.draft ?? 0,
      disabled: policy?.disabled ?? 0,
    },

    licenses: {
      total: totalLicenses,
      allocated: allocatedLicenses,
      used: usedLicenses,
      available: availableLicenses,
      utilization,
      expiresAt: account?.license_expires_at ?? null,
    },
  };
}