import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agent_id,
      account_id,
      command_id,
      scan_id,
      scan_type,
      total_threats,
      severity_breakdown,
      status = "completed",
      error_message,
    } = body

    if (!agent_id || !account_id || !command_id) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, account_id, command_id" },
        { status: 400 }
      )
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update the scan command with results
    const { error: updateError } = await supabaseAdmin
      .from("scan_commands")
      .update({
        status,
        result_scan_id: scan_id || null,
        completed_at: new Date().toISOString(),
        error_message: error_message || null,
      })
      .eq("id", command_id)
      .eq("account_id", account_id)

    if (updateError) {
      console.error("Failed to update scan command:", updateError)
      return NextResponse.json({ error: "Failed to update command" }, { status: 500 })
    }

    // If this was a successful scan, also update the scan summary endpoint info
    if (status === "completed" && scan_id && total_threats !== undefined) {
      // Find endpoint for this scan
      const { data: command } = await supabaseAdmin
        .from("scan_commands")
        .select("endpoint_id")
        .eq("id", command_id)
        .single()

      if (command) {
        // Update endpoint with last scan info
        await supabaseAdmin
          .from("agent_instances")
          .update({
            last_threat_scan: new Date().toISOString(),
            threat_count_last_scan: total_threats,
          })
          .eq("agent_id", agent_id)
          .eq("account_id", account_id)
      }
    }

    console.log(
      `[SCAN COMMAND RESULT] Command ${command_id}: ${status} - ${total_threats || 0} threats found`
    )

    return NextResponse.json({
      success: true,
      command_id,
      message: `Scan command completed with status: ${status}`,
    })
  } catch (error) {
    console.error("Scan command result error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
