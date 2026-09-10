import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      installationInstanceId,
      hostname,
      os,
      osVersion,
      agentVersion,
      ipAddress,
      macAddress,
      publicIp,
      agentId,

      // Snake_case compatibility
      installation_instance_id,
      hostname: snakeHostname,
      os: snakeOs,
      os_version,
      agent_version,
      ip_address,
      local_ip,
      mac_address,
      public_ip,
      agent_id,

      // Newer agent payload compatibility
      system_info,
    } = body;

    // -----------------------------------------
    // Resolve system_info safely
    // -----------------------------------------
    const systemInfo =
      system_info && typeof system_info === "object"
        ? system_info
        : {};

    // -----------------------------------------
    // Resolve identifiers
    // -----------------------------------------
    const resolvedInstallationInstanceId =
      installationInstanceId || installation_instance_id;

    const resolvedAgentId =
      agentId || agent_id;

    // -----------------------------------------
    // Resolve endpoint information
    // -----------------------------------------
    const resolvedHostname =
      hostname ||
      snakeHostname ||
      systemInfo.hostname ||
      "Unknown";

    const resolvedOs =
      String(
        os ||
          snakeOs ||
          systemInfo.os ||
          ""
      ).toLowerCase();

    // -----------------------------------------
    // Resolve OS version
    //
    // Accept:
    //   osVersion
    //   os_version
    //   system_info.osVersion
    //   system_info.os_version
    // -----------------------------------------
    const resolvedOsVersion =
      osVersion ||
      os_version ||
      systemInfo.osVersion ||
      systemInfo.os_version ||
      null;

    // -----------------------------------------
    // Resolve agent version
    //
    // Accept:
    //   agentVersion
    //   agent_version
    //   system_info.agentVersion
    //   system_info.agent_version
    // -----------------------------------------
    const resolvedAgentVersion =
      agentVersion ||
      agent_version ||
      systemInfo.agentVersion ||
      systemInfo.agent_version ||
      null;

    // -----------------------------------------
    // Resolve network information
    // -----------------------------------------
    const resolvedIpAddress =
      ipAddress ||
      ip_address ||
      local_ip ||
      systemInfo.ip ||
      systemInfo.local_ip ||
      null;

    const resolvedMacAddress =
      macAddress ||
      mac_address ||
      systemInfo.mac ||
      systemInfo.mac_address ||
      null;

    const resolvedPublicIp =
      publicIp ||
      public_ip ||
      systemInfo.public_ip ||
      null;

    // -----------------------------------------
    // 1. Validate installation instance ID
    // -----------------------------------------
    if (
      !resolvedInstallationInstanceId ||
      typeof resolvedInstallationInstanceId !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance ID is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Validate OS
    // -----------------------------------------
    if (
      resolvedOs &&
      !["windows", "macos", "linux"].includes(resolvedOs)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid operating system.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. Find installation instance
    // -----------------------------------------
    const instanceResult = await query(
      `
      SELECT
        id,
        account_id,
        installation_token,
        installer_version,
        platform,
        status,
        expires_at,
        endpoint_id
      FROM installation_instances
      WHERE id::text = $1
      LIMIT 1
      `,
      [resolvedInstallationInstanceId]
    );

    if (instanceResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance not found.",
        },
        { status: 404 }
      );
    }

    const instance = instanceResult.rows[0];

    // -----------------------------------------
    // 4. Check installation expiry
    // -----------------------------------------
    if (new Date(instance.expires_at) <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance has expired.",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 5. Check account
    // -----------------------------------------
    const accountResult = await query(
      `
      SELECT
        id,
        is_active
      FROM accounts
      WHERE id::text = $1
      LIMIT 1
      `,
      [instance.account_id]
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
    // Check account status
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
    // Resolve OS using installation platform
    // only if heartbeat did not provide one.
    // -----------------------------------------
    const finalOs =
      resolvedOs ||
      String(instance.platform || "").toLowerCase();

    // -----------------------------------------
    // Resolve agent version using installation
    // version only when heartbeat does not provide
    // an agent version.
    // -----------------------------------------
    const finalAgentVersion =
      resolvedAgentVersion ||
      instance.installer_version ||
      null;

    // -----------------------------------------
    // 6. Existing endpoint
    // -----------------------------------------
    let endpointId = instance.endpoint_id;

    if (endpointId) {
      const endpointResult = await query(
        `
        UPDATE endpoints
        SET
          hostname = $1,
          os = $2::endpoint_os,

          /*
           * IMPORTANT:
           * Do not erase an existing value when the
           * heartbeat does not provide one.
           */
          os_version = COALESCE($3, os_version),
          agent_version = COALESCE($4, agent_version),

          ip_address = $5,
          mac_address = $6,
          public_ip = $7,
          agent_id = $8,
          status = 'online'::endpoint_status,
          last_seen_at = NOW(),
          updated_at = NOW()
        WHERE id::text = $9
        RETURNING id
        `,
        [
          resolvedHostname,
          finalOs,
          resolvedOsVersion,
          finalAgentVersion,
          resolvedIpAddress,
          resolvedMacAddress,
          resolvedPublicIp,
          resolvedAgentId || null,
          endpointId,
        ]
      );

      if (endpointResult.rows.length === 0) {
        // -----------------------------------------
        // Endpoint record was manually deleted or
        // is missing from the database.
        // Recreate it for this account/agent.
        // -----------------------------------------
        const recreatedEndpoint = await query(
          `
          INSERT INTO endpoints
          (
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
          )
          VALUES
          (
            $1,
            $2,
            $3::endpoint_os,
            $4,
            $5,
            $6,
            $7,
            'online'::endpoint_status,
            NOW(),
            NOW(),
            NOW(),
            NOW(),
            $8,
            $9,
            true,
            false
          )
          RETURNING id
          `,
          [
            instance.account_id,
            resolvedHostname,
            finalOs,
            resolvedOsVersion,
            finalAgentVersion,
            resolvedIpAddress,
            resolvedMacAddress,
            resolvedAgentId || null,
            resolvedPublicIp,
          ]
        );

        endpointId = recreatedEndpoint.rows[0].id;
      }
    } else {
      // -----------------------------------------
      // 7. First heartbeat - create endpoint
      // -----------------------------------------
      const endpointResult = await query(
        `
        INSERT INTO endpoints
        (
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
        )
        VALUES
        (
          $1,
          $2,
          $3::endpoint_os,
          $4,
          $5,
          $6,
          $7,
          'online'::endpoint_status,
          NOW(),
          NOW(),
          NOW(),
          NOW(),
          $8,
          $9,
          true,
          false
        )
        RETURNING id
        `,
        [
          instance.account_id,
          resolvedHostname,
          finalOs,
          resolvedOsVersion,
          finalAgentVersion,
          resolvedIpAddress,
          resolvedMacAddress,
          resolvedAgentId || null,
          resolvedPublicIp,
        ]
      );

      endpointId = endpointResult.rows[0].id;
    }

    // -----------------------------------------
    // 8. Link endpoint to installation instance
    // -----------------------------------------
    await query(
      `
      UPDATE installation_instances
      SET
        endpoint_id = $1::uuid,
        status = 'ACTIVE',
        installed_at = COALESCE(installed_at, NOW())
      WHERE id::text = $2
      `,
      [endpointId, resolvedInstallationInstanceId]
    );

    // -----------------------------------------
    // 9. Return heartbeat success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Heartbeat received.",
      installationInstanceId: resolvedInstallationInstanceId,
      endpointId,
      status: "online",
      lastSeenAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Agent Heartbeat Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Heartbeat failed.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}