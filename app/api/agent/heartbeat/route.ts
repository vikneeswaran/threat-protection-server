import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawAgentId = body?.agent_id
    const rawEndpointId = body?.endpoint_id
    const rawAccountId = body?.account_id
    const status = body?.status
    const _system_info = body?.system_info

    const agent_id = typeof rawAgentId === "string" ? rawAgentId.trim() : rawAgentId
    const endpoint_id = typeof rawEndpointId === "string" ? rawEndpointId.trim() : rawEndpointId
    const account_id = typeof rawAccountId === "string" ? rawAccountId.trim() : rawAccountId

    if (!agent_id && !endpoint_id) {
      return NextResponse.json({ error: "Missing required field: agent_id or endpoint_id" }, { status: 400 })
    }

    let foundEndpoint: { id: string; account_id: string } | undefined

    if (endpoint_id) {
      const foundByEndpointResult = await query<{ id: string; account_id: string }>(
        `SELECT id::text, account_id::text FROM endpoints WHERE id = $1 LIMIT 1`,
        [endpoint_id],
      )
      foundEndpoint = foundByEndpointResult.rows[0]
    }

    if (!foundEndpoint && agent_id) {
      const foundByAgentResult = account_id
        ? await query<{ id: string; account_id: string }>(
            `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 AND account_id = $2 LIMIT 1`,
            [agent_id, account_id],
          )
        : await query<{ id: string; account_id: string }>(
            `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
            [agent_id],
          )
      foundEndpoint = foundByAgentResult.rows[0]
    }

    // Fallback for stale/mismatched account_id on agent side
    if (!foundEndpoint && agent_id && account_id) {
      const fallbackByAgent = await query<{ id: string; account_id: string }>(
        `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
        [agent_id],
      )
      foundEndpoint = fallbackByAgent.rows[0]
    }

    if (!foundEndpoint) {
      // Endpoint not found by agent_id
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    await query(
      `UPDATE endpoints SET status = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [status || "online", foundEndpoint.id],
    )

    const policyResult = await query<{ policy: Record<string, unknown> }>(
      `
        SELECT row_to_json(p.*) AS policy
        FROM endpoint_policies ep
        JOIN policies p ON p.id = ep.policy_id
        WHERE ep.endpoint_id = $1
      `,
      [foundEndpoint.id],
    )

    const policies = policyResult.rows.map((row) => row.policy)

    return NextResponse.json({
      success: true,
      policies,
    })
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
