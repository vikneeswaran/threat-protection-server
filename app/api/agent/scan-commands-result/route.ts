import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agent_id,
      account_id,
      command_id,
      scan_id,
      _scan_type,
      total_threats,
      _severity_breakdown,
      status = "completed",
      error_message,
    } = body

    if (!agent_id || !account_id || !command_id) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, account_id, command_id" },
        { status: 400 }
      )
    }

    await query(
      `
        UPDATE scan_commands
        SET status = $1,
            result_scan_id = $2,
            completed_at = NOW(),
            error_message = $3
        WHERE id = $4 AND account_id = $5
      `,
      [status, scan_id || null, error_message || null, command_id, account_id],
    )

    // If this was a successful scan, also update the scan summary endpoint info
    if (status === "completed" && scan_id && total_threats !== undefined) {
      // Find endpoint for this scan
      const commandResult = await query<{ endpoint_id: string }>(
        `SELECT endpoint_id::text FROM scan_commands WHERE id = $1 LIMIT 1`,
        [command_id],
      )
      const command = commandResult.rows[0]

      if (command) {
        // Update endpoint with last scan info
        await query(
          `
            UPDATE agent_instances
            SET last_threat_scan = NOW(), threat_count_last_scan = $1
            WHERE agent_id = $2 AND account_id = $3
          `,
          [total_threats, agent_id, account_id],
        )
      }
    }

    console.info(
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
