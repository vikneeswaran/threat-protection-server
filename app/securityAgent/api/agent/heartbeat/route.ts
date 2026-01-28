import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint_id, status, agent_version, ip_address, system_info: _system_info } = body

    if (!endpoint_id) {
      return NextResponse.json({ error: "Endpoint ID is required" }, { status: 400 })
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
