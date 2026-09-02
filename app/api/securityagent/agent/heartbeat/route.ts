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
    } = body;

    // -----------------------------------------
    // 1. Validate installation instance ID
    // -----------------------------------------
    if (
      !installationInstanceId ||
      typeof installationInstanceId !== "string"
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
    if (!["windows", "macos", "linux"].includes(os)) {
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
      WHERE id = $1
      LIMIT 1
      `,
      [installationInstanceId]
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
      WHERE id = $1
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
          os_version = $3,
          agent_version = $4,
          ip_address = $5,
          mac_address = $6,
          public_ip = $7,
          agent_id = $8,
          status = 'online'::endpoint_status,
          last_seen_at = NOW(),
          updated_at = NOW()
        WHERE id = $9
        RETURNING id
        `,
        [
          hostname || "Unknown",
          os,
          osVersion || null,
          agentVersion || null,
          ipAddress || null,
          macAddress || null,
          publicIp || null,
          agentId || null,
          endpointId,
        ]
      );

      if (endpointResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Endpoint not found.",
          },
          { status: 404 }
        );
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
          hostname || "Unknown",
          os,
          osVersion || null,
          agentVersion || null,
          ipAddress || null,
          macAddress || null,
          agentId || null,
          publicIp || null,
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
        endpoint_id = $1,
        status = 'ACTIVE',
        installed_at = COALESCE(installed_at, NOW())
      WHERE id = $2
      `,
      [endpointId, installationInstanceId]
    );

    // -----------------------------------------
    // 9. Return heartbeat success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Heartbeat received.",
      installationInstanceId,
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
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}