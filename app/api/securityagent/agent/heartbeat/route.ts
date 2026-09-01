import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  normalizeAgentIdentity,
  normalizeSystemInfo,
  resolveInstallationInstance,
} from "@/lib/agent/agent-request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const identity = normalizeAgentIdentity(body);

    const {
      hostname,
      os,
      osVersion,
      agentVersion,
      ipAddress,
      macAddress,
      publicIp,
    } = normalizeSystemInfo(body);

    const agentId = identity.agentId;

    // -----------------------------------------
    // 1. Validate OS
    // -----------------------------------------
    if (!os || !["windows", "macos", "linux"].includes(os)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid operating system.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Resolve the installation instance
    //
    // Agents identify themselves with the installation instance id
    // when they know it, otherwise with the endpoint, agent, account
    // or installation token information they hold.
    // -----------------------------------------
    const instance = await resolveInstallationInstance(identity);

    if (!instance) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance not found.",
        },
        { status: 404 }
      );
    }

    const installationInstanceId = instance.id;

    // -----------------------------------------
    // 3. Check installation expiry
    // -----------------------------------------
    if (
      instance.expires_at &&
      new Date(instance.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance has expired.",
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
    // 5. Existing endpoint
    // -----------------------------------------
    let endpointId = instance.endpoint_id;

    if (!endpointId && agentId) {
      /*
       * The agent registered again (for example after a restart) while
       * an endpoint already exists for it. Reuse that endpoint instead
       * of creating a duplicate one in the console.
       */
      const existingEndpoint = await query(
        `
        SELECT id
        FROM endpoints
        WHERE account_id = $1
          AND agent_id = $2
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [instance.account_id, agentId]
      );

      if (existingEndpoint.rows.length > 0) {
        endpointId = existingEndpoint.rows[0].id;
      }
    }

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
      // 6. First heartbeat - create endpoint
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
    // 7. Link endpoint to installation instance
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
    // 8. Return heartbeat success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Heartbeat received.",
      installationInstanceId,
      accountId: instance.account_id,
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