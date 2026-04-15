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
        { status: 400 }
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

    // Get pending scan commands
    const commandsResult = await query<{
      id: string
      scan_type: string
      priority: number
      created_at: string
    }>(
      `
        SELECT id::text, scan_type::text, priority, created_at::text
        FROM scan_commands
        WHERE endpoint_id = $1 AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `,
      [endpoint.id],
    )
    const commands = commandsResult.rows

    if (!commands || commands.length === 0) {
      return NextResponse.json({
        has_pending_command: false,
        command: null,
      })
    }

    const command = commands[0]

    // Update command status to 'running'
    await query(`UPDATE scan_commands SET status = 'running', started_at = NOW() WHERE id = $1`, [command.id])

    return NextResponse.json({
      has_pending_command: true,
      command: {
        id: command.id,
        scan_type: command.scan_type,
        priority: command.priority,
        created_at: command.created_at,
      },
    })
  } catch (error) {
    console.error("Scan commands error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, account_id, endpoint_id, scan_type } = body

    if (!agent_id || !account_id || !scan_type) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, account_id, scan_type" },
        { status: 400 }
      )
    }

    if (!["quick", "full", "realtime"].includes(scan_type)) {
      return NextResponse.json({ error: "Invalid scan_type" }, { status: 400 })
    }

    // Find endpoint if not provided
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

    // Create new scan command
    const commandResult = await query<{ id: string }>(
      `
        INSERT INTO scan_commands (account_id, endpoint_id, scan_type, priority, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id::text
      `,
      [account_id, resolvedEndpointId, scan_type, body.priority || 1],
    )
    const command = commandResult.rows[0]

    console.info(`[SCAN COMMAND] Created scan command for endpoint: ${resolvedEndpointId}, type: ${scan_type}`)

    return NextResponse.json({
      success: true,
      command_id: command.id,
      message: `Scan command created: ${scan_type}`,
    })
  } catch (error) {
    console.error("Scan commands POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
