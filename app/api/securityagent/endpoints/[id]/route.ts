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
    //
    // effective_status is determined from the
    // last heartbeat, not the stored status.
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
        WHERE e.id = $1
          AND e.account_id = $2
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
    //
    // Online = heartbeat received within the
    // last 2 minutes.
    // -----------------------------------------
    if (endpoint.effective_status === "online") {
      return NextResponse.json(
        {
          error:
            "Endpoint must be offline before it can be deleted.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 4. Find active installation instance
    //
    // Only these statuses consume a license:
    // PENDING / INSTALLED / ACTIVE
    // -----------------------------------------
    const installationResult = await query(
      `
        SELECT
          id
        FROM installation_instances
        WHERE endpoint_id = $1
          AND account_id = $2
          AND status IN ('PENDING', 'INSTALLED', 'ACTIVE')
      `,
      [endpointId, user.account_id]
    );

    const licensesToRelease =
      installationResult.rows.length;

    // -----------------------------------------
    // 5. Mark active installation as UNINSTALLED
    // -----------------------------------------
    if (licensesToRelease > 0) {
      await query(
        `
          UPDATE installation_instances
          SET
            status = 'UNINSTALLED',
            uninstalled_at = NOW(),
            updated_at = NOW()
          WHERE endpoint_id = $1
            AND account_id = $2
            AND status IN ('PENDING', 'INSTALLED', 'ACTIVE')
        `,
        [endpointId, user.account_id]
      );
    }

    // -----------------------------------------
    // 6. Release license
    //
    // available_licenses is a GENERATED column:
    //
    // GREATEST(
    //   allocated_licenses - used_licenses,
    //   0
    // )
    //
    // Therefore we ONLY update used_licenses.
    // PostgreSQL automatically recalculates
    // available_licenses.
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
    // 7. Delete endpoint
    //
    // Use last_seen_at instead of stored status.
    // This allows stale "online" records to be
    // deleted when no heartbeat was received
    // for more than 2 minutes.
    // -----------------------------------------
    const deleteResult = await query(
      `
        DELETE FROM endpoints
        WHERE id = $1
          AND account_id = $2
          AND (
            last_seen_at IS NULL
            OR last_seen_at < NOW() - INTERVAL '2 minutes'
          )
        RETURNING id
      `,
      [endpointId, user.account_id]
    );

    // -----------------------------------------
    // 8. Protect against a race condition
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

    if (licensesToRelease > 0) {
      console.info(
        `[Endpoint Delete] Released ${licensesToRelease} license(s) for account ${user.account_id}`
      );
    }

    // -----------------------------------------
    // 9. Success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Endpoint deleted successfully.",
      endpointId,
      licenseReleased: licensesToRelease,
    });
  } catch (error) {
    console.error(
      "Endpoint Delete Error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to delete endpoint.",
      },
      { status: 500 }
    );
  }
}