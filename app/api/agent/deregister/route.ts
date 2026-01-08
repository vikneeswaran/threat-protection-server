import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json({ error: "Missing agent_id" }, { status: 400 })
    }

    // Use admin client since this is called during uninstall (no user auth)
    const supabase = createAdminClient()

    // Find the endpoint by agent_id
    const { data: endpoint, error: findError } = await supabase
      .from("endpoints")
      .select("id, account_id")
      .eq("agent_id", agent_id)
      .single()

    if (findError || !endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Delete the endpoint (will trigger auto-decrement of used_licenses via trigger)
    const { error: deleteError } = await supabase
      .from("endpoints")
      .delete()
      .eq("id", endpoint.id)

    if (deleteError) {
      console.error("Error deleting endpoint:", deleteError)
      return NextResponse.json({ error: "Failed to delete endpoint" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Endpoint deregistered successfully",
      endpoint_id: endpoint.id,
      account_id: endpoint.account_id,
    })
  } catch (error) {
    console.error("Error in deregister endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
