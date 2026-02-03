import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

    const admin = createAdminClient()

    // Find the endpoint by endpoint_id or agent_id
    const query = admin
      .from("endpoints")
      .select("id, account_id, hostname, agent_id")
      .limit(1)

    if (endpoint_id) {
      query.eq("id", endpoint_id)
    } else if (agent_id) {
      query.eq("agent_id", agent_id)
    }

    const { data: endpoint, error: findError } = await query.maybeSingle()

    if (findError) {
      console.error("Error finding endpoint:", findError)
      return NextResponse.json(
        { 
          success: false,
          message: "Could not find endpoint"
        },
        { status: 404 }
      )
    }

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
    const { error: deleteError } = await admin
      .from("endpoints")
      .delete()
      .eq("id", endpoint.id)

    if (deleteError) {
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
