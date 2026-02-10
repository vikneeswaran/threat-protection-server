import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find endpoint by agent_id
    const { data: endpoint, error: endpointError } = await supabaseAdmin
      .from("endpoints")
      .select("id")
      .eq("agent_id", agent_id)
      .eq("account_id", account_id)
      .maybeSingle()

    if (endpointError || !endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Get pending scan commands
    const { data: commands, error: commandError } = await supabaseAdmin
      .from("scan_commands")
      .select("*")
      .eq("endpoint_id", endpoint.id)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1) // Get highest priority pending command

    if (commandError) {
      console.error("Error fetching scan commands:", commandError)
      return NextResponse.json({ error: "Failed to fetch commands" }, { status: 500 })
    }

    if (!commands || commands.length === 0) {
      return NextResponse.json({
        has_pending_command: false,
        command: null,
      })
    }

    const command = commands[0]

    // Update command status to 'running'
    await supabaseAdmin
      .from("scan_commands")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", command.id)

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

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find endpoint if not provided
    let resolvedEndpointId = endpoint_id
    if (!resolvedEndpointId) {
      const { data: endpoint, error: endpointError } = await supabaseAdmin
        .from("endpoints")
        .select("id")
        .eq("agent_id", agent_id)
        .eq("account_id", account_id)
        .maybeSingle()

      if (endpointError || !endpoint) {
        return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
      }
      resolvedEndpointId = endpoint.id
    }

    // Create new scan command
    const { data: command, error: commandError } = await supabaseAdmin
      .from("scan_commands")
      .insert({
        account_id,
        endpoint_id: resolvedEndpointId,
        scan_type,
        priority: body.priority || 1,
        status: "pending",
      })
      .select("id")
      .single()

    if (commandError) {
      console.error("Failed to create scan command:", commandError)
      return NextResponse.json({ error: "Failed to create command" }, { status: 500 })
    }

    console.log(`[SCAN COMMAND] Created scan command for endpoint: ${resolvedEndpointId}, type: ${scan_type}`)

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
