import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const SUPPORTED_THREAT_ACTIONS = new Set([
  "quarantine",
  "kill",
  "allow",
  "restore",
  "delete",
]);

function normalizeThreatAction(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "block") {
    return "kill";
  }

  return SUPPORTED_THREAT_ACTIONS.has(normalized) ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      agent_id,
      account_id,
      endpoint_id,
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
    } = body;

    // -----------------------------------------
    // 1. Validate required fields
    // -----------------------------------------
    if (!agent_id || typeof agent_id !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Agent ID is required.",
        },
        { status: 400 }
      );
    }

    if (!account_id || typeof account_id !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Account ID is required.",
        },
        { status: 400 }
      );
    }

    if (!threat_name || typeof threat_name !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Threat name is required.",
        },
        { status: 400 }
      );
    }

    if (!severity || typeof severity !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Severity is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Validate severity levels
    // -----------------------------------------
    const validSeverities = ["critical", "high", "medium", "low"];
    if (!validSeverities.includes(severity.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid severity level.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. Verify account exists and is active
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

    // -----------------------------------------
    // 4. Find or create endpoint from agent_id
    // -----------------------------------------
    let endpointIdToUse = endpoint_id;

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
    const descriptionText = typeof details === "object" ? JSON.stringify(details) : (details || threat_name);

    const threatResult = await query(
      `
      INSERT INTO threats
      (
        account_id,
        endpoint_id,
        agent_id,
        name,
        description,
        type,
        severity,
        file_path,
        file_hash,
        process_name,
        process_id,
        detection_engine,
        detection_source,
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
        'agent',
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
        name,
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
        descriptionText,
        threat_type || "unknown",
        severity.toLowerCase(),
        file_path || null,
        file_hash || null,
        process_name || null,
        process_id || null,
        detection_engine || "signature",
        detected_at || new Date().toISOString(),
      ]
    );

    const threat = threatResult.rows[0];

    // -----------------------------------------
    // 6. Resolve action policy and enqueue command
    // -----------------------------------------
    let resolvedAction: string | null = null;
    let actionSource: "admin_override" | "policy" | null = null;

    if (file_hash) {
      const overrideResult = await query(
        `
        SELECT action
        FROM threat_action_policies
        WHERE account_id = $1
          AND file_hash = $2
        LIMIT 1
        `,
        [account_id, file_hash]
      );

      resolvedAction = normalizeThreatAction(overrideResult.rows[0]?.action);
      if (resolvedAction) {
        actionSource = "admin_override";
      }
    }

    if (!resolvedAction) {
      const policyResult = await query(
        `
        WITH account_scope AS (
          SELECT id, parent_account_id
          FROM accounts
          WHERE id = $1
          LIMIT 1
        )
        SELECT
          p.config->>'action' AS action
        FROM policies p
        CROSS JOIN account_scope a
        WHERE p.account_id IN (a.id, a.parent_account_id)
          AND p.type = 'threat_actions'::policy_type
          AND p.status = 'active'::policy_status
          AND p.is_active = TRUE
          AND (
            LOWER(COALESCE(p.config->>'threatType', 'other')) = LOWER($2)
            OR LOWER(COALESCE(p.config->>'threatType', 'other')) = 'other'
          )
        ORDER BY
          CASE WHEN p.account_id = a.id THEN 0 ELSE 1 END,
          CASE WHEN LOWER(COALESCE(p.config->>'threatType', '')) = LOWER($2) THEN 0 ELSE 1 END,
          CASE WHEN p.is_default THEN 0 ELSE 1 END,
          p.updated_at DESC
        LIMIT 1
        `,
        [account_id, threat_type || "other"]
      );

      resolvedAction = normalizeThreatAction(policyResult.rows[0]?.action);
      if (resolvedAction) {
        actionSource = "policy";
      }
    }

    if (endpointIdToUse) {
      let queuedCommandId: string | null = null;
      if (resolvedAction) {
        const commandInsertResult = await query(
          `
          INSERT INTO threat_action_commands
          (
            account_id,
            endpoint_id,
            threat_id,
            action,
            status,
            payload
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4::threat_action_type,
            'pending',
            $5::jsonb
          )
          ON CONFLICT (threat_id, action)
          WHERE status IN ('pending', 'running')
          DO NOTHING
          RETURNING id
          `,
          [
            account_id,
            endpointIdToUse,
            threat.id,
            resolvedAction,
            JSON.stringify({
              source: actionSource,
              threat_type: threat_type || "unknown",
              severity: severity.toLowerCase(),
              file_hash: file_hash || null,
            }),
          ]
        );
        queuedCommandId = commandInsertResult.rows[0]?.id ?? null;
      }

      // -----------------------------------------
      // 7. Update endpoint threat status if exists
      // -----------------------------------------
      if (!resolvedAction || queuedCommandId) {
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
    }

    // -----------------------------------------
    // 8. Log threat event
    // -----------------------------------------
    console.info(
      `[Threat Reported] Account: ${account_id}, Threat: ${threat_name}, Severity: ${severity}`
    );

    // -----------------------------------------
    // 9. Return success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Threat reported successfully.",
      threat_id: threat.id,
      threatId: threat.id,
      accountId: threat.account_id,
      agentId: threat.agent_id,
      threatName: threat.name || threat_name,
      severity: threat.severity,
      status: threat.status,
      detectedAt: threat.detected_at,
      action: resolvedAction,
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
