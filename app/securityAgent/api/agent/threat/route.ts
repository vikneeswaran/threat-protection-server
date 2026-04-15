import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint_id, name, description, severity, file_path, file_hash, process_name, detection_engine } = body

    if (!endpoint_id || !name || !severity) {
      return NextResponse.json({ error: "endpoint_id, name, and severity are required" }, { status: 400 })
    }

    // Get the endpoint to find the account
    const endpointResult = await query<{ account_id: string }>(
      `SELECT account_id::text FROM endpoints WHERE id = $1 LIMIT 1`,
      [endpoint_id],
    )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Create the threat record
    const threatResult = await query<{ id: string }>(
      `
        INSERT INTO threats (
          account_id,
          endpoint_id,
          name,
          description,
          severity,
          status,
          file_path,
          file_hash,
          process_name,
          detection_engine,
          detected_at
        )
        VALUES ($1, $2, $3, $4, $5, 'detected', $6, $7, $8, $9, NOW())
        RETURNING id::text
      `,
      [endpoint.account_id, endpoint_id, name, description || null, severity, file_path || null, file_hash || null, process_name || null, detection_engine || null],
    )
    const threat = threatResult.rows[0]

    // Create audit log
    await query(
      `
        INSERT INTO audit_logs (account_id, action, entity_type, entity_id, details, ip_address, user_agent)
        VALUES ($1, 'create', 'threat', $2, $3::jsonb, $4, $5)
      `,
      [
        endpoint.account_id,
        threat.id,
        JSON.stringify({ name, severity, endpoint_id, detection_engine }),
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        request.headers.get("user-agent"),
      ],
    )

    // Check if there's an auto-action policy for this severity
    const threatActionPoliciesResult = await query<{ config: Record<string, unknown> }>(
      `
        SELECT config
        FROM policies
        WHERE account_id = $1 AND type = 'threat_actions' AND is_active = TRUE
      `,
      [endpoint.account_id],
    )

    let autoAction = null
    for (const policy of threatActionPoliciesResult.rows) {
      const config = policy.config as Record<string, unknown>
      const severityActions = config[severity] as { auto_action?: string } | undefined
      if (severityActions?.auto_action) {
        autoAction = severityActions.auto_action
        break
      }
    }

    return NextResponse.json({
      success: true,
      threat_id: threat.id,
      auto_action: autoAction,
    })
  } catch (error) {
    console.error("Threat report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
