import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

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

    // Get endpoint if not provided
    let resolvedEndpointId = endpoint_id
    if (!resolvedEndpointId) {
      const endpointResult = await query<{ id: string }>(
        `SELECT id::text FROM endpoints WHERE agent_id = $1 AND account_id = $2 LIMIT 1`,
        [agent_id, account_id],
      )
      const endpoint = endpointResult.rows[0]

      if (!endpoint) {
        return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
      }
      resolvedEndpointId = endpoint.id
    }

    // Record the scan summary
    const scanSummaryResult = await query<{ id: string }>(
      `
        INSERT INTO scan_summaries (
          account_id, endpoint_id, scan_id, scan_type, start_time, end_time, total_threats, severity_breakdown
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING id::text
      `,
      [
        account_id,
        resolvedEndpointId,
        scan_id,
        scan_type,
        start_time || new Date().toISOString(),
        end_time || new Date().toISOString(),
        total_threats,
        JSON.stringify(
          severity_breakdown || {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          },
        ),
      ],
    )
    const scanSummary = scanSummaryResult.rows[0]

    // Log the scan summary
    await query(
      `
        INSERT INTO audit_logs (account_id, action, entity_type, entity_id, details)
        VALUES ($1, 'scan_completed', 'scan', $2, $3::jsonb)
      `,
      [account_id, scanSummary.id, JSON.stringify({ scan_type, total_threats, endpoint_id: resolvedEndpointId, severity_breakdown })],
    )

    console.info(`[SCAN SUMMARY] Recorded scan ${scan_id}: ${total_threats} threats detected (${scan_type})`)

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
