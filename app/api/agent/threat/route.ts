import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

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

    const endpointResult = await query<{ id: string }>(
      `SELECT id::text FROM endpoints WHERE agent_id = $1 AND account_id = $2 LIMIT 1`,
      [agent_id, account_id],
    )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Record the threat
    const threatResult = await query<{ id: string }>(
      `
        INSERT INTO threats (
          account_id, endpoint_id, name, description, severity, status, file_path, file_hash, process_name,
          detection_engine, detected_at
        )
        VALUES ($1, $2, $3, $4, $5, 'detected', $6, $7, $8, $9, NOW())
        RETURNING id::text
      `,
      [account_id, endpoint.id, threat_name, details?.description || threat_name, severity, file_path || null, file_hash || null, process_name || null, details?.detection_engine || "signature"],
    )
    const threat = threatResult.rows[0]

    console.info(`[THREAT REPORTED] ${threat_name} (Severity: ${severity}) - Endpoint: ${endpoint.id}`)

    // Get recommended action from policies
    const policyResult = await query<{ type: string; config: Record<string, unknown> | null }>(
      `
        SELECT p.type::text AS type, p.config
        FROM endpoint_policies ep
        JOIN policies p ON p.id = ep.policy_id
        WHERE ep.endpoint_id = $1
      `,
      [endpoint.id],
    )

    let recommendedAction = "alert"

    // Check threat action policies
    const threatActionPolicy = policyResult.rows.find((policy) => policy.type === "threat_actions")

    if (threatActionPolicy?.config) {
      const severityActions = threatActionPolicy.config[severity.toLowerCase()] as { action?: string } | undefined
      if (severityActions?.action) {
        recommendedAction = severityActions.action
      }
    }

    // Log the threat detection
    await query(
      `
        INSERT INTO audit_logs (account_id, action, entity_type, entity_id, details)
        VALUES ($1, 'threat_detected', 'threat', $2, $3::jsonb)
      `,
      [account_id, threat.id, JSON.stringify({ threat_name, severity, endpoint_id: endpoint.id, recommended_action: recommendedAction })],
    )

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
