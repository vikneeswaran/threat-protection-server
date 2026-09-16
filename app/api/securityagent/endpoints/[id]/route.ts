import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // -----------------------------------------
    // 1. Authenticate dashboard user
    // -----------------------------------------
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: endpointId } = await params;

    if (!endpointId) {
      return NextResponse.json(
        { error: "Endpoint ID is required." },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Find endpoint inside user's account
    // -----------------------------------------
    const endpointResult = await query(
      `
        SELECT
          id,
          account_id,
          status
        FROM endpoints
        WHERE id = $1
          AND account_id = $2
        LIMIT 1
      `,
      [endpointId, user.account_id]
    );

    if (endpointResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found." },
        { status: 404 }
      );
    }

    const endpoint = endpointResult.rows[0];

    // -----------------------------------------
    // 3. NEVER allow deletion while online
    // -----------------------------------------
    if (endpoint.status === "online") {
      return NextResponse.json(
        {
          error: "Endpoint must be offline before it can be deleted.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 4. Mark installation instance uninstalled
    // -----------------------------------------
    await query(
  `
    UPDATE installation_instances
    SET
      status = 'UNINSTALLED'
    WHERE endpoint_id = $1
      AND account_id = $2
  `,
  [endpointId, user.account_id]
);

    // -----------------------------------------
    // 5. Delete endpoint
    //
    // Related endpoint records that use
    // ON DELETE CASCADE will be removed too.
    // -----------------------------------------
    const deleteResult = await query(
      `
        DELETE FROM endpoints
        WHERE id = $1
          AND account_id = $2
          AND status = 'offline'::endpoint_status
        RETURNING id
      `,
      [endpointId, user.account_id]
    );

    // -----------------------------------------
    // 6. Protect against a race condition
    // -----------------------------------------
    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Endpoint could not be deleted. It may have come online.",
        },
        { status: 409 }
      );
    }

    console.info(
      `[Endpoint Delete] Deleted endpoint ${endpointId} for account ${user.account_id}`
    );

    return NextResponse.json({
      success: true,
      message: "Endpoint deleted successfully.",
      endpointId,
    });
  } catch (error) {
    console.error("Endpoint Delete Error:", error);

    return NextResponse.json(
      {
        error: "Failed to delete endpoint.",
      },
      { status: 500 }
    );
  }
}