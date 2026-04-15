import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, account_id, status, system_info: _system_info } = body

    if (!agent_id) {
      return NextResponse.json({ error: "Missing required field: agent_id" }, { status: 400 })
    }

    const foundByAgentResult = account_id
      ? await query<{ id: string; account_id: string }>(
          `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 AND account_id = $2 LIMIT 1`,
          [agent_id, account_id],
        )
      : await query<{ id: string; account_id: string }>(
          `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
          [agent_id],
        )
    const foundByAgentId = foundByAgentResult.rows[0]

    if (!foundByAgentId) {
      // Endpoint not found by agent_id
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    await query(
      `UPDATE endpoints SET status = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [status || "online", foundByAgentId.id],
    )

    const policyResult = await query<{ policy: Record<string, unknown> }>(
      `
        SELECT row_to_json(p.*) AS policy
        FROM endpoint_policies ep
        JOIN policies p ON p.id = ep.policy_id
        WHERE ep.endpoint_id = $1
      `,
      [foundByAgentId.id],
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
