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
          error: "At least one endpoint ID is required.",
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
    //
    // effective_status is calculated from
    // last_seen_at, NOT stored status.
    // -----------------------------------------
    const endpointResult = await query(
      `
        SELECT
          e.id,
          e.account_id,
          e.status,
          e.last_seen_at,
          CASE
            WHEN e.last_seen_at IS NOT NULL
              AND e.last_seen_at >= NOW() - INTERVAL '2 minutes'
            THEN 'online'
            ELSE 'offline'
          END AS effective_status
        FROM endpoints e
        WHERE e.account_id = $1
          AND e.id = ANY($2::uuid[])
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
    // 6. NEVER allow currently-online endpoints
    //    to be deleted.
    //
    // Online means heartbeat received within
    // the last 2 minutes.
    // -----------------------------------------
    const onlineEndpoints =
      endpointResult.rows.filter(
        (endpoint) =>
          endpoint.effective_status === "online"
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
    // 7. Find active installations that are
    //    consuming licenses.
    //
    // Only PENDING, INSTALLED and ACTIVE
    // installations consume licenses.
    // -----------------------------------------
    const installationResult = await query(
      `
        SELECT
          id,
          endpoint_id,
          status
        FROM installation_instances
        WHERE account_id = $1
          AND endpoint_id = ANY($2::uuid[])
          AND status IN (
            'PENDING',
            'INSTALLED',
            'ACTIVE'
          )
      `,
      [
        user.account_id,
        uniqueEndpointIds,
      ]
    );

    const licensesToRelease =
      installationResult.rows.length;

    // -----------------------------------------
    // 8. Mark active installations as
    //    UNINSTALLED
    // -----------------------------------------
    if (licensesToRelease > 0) {
      await query(
        `
          UPDATE installation_instances
          SET
            status = 'UNINSTALLED',
            uninstalled_at = NOW(),
            updated_at = NOW()
          WHERE account_id = $1
            AND endpoint_id = ANY($2::uuid[])
            AND status IN (
              'PENDING',
              'INSTALLED',
              'ACTIVE'
            )
        `,
        [
          user.account_id,
          uniqueEndpointIds,
        ]
      );
    }

    // -----------------------------------------
    // 9. Release the corresponding licenses
    //
    // IMPORTANT:
    // available_licenses is a GENERATED column.
    //
    // Therefore we update ONLY used_licenses.
    // PostgreSQL automatically recalculates:
    //
    // available_licenses =
    // allocated_licenses - used_licenses
    // -----------------------------------------
    if (licensesToRelease > 0) {
      await query(
        `
          UPDATE accounts
          SET
            used_licenses = GREATEST(
              used_licenses - $2,
              0
            )
          WHERE id = $1
        `,
        [
          user.account_id,
          licensesToRelease,
        ]
      );
    }

    // -----------------------------------------
    // 10. Delete the selected endpoints.
    //
    // Re-check last_seen_at inside DELETE
    // itself to protect against an endpoint
    // becoming online between validation
    // and deletion.
    // -----------------------------------------
    const deleteResult = await query(
      `
        DELETE FROM endpoints e
        WHERE e.account_id = $1
          AND e.id = ANY($2::uuid[])
          AND (
            e.last_seen_at IS NULL
            OR e.last_seen_at < NOW() - INTERVAL '2 minutes'
          )
        RETURNING e.id
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
    // 11. Protect against a race condition
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

    // -----------------------------------------
    // 12. Logging
    // -----------------------------------------
    console.info(
      `[Bulk Endpoint Delete] Deleted ${deletedEndpointIds.length} endpoints for account ${user.account_id}`
    );

    if (licensesToRelease > 0) {
      console.info(
        `[Bulk Endpoint Delete] Released ${licensesToRelease} license(s) for account ${user.account_id}`
      );
    }

    // -----------------------------------------
    // 13. Success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: `${deletedEndpointIds.length} ${
        deletedEndpointIds.length === 1
          ? "endpoint"
          : "endpoints"
      } deleted successfully.`,
      deletedEndpointIds,
      deletedCount:
        deletedEndpointIds.length,
      licensesReleased: licensesToRelease,
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