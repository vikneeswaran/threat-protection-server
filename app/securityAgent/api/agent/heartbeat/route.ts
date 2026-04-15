import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

/**
 * POST /api/agent/heartbeat
 * 
 * Receive heartbeat from agent and update endpoint status.
 * Agents send this every 60 seconds to indicate they're online.
 * 
 * Request body:
 * {
 *   "endpoint_id": "uuid" OR "agent_id": "uuid"  (required - one of these)
 *   "status": "online",                           (optional, defaults to "online")
 *   "agent_version": "1.0.5",                     (optional)
 *   "ip_address": "192.168.1.100",                (optional)
 *   "system_info": { ... }                        (optional)
 * }
 * 
 * Note: Agents typically send agent_id, not endpoint_id. We look up endpoint by agent_id automatically.
 * 
 * Response:
 * {
 *   "success": true,
 *   "policies": [...],
 *   "server_time": "2026-02-07T..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { endpoint_id } = body
    const { agent_id, status, agent_version, ip_address, system_info: _system_info } = body

    // Accept either endpoint_id or agent_id
    if (!endpoint_id && !agent_id) {
      return NextResponse.json({ error: "endpoint_id or agent_id is required" }, { status: 400 })
    }

    // If only agent_id provided, look up the endpoint
    if (!endpoint_id && agent_id) {
      const foundEndpointResult = await query<{ id: string }>(
        `SELECT id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
        [agent_id],
      )
      const foundEndpoint = foundEndpointResult.rows[0]

      if (!foundEndpoint) {
        return NextResponse.json({ error: "Endpoint not found for agent_id" }, { status: 404 })
      }

      endpoint_id = foundEndpoint.id
    }

    // Update endpoint status
    const endpointResult = await query<{ id: string; account_id: string }>(
      `
        UPDATE endpoints
        SET status = $1,
            last_seen_at = NOW(),
            agent_version = COALESCE($2, agent_version),
            ip_address = COALESCE($3, ip_address),
            updated_at = NOW()
        WHERE id = $4
        RETURNING id::text, account_id::text
      `,
      [status || "online", agent_version || null, ip_address || null, endpoint_id],
    )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Fetch policies assigned to this endpoint
    const assignedPoliciesResult = await query<{ policy: Record<string, unknown> }>(
      `
        SELECT row_to_json(p.*) AS policy
        FROM endpoint_policies ep
        JOIN policies p ON p.id = ep.policy_id
        WHERE ep.endpoint_id = $1
      `,
      [endpoint_id],
    )

    // Also fetch account-level default policies
    const defaultPoliciesResult = await query<Record<string, unknown>>(
      `
        SELECT row_to_json(p.*) AS policy
        FROM policies p
        WHERE p.account_id = $1 AND p.is_default = TRUE AND p.is_active = TRUE
      `,
      [endpoint.account_id],
    )

    const allPolicies = [
      ...assignedPoliciesResult.rows.map((row) => row.policy),
      ...defaultPoliciesResult.rows.map((row) => row.policy),
    ].filter(
      (p, i, arr) => p && arr.findIndex((x) => x && x.id === p.id) === i,
    )

    return NextResponse.json({
      success: true,
      policies: allPolicies,
      server_time: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
