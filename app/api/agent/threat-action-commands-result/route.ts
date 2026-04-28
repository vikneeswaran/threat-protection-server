import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, account_id, command_id, status = "completed", error_message, result_details } = body

    if (!agent_id || !account_id || !command_id) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, account_id, command_id" },
        { status: 400 },
      )
    }

    if (!["completed", "failed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const commandResult = await query<{
      id: string
      account_id: string
      endpoint_id: string
      threat_id: string
      action: string
      created_by: string | null
      threat_name: string | null
      previous_status: string
    }>(
      `
        SELECT
          c.id::text,
          c.account_id::text,
          c.endpoint_id::text,
          c.threat_id::text,
          c.action::text,
          c.created_by::text,
          t.name AS threat_name,
          t.status::text AS previous_status
        FROM threat_action_commands c
        JOIN endpoints e ON e.id = c.endpoint_id
        LEFT JOIN threats t ON t.id = c.threat_id
        WHERE c.id = $1
          AND c.account_id = $2
          AND e.agent_id = $3
        LIMIT 1
      `,
      [command_id, account_id, agent_id],
    )

    const command = commandResult.rows[0]
    if (!command) {
      return NextResponse.json({ error: "Command not found" }, { status: 404 })
    }

    const newStatus = status === "completed" ? "completed" : "failed"

    await query(
      `
        UPDATE threat_action_commands
        SET status = $1,
            completed_at = NOW(),
            error_message = $2,
            result_details = $3::jsonb,
            updated_at = NOW()
        WHERE id = $4
      `,
      [newStatus, error_message || null, JSON.stringify(result_details ?? null), command_id],
    )

    await query(
      `
        INSERT INTO audit_logs (account_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'threat_action', 'threat', $3, $4::jsonb)
      `,
      [
        command.account_id,
        command.created_by,
        command.threat_id,
        JSON.stringify({
          command_id,
          source: "agent",
          result_status: newStatus,
          action: command.action,
          threat_name: command.threat_name,
          previous_status: command.previous_status,
          error_message: error_message || null,
        }),
      ],
    )

    return NextResponse.json({ success: true, command_id, status: newStatus })
  } catch (error) {
    console.error("Threat action command result error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
