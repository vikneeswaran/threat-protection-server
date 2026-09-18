import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      agent_id,
      agentId,
      account_id,
      accountId,
      endpoint_id,
      endpointId,
    } = body;

    const resolvedAgentId = agent_id || agentId;
    const requestedAccountId =
      account_id || accountId;
    const resolvedEndpointId =
      endpoint_id || endpointId;

    if (!resolvedAgentId && !resolvedEndpointId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "agent_id or endpoint_id is required for deregistration.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 1. Resolve the endpoint and account
    //
    // If endpoint_id is provided, get the
    // account_id directly from the database.
    // This prevents license release from
    // depending on account_id being sent
    // by the agent.
    // -----------------------------------------
    let targetEndpointId:
      | string
      | null =
      resolvedEndpointId || null;

    let resolvedAccountId:
      | string
      | null =
      requestedAccountId || null;

    if (resolvedEndpointId) {
      const endpointResult = await query(
        `
        SELECT
          id,
          account_id,
          agent_id
        FROM endpoints
        WHERE id = $1
        LIMIT 1
        `,
        [resolvedEndpointId]
      );

      if (endpointResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Endpoint not found.",
          },
          { status: 404 }
        );
      }

      const endpoint =
        endpointResult.rows[0] as {
          id: string;
          account_id: string;
          agent_id: string | null;
        };

      targetEndpointId = endpoint.id;

      // Always use the database account ID.
      resolvedAccountId =
        endpoint.account_id;

      console.info(
        `[Agent Deregister] Resolved endpoint ${targetEndpointId} to account ${resolvedAccountId}`
      );
    } else if (resolvedAgentId) {
      // -----------------------------------------
      // Resolve endpoint using agent_id
      // -----------------------------------------
      const endpointResult =
        resolvedAccountId
          ? await query(
              `
              SELECT
                id,
                account_id,
                agent_id
              FROM endpoints
              WHERE agent_id = $1
                AND account_id = $2
              LIMIT 1
              `,
              [
                resolvedAgentId,
                resolvedAccountId,
              ]
            )
          : await query(
              `
              SELECT
                id,
                account_id,
                agent_id
              FROM endpoints
              WHERE agent_id = $1
              LIMIT 1
              `,
              [resolvedAgentId]
            );

      if (endpointResult.rows.length > 0) {
        const endpoint =
          endpointResult.rows[0] as {
            id: string;
            account_id: string;
            agent_id: string | null;
          };

        targetEndpointId =
          endpoint.id;

        // Always prefer the database value.
        resolvedAccountId =
          endpoint.account_id;

        console.info(
          `[Agent Deregister] Resolved agent ${resolvedAgentId} to endpoint ${targetEndpointId} and account ${resolvedAccountId}`
        );
      }
    }

    // -----------------------------------------
    // 2. Make sure we have an endpoint
    // -----------------------------------------
    if (!targetEndpointId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to find endpoint for deregistration.",
        },
        { status: 404 }
      );
    }

    // -----------------------------------------
    // 3. Update endpoint status to offline
    // -----------------------------------------
    await query(
      `
      UPDATE endpoints
      SET
        status = 'offline'::endpoint_status,
        updated_at = NOW()
      WHERE id = $1
        AND account_id = $2
      `,
      [
        targetEndpointId,
        resolvedAccountId,
      ]
    );

    // -----------------------------------------
    // 4. Find active installation instances
    //
    // Only these statuses consume a license:
    //
    // PENDING
    // INSTALLED
    // ACTIVE
    //
    // UNINSTALLED does NOT consume a license.
    // -----------------------------------------
    const installationResult =
      await query(
        `
        SELECT
          id,
          endpoint_id,
          account_id,
          status
        FROM installation_instances
        WHERE endpoint_id = $1
          AND account_id = $2
          AND status IN (
            'PENDING',
            'INSTALLED',
            'ACTIVE'
          )
        `,
        [
          targetEndpointId,
          resolvedAccountId,
        ]
      );

    const licensesToRelease =
      installationResult.rows.length;

    // -----------------------------------------
    // 5. Mark active installation instances
    //    as UNINSTALLED
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
          AND status IN (
            'PENDING',
            'INSTALLED',
            'ACTIVE'
          )
        `,
        [
          targetEndpointId,
          resolvedAccountId,
        ]
      );
    }

    // -----------------------------------------
    // 6. Release licenses
    //
    // IMPORTANT:
    //
    // available_licenses is a GENERATED column.
    //
    // DO NOT update it directly.
    //
    // Only decrease used_licenses.
    //
    // PostgreSQL automatically recalculates:
    //
    // available_licenses =
    // allocated_licenses - used_licenses
    // -----------------------------------------
    if (licensesToRelease > 0) {
      const licenseResult =
        await query(
          `
          UPDATE accounts
          SET
            used_licenses = GREATEST(
              used_licenses - $2,
              0
            )
          WHERE id = $1
          RETURNING
            id,
            allocated_licenses,
            used_licenses,
            available_licenses
          `,
          [
            resolvedAccountId,
            licensesToRelease,
          ]
        );

      if (
        licenseResult.rows.length > 0
      ) {
        const license =
          licenseResult.rows[0];

        console.info(
          `[Agent Deregister] Released ${licensesToRelease} license(s) for account ${resolvedAccountId}`
        );

        console.info(
          `[Agent Deregister] License state: used=${license.used_licenses}, available=${license.available_licenses}`
        );
      }
    } else {
      console.info(
        `[Agent Deregister] No active installation found for endpoint ${targetEndpointId}. No license released.`
      );
    }

    // -----------------------------------------
    // 7. Final logging
    // -----------------------------------------
    console.info(
      `[Agent Deregister] Successfully deregistered agent: ${
        resolvedAgentId ||
        targetEndpointId
      }`
    );

    // -----------------------------------------
    // 8. Success response
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message:
        "Agent deregistered successfully.",
      agent_id:
        resolvedAgentId || null,
      account_id:
        resolvedAccountId,
      endpoint_id:
        targetEndpointId,
      licensesReleased:
        licensesToRelease,
    });
  } catch (error) {
    console.error(
      "Agent Deregistration Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to deregister agent.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}