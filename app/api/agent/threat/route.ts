import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agent_id,
      account_id,
      threat_name,
      threat_type,
      severity,
      file_path,
      file_hash,
      process_name,
      process_id,
      details,
    } = body

    if (!agent_id || !account_id || !threat_name || !severity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    )

    // Get endpoint ID
    const { data: endpoint } = await supabaseAdmin
      .from("endpoints")
      .select("id")
      .eq("agent_id", agent_id)
      .eq("account_id", account_id)
      .maybeSingle()

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Record the threat
    const { data: threat, error: insertError } = await supabaseAdmin
      .from("threats")
      .insert({
        account_id,
        endpoint_id: endpoint.id,
        name: threat_name,
        type: threat_type || "unknown",
        description: details?.description || threat_name,
        severity,
        status: "detected",
        file_path,
        file_hash: file_hash || null,
        process_name: process_name || null,
        process_id: process_id ? parseInt(process_id) : null,
        detection_engine: details?.detection_engine || "signature",
        detection_source: "scan",
        detected_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("Failed to record threat:", insertError)
      return NextResponse.json({ error: "Failed to record threat" }, { status: 500 })
    }

    console.info(`[THREAT REPORTED] ${threat_name} (Severity: ${severity}) - Endpoint: ${endpoint.id}`)

    // Get recommended action from policies
    const { data: policies } = await supabaseAdmin
      .from("endpoint_policies")
      .select("policy:policies(*)")
      .eq("endpoint_id", endpoint.id)

    let recommendedAction = "alert"

    // Check threat action policies
    const threatActionPolicy = Array.isArray(policies) 
      ? (policies as Array<{ policy?: { type?: string; settings?: Record<string, { action?: string }> } }>).find(
          (p) => p.policy?.type === "threat_actions"
        )
      : null

    if (threatActionPolicy?.policy?.settings) {
      const settings = threatActionPolicy.policy.settings
      const severityActions = settings[severity.toLowerCase()]
      if (severityActions?.action) {
        recommendedAction = severityActions.action
      }
    }

    // Log the threat detection
    await supabaseAdmin.from("audit_logs").insert({
      account_id,
      action: "threat_detected",
      entity_type: "threat",
      entity_id: threat.id,
      details: {
        threat_name,
        severity,
        endpoint_id: endpoint.id,
        recommended_action: recommendedAction,
      },
    })

    return NextResponse.json({
      success: true,
      threat_id: threat.id,
      recommended_action: recommendedAction,
    })
  } catch (error) {
    console.error("Threat report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
