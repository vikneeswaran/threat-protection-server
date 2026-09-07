import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

interface JWTPayload {
  accountId: string;
  iat: number;
  exp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      installationToken,
      registrationToken,
      registration_token,
      installerVersion,
      platform,
      agentId,
      agent_id,
      hostname,
      os,
      osVersion,
      os_version,
      agentVersion,
      agent_version,
      ipAddress,
      ip_address,
      local_ip,
      macAddress,
      mac_address,
      publicIp,
      public_ip,
    } = body;

    // -----------------------------------------
    // 1. Validate request
    // -----------------------------------------
    const token = installationToken || registrationToken || registration_token;
    const resolvedAgentId = agentId || agent_id;
    const resolvedPlatform = platform || os || "windows";
    const resolvedInstallerVersion = installerVersion || agentVersion || agent_version || "unknown";

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Installation token or registration token is required.",
        },
        { status: 400 }
      );
    }

    if (typeof resolvedInstallerVersion !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Installer version is required.",
        },
        { status: 400 }
      );
    }

    if (typeof resolvedPlatform !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Platform is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Validate token format (JWT, Base64 JSON, or legacy DB token)
    // -----------------------------------------
    let accountId: string | null = null;
    let tokenRecord: Record<string, unknown> | null = null;

    // Try JWT token verification
    if (token.includes(".") && JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        accountId = decoded.accountId || (decoded as any).account_id;
        console.info(`[Agent Register] JWT token verified for account: ${accountId}`);
      } catch {
        console.warn("[Agent Register] JWT verification failed, trying fallback payload decode");
      }
    }

    // Try unverified JWT payload decode
    if (!accountId && token.includes(".")) {
      try {
        const decoded = jwt.decode(token) as JWTPayload | null;
        if (decoded && (decoded.accountId || (decoded as any).account_id)) {
          accountId = decoded.accountId || (decoded as any).account_id;
          console.info(`[Agent Register] JWT payload decoded account: ${accountId}`);
        }
      } catch {
        // Fall through
      }
    }

    // Try Base64 encoded JSON token
    if (!accountId) {
      try {
        const decodedText = Buffer.from(token, "base64").toString("utf-8");
        const jsonObj = JSON.parse(decodedText);
        if (jsonObj && (jsonObj.accountId || jsonObj.account_id)) {
          accountId = jsonObj.accountId || jsonObj.account_id;
          console.info(`[Agent Register] Base64 JSON token account: ${accountId}`);
        }
      } catch {
        // Fall through
      }
    }

    // If still not resolved, check database installation_tokens table
    if (!accountId) {
      const dbTokenResult = await query(
        `
        SELECT
          id,
          account_id,
          installation_token,
          expires_at
        FROM installation_tokens
        WHERE installation_token = $1 OR account_id::text = $1
        LIMIT 1
        `,
        [token]
      );

      if (dbTokenResult.rows.length > 0) {
        tokenRecord = dbTokenResult.rows[0] as Record<string, unknown>;

        if (new Date(tokenRecord.expires_at as string) <= new Date()) {
          return NextResponse.json(
            {
              success: false,
              message: "Installation token has expired.",
            },
            { status: 401 }
          );
        }

        accountId = tokenRecord.account_id as string;
      }
    }

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to resolve account from token.",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 4. Check account
    // -----------------------------------------
    const accountResult = await query(
      `
      SELECT
        id,
        total_licenses,
        allocated_licenses,
        used_licenses,
        is_active
      FROM accounts
      WHERE id::text = $1
      LIMIT 1
      `,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Account not found.",
        },
        { status: 404 }
      );
    }

    const account = accountResult.rows[0] as Record<string, unknown>;

    // -----------------------------------------
    // 5. Check account status
    // -----------------------------------------
    if (!account.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "Account is inactive.",
        },
        { status: 403 }
      );
    }

    const existingInstanceResult = resolvedAgentId
      ? await query(
          `SELECT i.* FROM installation_instances i
           INNER JOIN endpoints e ON e.id = i.endpoint_id
           WHERE i.account_id::text = $1 AND e.agent_id = $2
             AND i.status IN ('PENDING', 'INSTALLED', 'ACTIVE')
           ORDER BY i.created_at DESC LIMIT 1`,
          [accountId, resolvedAgentId],
        )
      : { rows: [] };
    const existingInstance = existingInstanceResult.rows[0] as Record<string, unknown> | undefined;

    // -----------------------------------------
    // 6. Check license availability
    // -----------------------------------------
    if (!existingInstance) {
      const activeInstancesResult = await query(
        `
        SELECT COUNT(*)::int AS count
        FROM installation_instances
        WHERE account_id::text = $1
          AND status IN ('PENDING', 'INSTALLED', 'ACTIVE')
        `,
        [accountId]
      );

      const activeInstances = (activeInstancesResult.rows[0] as Record<string, number>).count;
      const totalLicenses = Number(account.total_licenses);

      if (activeInstances >= totalLicenses) {
        return NextResponse.json(
          {
            success: false,
            message: "No available licenses for this account.",
          },
          { status: 403 }
        );
      }
    }

    // -----------------------------------------
    // 7. Create installation instance
    // -----------------------------------------
    const instance = existingInstance ?? (await query(
      `
      INSERT INTO installation_instances
      (
        account_id,
        installation_token,
        installer_version,
        platform,
        status,
        expires_at,
        installation_token_id
      )
      VALUES
      (
        $1::uuid,
        $2,
        $3,
        $4,
        'PENDING',
        $5,
        $6::uuid
      )
      RETURNING
        id,
        account_id,
        installer_version,
        platform,
        status,
        expires_at,
        created_at,
        installation_token_id
      `,
      [
        accountId,
        token,
        resolvedInstallerVersion,
        resolvedPlatform,
        tokenRecord ? tokenRecord.expires_at : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        tokenRecord ? tokenRecord.id : null,
      ]
    )).rows[0] as Record<string, unknown>;

    const resolvedOs = String(os || resolvedPlatform).toLowerCase();
    const existingEndpoint = resolvedAgentId
      ? await query("SELECT id FROM endpoints WHERE account_id::text = $1 AND agent_id = $2 LIMIT 1", [accountId, resolvedAgentId])
      : { rows: [] };
    const endpointResult = existingEndpoint.rows[0]
      ? await query(
          `UPDATE endpoints SET hostname = $1, os = $2::endpoint_os, os_version = $3,
           agent_version = $4, ip_address = $5, mac_address = $6, public_ip = $7,
           status = 'online'::endpoint_status, last_seen_at = NOW(), updated_at = NOW()
           WHERE id::text = $8 RETURNING id`,
          [hostname || "Unknown", resolvedOs, osVersion || os_version || null, agentVersion || agent_version || resolvedInstallerVersion,
            ipAddress || ip_address || local_ip || null, macAddress || mac_address || null, publicIp || public_ip || null,
            existingEndpoint.rows[0].id],
        )
      : await query(
          `INSERT INTO endpoints (account_id, hostname, os, os_version, agent_version, ip_address,
           mac_address, status, last_seen_at, registered_at, agent_id, public_ip, secured_by_kuamini, infected)
           VALUES ($1::uuid, $2, $3::endpoint_os, $4, $5, $6, $7, 'online'::endpoint_status,
           NOW(), NOW(), $8, $9, true, false) RETURNING id`,
          [accountId, hostname || "Unknown", resolvedOs, osVersion || os_version || null,
            agentVersion || agent_version || resolvedInstallerVersion, ipAddress || ip_address || local_ip || null,
            macAddress || mac_address || null, resolvedAgentId || null, publicIp || public_ip || null],
        );
    const endpointId = endpointResult.rows[0].id;

    await query(
      "UPDATE installation_instances SET endpoint_id = $1::uuid WHERE id::text = $2",
      [endpointId, instance.id],
    );

    console.info("[Agent Register] Registration accepted", { accountId, agentId: resolvedAgentId, endpointId, installationInstanceId: instance.id });
    return NextResponse.json({
      success: true,
      message: "Agent registration successful.",
      accountId,
      installationInstanceId: instance.id,
      agent_id: resolvedAgentId,
      account_id: accountId,
      endpoint_id: endpointId,
      installation_instance_id: instance.id,
      installerVersion: instance.installer_version,
      platform: instance.platform,
      status: instance.status,
    });
  } catch (error) {
    console.error("Agent Registration Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Agent registration failed.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
