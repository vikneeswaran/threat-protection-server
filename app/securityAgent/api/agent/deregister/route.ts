import { NextResponse } from "next/server"
import { query } from "@/lib/db"

/**
 * POST /api/agent/deregister
 * 
 * Deregister an endpoint from the console without requiring authentication.
 * Called by the uninstaller on the endpoint itself.
 * 
 * Request body:
 * {
 *   "endpoint_id": "uuid",  // Optional - exact endpoint ID
 *   "agent_id": "uuid"      // Optional - agent ID, used if endpoint_id not provided
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "endpoint_id": "uuid",
 *   "message": "Endpoint deregistered successfully"
 * }
 */
export async function POST(request: Request) {
  try {
    const { endpoint_id, agent_id } = await request.json()

    if (!endpoint_id && !agent_id) {
      return NextResponse.json(
        { error: "endpoint_id or agent_id is required" },
        { status: 400 }
      )
    }

    const endpointResult = endpoint_id
      ? await query<{ id: string; account_id: string; hostname: string | null; agent_id: string | null }>(
          `SELECT id::text, account_id::text, hostname, agent_id FROM endpoints WHERE id = $1 LIMIT 1`,
          [endpoint_id],
        )
      : await query<{ id: string; account_id: string; hostname: string | null; agent_id: string | null }>(
          `SELECT id::text, account_id::text, hostname, agent_id FROM endpoints WHERE agent_id = $1 LIMIT 1`,
          [agent_id],
        )
    const endpoint = endpointResult.rows[0]

    if (!endpoint) {
      // Endpoint already deleted or doesn't exist - this is fine, return success
      console.info(`Deregister called for non-existent endpoint (id=${endpoint_id}, agent_id=${agent_id})`)
      return NextResponse.json(
        {
          success: true,
          message: "Endpoint not found or already deregistered",
        },
        { status: 200 }
      )
    }

    // Delete the endpoint (triggers will decrement used_licenses)
    try {
      await query(`DELETE FROM endpoints WHERE id = $1`, [endpoint.id])
    } catch (deleteError) {
      console.error("Failed to delete endpoint:", deleteError)
      // Even if deletion fails, return success to allow uninstallation to continue
      return NextResponse.json(
        {
          success: true,
          endpoint_id: endpoint.id,
          message: "Endpoint deregistration initiated (may require manual cleanup)",
        },
        { status: 200 }
      )
    }

    console.info(`Endpoint deregistered successfully: ${endpoint.id} (agent_id: ${endpoint.agent_id})`)

    return NextResponse.json(
      {
        success: true,
        endpoint_id: endpoint.id,
        account_id: endpoint.account_id,
        message: "Endpoint deregistered successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Deregister endpoint error:", error)
    // Return success even on error to allow uninstallation to proceed
    return NextResponse.json(
      {
        success: true,
        message: "Deregistration request processed (may require manual validation)",
      },
      { status: 200 }
    )
  }
}
