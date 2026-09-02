import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  normalizeAgentIdentity,
  normalizeThreat,
  resolveInstallationInstance,
} from "@/lib/agent/agent-request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const identity = normalizeAgentIdentity(body);

    const {
      name,
      description,
      severity,
      type,
      filePath,
      fileHash,
      processName,
      processId,
      detectionEngine,
      detectionSource,
    } = normalizeThreat(body);

    const { agentId, accountId, endpointId } = identity;

    // --------------------------------------------------
    // 1. Validate required threat information
    // --------------------------------------------------

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Threat name is required.",
        },
        { status: 400 }
      );
    }

    if (!severity) {
      return NextResponse.json(
        {
          success: false,
          message: "Severity is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Resolve the installation instance
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 3. Validate installation instance status
    // --------------------------------------------------

    if (!["PENDING", "INSTALLED", "ACTIVE"].includes(instance.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance is not active.",
        },
        { status: 403 }
      );
    }

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

    // --------------------------------------------------
    // 4. Resolve account
    // --------------------------------------------------

    const resolvedAccountId = instance.account_id;

    if (accountId && accountId !== resolvedAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Account does not match installation instance.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 5. Validate account
    // --------------------------------------------------

    const accountResult = await query(
      `
      SELECT
        id,
        is_active
      FROM accounts
      WHERE id = $1
      LIMIT 1
      `,
      [account_id]
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

    // --------------------------------------------------
    // 6. Resolve endpoint
    // --------------------------------------------------

    let resolvedEndpointId = endpointId || instance.endpoint_id;

    if (!resolvedEndpointId && agentId) {
      /*
       * Agents that report a threat before the console linked their
       * endpoint are matched through their agent id.
       */
      const agentEndpointResult = await query(
        `
        SELECT id
        FROM endpoints
        WHERE account_id = $1
          AND agent_id = $2
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [resolvedAccountId, agentId]
      );

      if (agentEndpointResult.rows.length > 0) {
        resolvedEndpointId = agentEndpointResult.rows[0].id;
      }
    }

    if (!endpointIdToUse) {
      const endpointResult = await query(
        `
        SELECT id
        FROM endpoints
        WHERE agent_id = $1
          AND account_id = $2
        LIMIT 1
        `,
        [agent_id, account_id]
      );

      if (endpointResult.rows.length > 0) {
        endpointIdToUse = endpointResult.rows[0].id;
      }
    }

    // -----------------------------------------
    // 5. Insert threat record
    // -----------------------------------------
    const threatResult = await query(
      `
      INSERT INTO threats
      (
        account_id,
        endpoint_id,
        agent_id,
        threat_name,
        threat_type,
        severity,
        file_path,
        file_hash,
        process_name,
        process_id,
        detection_engine,
        details,
        detected_at,
        status,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        'detected',
        NOW(),
        NOW()
      )
      RETURNING
        id,
        account_id,
        endpoint_id,
        agent_id,
        threat_name,
        severity,
        status,
        detected_at,
        created_at
      `,
      [
        account_id,
        endpointIdToUse || null,
        agent_id,
        threat_name,
        threat_type || "unknown",
        severity.toLowerCase(),
        file_path || null,
        file_hash || null,
        process_name || null,
        process_id || null,
        detection_engine || "signature",
        JSON.stringify(details || {}),
        detected_at || new Date().toISOString(),
      ]
    );

    const threat = threatResult.rows[0];

    // -----------------------------------------
    // 6. Update endpoint threat status if exists
    // -----------------------------------------
    if (endpointIdToUse) {
      await query(
        `
        UPDATE endpoints
        SET
          infected = true,
          updated_at = NOW()
        WHERE id = $1
        `,
        [endpointIdToUse]
      );
    }

    // -----------------------------------------
    // 7. Log threat event
    // -----------------------------------------
    console.info(
      `[Threat Reported] Account: ${account_id}, Threat: ${threat_name}, Severity: ${severity}`
    );

    // -----------------------------------------
    // 8. Return success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Threat reported successfully.",
      threatId: threat.id,
      accountId: threat.account_id,
      agentId: threat.agent_id,
      threatName: threat.threat_name,
      severity: threat.severity,
      status: threat.status,
      detectedAt: threat.detected_at,
    });
  } catch (error) {
    console.error("Threat Report Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to report threat.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
