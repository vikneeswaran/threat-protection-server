import { NextRequest, NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function DELETE(request: NextRequest) {
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

    // -----------------------------------------
    // 2. Read endpoint IDs
    // -----------------------------------------
    const body = await request.json().catch(() => null);

    const endpointIds = body?.endpointIds;

    if (
      !Array.isArray(endpointIds) ||
      endpointIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one endpoint ID is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. Validate endpoint IDs
    // -----------------------------------------
    const uniqueEndpointIds = [
      ...new Set(
        endpointIds.filter(
          (id): id is string =>
            typeof id === "string" &&
            id.trim().length > 0
        )
      ),
    ];

    if (uniqueEndpointIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one valid endpoint ID is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 4. Find selected endpoints belonging
    //    to the authenticated account
    // -----------------------------------------
    const endpointResult = await query(
      `
        SELECT
          id,
          account_id,
          status
        FROM endpoints
        WHERE account_id = $1
          AND id = ANY($2::uuid[])
      `,
      [
        user.account_id,
        uniqueEndpointIds,
      ]
    );

    // -----------------------------------------
    // 5. Make sure every requested endpoint
    //    belongs to the user's account
    // -----------------------------------------
    if (
      endpointResult.rows.length !==
      uniqueEndpointIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "One or more selected endpoints were not found.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // 6. NEVER allow online endpoints to be
    //    deleted
    // -----------------------------------------
    const onlineEndpoints =
      endpointResult.rows.filter(
        (endpoint) => endpoint.status === "online"
      );

    if (onlineEndpoints.length > 0) {
      return NextResponse.json(
        {
          error:
            "Online endpoints cannot be deleted. All selected endpoints must be offline.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 7. Mark installation instances as
    //    UNINSTALLED
    // -----------------------------------------
    await query(
      `
        UPDATE installation_instances
        SET
          status = 'UNINSTALLED'
        WHERE account_id = $1
          AND endpoint_id = ANY($2::uuid[])
      `,
      [
        user.account_id,
        uniqueEndpointIds,
      ]
    );

    // -----------------------------------------
    // 8. Delete the selected endpoints
    //    only when they are offline
    // -----------------------------------------
    const deleteResult = await query(
      `
        DELETE FROM endpoints
        WHERE account_id = $1
          AND id = ANY($2::uuid[])
          AND status = 'offline'::endpoint_status
        RETURNING id
      `,
      [
        user.account_id,
        uniqueEndpointIds,
      ]
    );

    const deletedEndpointIds =
      deleteResult.rows.map(
        (row) => row.id
      );

    // -----------------------------------------
    // 9. Protect against a race condition
    // -----------------------------------------
    if (
      deletedEndpointIds.length !==
      uniqueEndpointIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Some endpoints could not be deleted. They may have come online.",
          deletedEndpointIds,
        },
        { status: 409 }
      );
    }

    console.info(
      `[Bulk Endpoint Delete] Deleted ${deletedEndpointIds.length} endpoints for account ${user.account_id}`
    );

    // -----------------------------------------
    // 10. Success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: `${deletedEndpointIds.length} ${
        deletedEndpointIds.length === 1
          ? "endpoint"
          : "endpoints"
      } deleted successfully.`,
      deletedEndpointIds,
      deletedCount: deletedEndpointIds.length,
    });
  } catch (error) {
    console.error(
      "Bulk Endpoint Delete Error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete selected endpoints.",
      },
      { status: 500 }
    );
  }
}