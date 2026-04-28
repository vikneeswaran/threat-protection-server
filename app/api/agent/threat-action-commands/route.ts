import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agent_id = searchParams.get("agent_id")
    const account_id = searchParams.get("account_id")

    if (!agent_id || !account_id) {
      return NextResponse.json(
        { error: "Missing required parameters: agent_id, account_id" },
        { status: 400 },
      )
    }

    const endpointResult = await query<{ id: string }>(
      `SELECT id::text FROM endpoints WHERE agent_id = $1 AND account_id = $2 LIMIT 1`,
      [agent_id, account_id],
    )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    const commandResult = await query<{
      id: string
      threat_id: string
      action: string
      notes: string | null
      created_at: string
      payload: {
        threat_name?: string
        file_path?: string | null
        file_hash?: string | null
        process_id?: number | null
      } | null
      threat_name: string | null
      file_path: string | null
      file_hash: string | null
      process_id: number | null
    }>(
      `
        SELECT
          c.id::text,
          c.threat_id::text,
          c.action::text,
          c.notes,
          c.created_at::text,
          c.payload,
          t.name AS threat_name,
          t.file_path,
          t.file_hash,
          t.process_id
        FROM threat_action_commands c
        LEFT JOIN threats t ON t.id = c.threat_id
        WHERE c.endpoint_id = $1
          AND c.account_id = $2
          AND c.status = 'pending'
        ORDER BY c.created_at ASC
        LIMIT 1
      `,
      [endpoint.id, account_id],
    )

    const command = commandResult.rows[0]

    if (!command) {
      return NextResponse.json({
        has_pending_command: false,
        command: null,
      })
    }

    await query(
      `
        UPDATE threat_action_commands
        SET status = 'running', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [command.id],
    )

    const payload = command.payload ?? {}

    return NextResponse.json({
      has_pending_command: true,
      command: {
        id: command.id,
        threat_id: command.threat_id,
        action: command.action,
        notes: command.notes,
        created_at: command.created_at,
        threat_name: payload.threat_name ?? command.threat_name,
        file_path: payload.file_path ?? command.file_path,
        file_hash: payload.file_hash ?? command.file_hash,
        process_id: payload.process_id ?? command.process_id,
      },
    })
  } catch (error) {
    console.error("Threat action commands error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
