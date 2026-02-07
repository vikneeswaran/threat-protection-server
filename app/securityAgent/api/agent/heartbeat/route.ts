import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const supabaseAdmin = createAdminClient()

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
    let { endpoint_id, agent_id, status, agent_version, ip_address, system_info: _system_info } = body

    // Accept either endpoint_id or agent_id
    if (!endpoint_id && !agent_id) {
      return NextResponse.json({ error: "endpoint_id or agent_id is required" }, { status: 400 })
    }

    // If only agent_id provided, look up the endpoint
    if (!endpoint_id && agent_id) {
      const { data: foundEndpoint } = await supabaseAdmin
        .from("endpoints")
        .select("id")
        .eq("agent_id", agent_id)
        .maybeSingle()

      if (!foundEndpoint) {
        return NextResponse.json({ error: "Endpoint not found for agent_id" }, { status: 404 })
      }

      endpoint_id = foundEndpoint.id
    }

    // Update endpoint status
    const { data: endpoint, error } = await supabaseAdmin
      .from("endpoints")
      .update({
        status: status || "online",
        last_seen_at: new Date().toISOString(),
        agent_version,
        ip_address,
        updated_at: new Date().toISOString(),
      })
      .eq("id", endpoint_id)
      .select("*, account:accounts(id)")
      .single()

    if (error || !endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Fetch policies assigned to this endpoint
    const { data: policies } = await supabaseAdmin
      .from("endpoint_policies")
      .select("policy:policies(*)")
      .eq("endpoint_id", endpoint_id)

    // Also fetch account-level default policies
    const { data: defaultPolicies } = await supabaseAdmin
      .from("policies")
      .select("*")
      .eq("account_id", endpoint.account.id)
      .eq("is_default", true)
      .eq("is_active", true)

    const allPolicies = [...(policies?.map((p) => p.policy) || []), ...(defaultPolicies || [])].filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
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
