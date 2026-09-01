import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  normalizeAgentIdentity,
  resolveRegistrationInstance,
  type InstallationInstance,
} from "@/lib/agent/agent-request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const identity = normalizeAgentIdentity(body);

    const installationToken = identity.installationToken;

    const installerVersion =
      typeof body.installerVersion === "string"
        ? body.installerVersion
        : typeof body.installer_version === "string"
          ? body.installer_version
          : typeof body.agentVersion === "string"
            ? body.agentVersion
            : body.agent_version;

    const platform =
      typeof body.platform === "string" ? body.platform : body.os;

    // -----------------------------------------
    // 1. Validate request
    // -----------------------------------------
    if (!installationToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation token is required.",
        },
        { status: 400 }
      );
    }

    if (installationToken.length !== 128) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid installation token.",
        },
        { status: 400 }
      );
    }

    if (!installerVersion || typeof installerVersion !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Installer version is required.",
        },
        { status: 400 }
      );
    }

    if (!platform || typeof platform !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Platform is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Find installation token
    // -----------------------------------------
    const tokenResult = await query(
      `
      SELECT
        id,
        account_id,
        installation_token,
        expires_at
      FROM installation_tokens
      WHERE installation_token = $1
      LIMIT 1
      `,
      [installationToken]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid installation token.",
        },
        { status: 401 }
      );
    }

    const tokenRecord = tokenResult.rows[0];

    // -----------------------------------------
    // 3. Check token expiry
    // -----------------------------------------
    if (new Date(tokenRecord.expires_at) <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation token has expired.",
        },
        { status: 401 }
      );
    }

    const accountId = tokenRecord.account_id;

    // -----------------------------------------
    // 4. Check account
    // -----------------------------------------
    const accountResult = await query(
      `
      SELECT
        id,
        name,
        total_licenses,
        allocated_licenses,
        used_licenses,
        is_active
      FROM accounts
      WHERE id = $1
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

    const account = accountResult.rows[0];

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

    // -----------------------------------------
    // 6. Reuse an existing registration
    //
    // Agents register on every start up. Without this the console
    // would consume one license per restart.
    // -----------------------------------------
    const existingInstance = await resolveRegistrationInstance({
      installationInstanceId: identity.installationInstanceId,
      endpointId: identity.endpointId,
      agentId: identity.agentId,
      accountId,
      installationToken,
    });

    if (existingInstance && existingInstance.account_id === accountId) {
      const refreshedResult = await query<InstallationInstance>(
        `
        UPDATE installation_instances
        SET
          installer_version = $1,
          platform = $2,
          installation_token = $3,
          expires_at = $4
        WHERE id = $5
        RETURNING
          id,
          account_id,
          installer_version,
          platform,
          status,
          endpoint_id
        `,
        [
          installerVersion,
          platform,
          installationToken,
          tokenRecord.expires_at,
          existingInstance.id,
        ]
      );

      const refreshed = refreshedResult.rows[0];

      return NextResponse.json({
        success: true,
        message: "Agent registration successful.",
        accountId,
        accountName: account.name,
        installationInstanceId: refreshed.id,
        endpointId: refreshed.endpoint_id,
        installerVersion: refreshed.installer_version,
        platform: refreshed.platform,
        status: refreshed.status,
      });
    }

    // -----------------------------------------
    // 7. Check license availability
    // -----------------------------------------
    const activeInstancesResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM installation_instances
      WHERE account_id = $1
        AND status IN ('PENDING', 'INSTALLED', 'ACTIVE')
        AND (
          endpoint_id IS NOT NULL
          OR created_at > NOW() - INTERVAL '1 day'
        )
      `,
      [accountId]
    );

    const activeInstances = activeInstancesResult.rows[0].count;

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

    // -----------------------------------------
    // 8. Create installation instance
    // -----------------------------------------
    const instanceResult = await query(
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
        $1,
        $2,
        $3,
        $4,
        'PENDING',
        $5,
        $6
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
        installationToken,
        installerVersion,
        platform,
        tokenRecord.expires_at,
        tokenRecord.id,
      ]
    );

    const instance = instanceResult.rows[0];

    // -----------------------------------------
    // 9. Return success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Agent registration successful.",
      accountId,
      accountName: account.name,
      installationInstanceId: instance.id,
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