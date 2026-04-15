import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json({ error: "Missing agent_id" }, { status: 400 })
    }

    const endpointResult = await query<{ id: string; account_id: string }>(
      `SELECT id::text, account_id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
      [agent_id],
    )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 })
    }

    // Delete the endpoint (will trigger auto-decrement of used_licenses via trigger)
    try {
      await query(`DELETE FROM endpoints WHERE id = $1`, [endpoint.id])
    } catch (deleteError) {
      console.error("Error deleting endpoint:", deleteError)
      return NextResponse.json({ error: "Failed to delete endpoint" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Endpoint deregistered successfully",
      endpoint_id: endpoint.id,
      account_id: endpoint.account_id,
    })
  } catch (error) {
    console.error("Error in deregister endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
