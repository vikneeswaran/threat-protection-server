import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      agent_id,
      agentId,
      account_id,
      accountId,
      endpoint_id,
      endpointId,
    } = body;

    const resolvedAgentId = agent_id || agentId;
    const resolvedAccountId = account_id || accountId;
    const resolvedEndpointId = endpoint_id || endpointId;

    if (!resolvedAgentId && !resolvedEndpointId) {
      return NextResponse.json(
        {
          success: false,
          message: "agent_id or endpoint_id is required for deregistration.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 1. Update endpoints status to offline
    // -----------------------------------------
    let targetEndpointId = resolvedEndpointId;

    if (resolvedEndpointId) {
      await query(
        `
        UPDATE endpoints
        SET
          status = 'offline'::endpoint_status,
          updated_at = NOW()
        WHERE id = $1
        `,
        [resolvedEndpointId]
      );
    } else if (resolvedAgentId) {
      const endpointResult = resolvedAccountId
        ? await query(
            `
            UPDATE endpoints
            SET
              status = 'offline'::endpoint_status,
              updated_at = NOW()
            WHERE agent_id = $1 AND account_id = $2
            RETURNING id
            `,
            [resolvedAgentId, resolvedAccountId]
          )
        : await query(
            `
            UPDATE endpoints
            SET
              status = 'offline'::endpoint_status,
              updated_at = NOW()
            WHERE agent_id = $1
            RETURNING id
            `,
            [resolvedAgentId]
          );

      if (endpointResult.rows.length > 0) {
        targetEndpointId = endpointResult.rows[0].id;
      }
    }

    // -----------------------------------------
    // 2. Update installation_instances status
    // -----------------------------------------
    if (targetEndpointId) {
      await query(
        `
        UPDATE installation_instances
        SET
          status = 'UNINSTALLED',
          uninstalled_at = NOW(),
          updated_at = NOW()
        WHERE endpoint_id = $1
        `,
        [targetEndpointId]
      );
    } else if (resolvedAgentId && resolvedAccountId) {
      await query(
        `
        UPDATE installation_instances
        SET
          status = 'UNINSTALLED',
          uninstalled_at = NOW(),
          updated_at = NOW()
        WHERE account_id = $1 AND endpoint_id IN (
          SELECT id FROM endpoints WHERE agent_id = $2
        )
        `,
        [resolvedAccountId, resolvedAgentId]
      );
    }

    console.info(
      `[Agent Deregister] Successfully deregistered agent: ${resolvedAgentId || targetEndpointId}`
    );

    return NextResponse.json({
      success: true,
      message: "Agent deregistered successfully.",
    });
  } catch (error) {
    console.error("Agent Deregistration Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to deregister agent.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
