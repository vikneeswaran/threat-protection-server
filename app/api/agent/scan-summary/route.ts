import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agent_id,
      account_id,
      endpoint_id,
      scan_id,
      scan_type,
      start_time,
      end_time,
      total_threats,
      severity_breakdown,
    } = body

    if (!agent_id || !account_id || !scan_id || !scan_type || total_threats === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, account_id, scan_id, scan_type, total_threats" },
        { status: 400 }
      )
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get endpoint if not provided
    let resolvedEndpointId = endpoint_id
    if (!resolvedEndpointId) {
      const { data: endpoint } = await supabaseAdmin
        .from("endpoints")
        .select("id")
        .eq("agent_id", agent_id)
        .eq("account_id", account_id)
        .maybeSingle()

      if (!endpoint) {
        return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
      }
      resolvedEndpointId = endpoint.id
    }

    // Record the scan summary
    const { data: scanSummary, error: insertError } = await supabaseAdmin
      .from("scan_summaries")
      .insert({
        account_id,
        endpoint_id: resolvedEndpointId,
        scan_id,
        scan_type,
        start_time: start_time || new Date().toISOString(),
        end_time: end_time || new Date().toISOString(),
        total_threats,
        severity_breakdown: severity_breakdown || {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("Failed to record scan summary:", insertError)
      return NextResponse.json({ error: "Failed to record scan summary" }, { status: 500 })
    }

    // Log the scan summary
    await supabaseAdmin.from("audit_logs").insert({
      account_id,
      action: "scan_completed",
      entity_type: "scan",
      entity_id: scanSummary.id,
      details: {
        scan_type,
        total_threats,
        endpoint_id: resolvedEndpointId,
        severity_breakdown,
      },
    })

    console.log(`[SCAN SUMMARY] Recorded scan ${scan_id}: ${total_threats} threats detected (${scan_type})`)

    return NextResponse.json({
      success: true,
      scan_id: scanSummary.id,
      message: `Scan summary recorded: ${total_threats} threats detected`,
    })
  } catch (error) {
    console.error("Scan summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
