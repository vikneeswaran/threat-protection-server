import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, account_id, status, system_info } = body

    if (!agent_id || !account_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // First, try to find endpoint by agent_id
    let endpoint: any = null
    let findError: any = null

    const { data: foundByAgentId, error: findByAgentError } = await supabaseAdmin
      .from("endpoints")
      .select("id")
      .eq("account_id", account_id)
      .eq("agent_id", agent_id)
      .maybeSingle()

    if (findByAgentError) {
      console.error("Error finding endpoint by agent_id:", findByAgentError)
      return NextResponse.json({ error: "Failed to find endpoint" }, { status: 500 })
    }

    if (foundByAgentId) {
      // Found by agent_id, update directly
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("endpoints")
        .update({
          status: status || "online",
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", foundByAgentId.id)
        .select("id, policies:endpoint_policies(policy:policies(*))")
        .single()

      if (updateError) {
        console.error("Failed to update endpoint:", updateError)
        return NextResponse.json({ error: "Failed to update endpoint" }, { status: 500 })
      }

      endpoint = updated
    } else {
      // Endpoint not found by agent_id
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Return assigned policies
    const policies = endpoint.policies?.map((p: any) => p.policy) || []

    return NextResponse.json({
      success: true,
      policies,
    })
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
