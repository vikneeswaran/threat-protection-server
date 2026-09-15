import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asUuid(value: unknown): string | null {
  const candidate = asText(value);
  return candidate &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate
    )
    ? candidate
    : null;
}

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

    const resolvedAgentId = asText(agent_id || agentId);
    const resolvedAccountId = asUuid(account_id || accountId);
    const resolvedEndpointId = asUuid(endpoint_id || endpointId);

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
    let effectiveAccountId = resolvedAccountId;
    if (!effectiveAccountId && resolvedAgentId) {
      const endpointAccountResult = await query(
        `
        SELECT account_id
        FROM endpoints
        WHERE agent_id = $1
        LIMIT 1
        `,
        [resolvedAgentId]
      );

      effectiveAccountId =
        endpointAccountResult.rows[0]?.account_id ?? null;

      if (!effectiveAccountId) {
        const agentAccountResult = await query(
          `
          SELECT account_id
          FROM agent_instances
          WHERE agent_id = $1
          LIMIT 1
          `,
          [resolvedAgentId]
        );
        effectiveAccountId =
          agentAccountResult.rows[0]?.account_id ?? null;
      }
    }

    const endpointIdsFromAgentInstance =
      resolvedAgentId && effectiveAccountId
        ? (
            await query(
              `
              SELECT endpoint_id
              FROM agent_instances
              WHERE agent_id = $1
                AND account_id = $2
                AND endpoint_id IS NOT NULL
              `,
              [resolvedAgentId, effectiveAccountId]
            )
          ).rows
            .map((row) => row.endpoint_id as string | null)
            .filter((id): id is string => Boolean(id))
        : [];

    let targetEndpointIds: string[] = [];

    if (resolvedEndpointId) {
      const endpointResult = effectiveAccountId
        ? await query(
            `
            UPDATE endpoints
            SET
              status = 'offline'::endpoint_status,
              secured_by_kuamini = FALSE,
              updated_at = NOW()
            WHERE id = $1
              AND account_id = $2
            RETURNING id
            `,
            [resolvedEndpointId, effectiveAccountId]
          )
        : await query(
            `
            UPDATE endpoints
            SET
              status = 'offline'::endpoint_status,
              secured_by_kuamini = FALSE,
              updated_at = NOW()
            WHERE id = $1
            RETURNING id
            `,
            [resolvedEndpointId]
          );

      targetEndpointIds = endpointResult.rows
        .map((row) => row.id as string)
        .filter(Boolean);
    } else if (resolvedAgentId) {
      if (!effectiveAccountId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Unable to resolve account for deregistration request.",
          },
          { status: 404 }
        );
      }

      const endpointResult = await query(
        `
        UPDATE endpoints
        SET
          status = 'offline'::endpoint_status,
          secured_by_kuamini = FALSE,
          updated_at = NOW()
        WHERE agent_id = $1 AND account_id = $2
        RETURNING id
        `,
        [resolvedAgentId, effectiveAccountId]
      );

      targetEndpointIds = endpointResult.rows
        .map((row) => row.id as string)
        .filter(Boolean);
    }

    if (endpointIdsFromAgentInstance.length > 0) {
      targetEndpointIds = Array.from(
        new Set([...targetEndpointIds, ...endpointIdsFromAgentInstance])
      );
    }

    // -----------------------------------------
    // 2. Update installation_instances status
    // -----------------------------------------
    if (targetEndpointIds.length > 0) {
      await query(
        `
        UPDATE installation_instances
        SET
          status = 'UNINSTALLED',
          endpoint_id = NULL,
          uninstalled_at = NOW(),
          updated_at = NOW()
        WHERE endpoint_id = ANY($1::uuid[])
        `,
        [targetEndpointIds]
      );
    }

    // -----------------------------------------
    // 3. Mark agent instance as inactive
    // -----------------------------------------
    if (resolvedAgentId) {
      if (effectiveAccountId) {
        await query(
          `
          DELETE FROM agent_instances
          WHERE agent_id = $1 AND account_id = $2
          RETURNING id
          `,
          [resolvedAgentId, effectiveAccountId]
        );
      }
    }

    console.info(
      `[Agent Deregister] Successfully deregistered agent: ${resolvedAgentId || targetEndpointIds[0] || "unknown"}`
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
