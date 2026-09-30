import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Authenticate the logged-in user
    // --------------------------------------------------
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Read request body
    // --------------------------------------------------
    const body = await request.json();

    const {
      policyId,
      accountId,
      mode = "apply",
    } = body;

    if (!policyId) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy ID is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Get the policy
    // --------------------------------------------------
    const policyResult = await query(
      `
      SELECT
        id,
        account_id,
        name,
        config,
        is_active
      FROM policies
      WHERE id = $1
      LIMIT 1
      `,
      [policyId]
    );

    if (policyResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy not found.",
        },
        { status: 404 }
      );
    }

    const policy = policyResult.rows[0];

    // --------------------------------------------------
    // 4. Determine the account to which this policy belongs
    // --------------------------------------------------
    const policyAccountId = policy.account_id;

    if (
      accountId &&
      String(accountId) !== String(policyAccountId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy does not belong to the selected account.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Handle Disable mode
    //
    // Disable is intentionally handled before the active-policy
    // check because a policy must be allowed to transition from
    // active -> disabled.
    // --------------------------------------------------
    if (mode === "disable") {
      // Remove this policy from all endpoints belonging to
      // the policy's account.
      const removedAssignmentsResult = await query(
        `
        DELETE FROM public.endpoint_policies
        WHERE policy_id = $1
          AND endpoint_id IN (
            SELECT id
            FROM public.endpoints
            WHERE account_id = $2
          )
        RETURNING id
        `,
        [policyId, policyAccountId]
      );

      const removedCount =
        removedAssignmentsResult.rows.length;

      // Cancel any pending threat-action commands created by
      // this policy.
      //
      // Commands from other policies or manually-created
      // commands are not affected.
      await query(
        `
        UPDATE public.threat_action_commands
        SET
          status = 'failed',
          error_message = 'Policy disabled before command execution',
          completed_at = NOW(),
          updated_at = NOW()
        WHERE policy_id = $1
          AND status = 'pending'
        `,
        [policyId]
      );

      // Disable the policy itself.
      const disabledPolicyResult = await query(
        `
        UPDATE public.policies
        SET
          status = 'disabled'::policy_status,
          is_active = FALSE,
          updated_at = NOW()
        WHERE id = $1
          AND account_id = $2
        RETURNING id, status, is_active
        `,
        [policyId, policyAccountId]
      );

      if (disabledPolicyResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Policy could not be disabled.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        updatedCount: removedCount,
        commandCreatedCount: 0,
        message:
          `Policy "${policy.name}" was disabled and removed from ` +
          `${removedCount} endpoint assignment${
            removedCount === 1 ? "" : "s"
          }.`,
      });
    }

    // --------------------------------------------------
    // 6. Handle Enable mode
    //
    // Enable must be handled BEFORE the inactive-policy
    // check because a disabled policy has is_active = false.
    // --------------------------------------------------
    if (mode === "enable") {
      // Reactivate the policy.
      const enabledPolicyResult = await query(
        `
        UPDATE public.policies
        SET
          status = 'active'::policy_status,
          is_active = TRUE,
          updated_at = NOW()
        WHERE id = $1
          AND account_id = $2
        RETURNING id, status, is_active
        `,
        [policyId, policyAccountId]
      );

      if (enabledPolicyResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Policy could not be enabled.",
          },
          { status: 404 }
        );
      }

      // Get all endpoints belonging to this account.
      const endpointResult = await query(
        `
        SELECT id
        FROM public.endpoints
        WHERE account_id = $1
        `,
        [policyAccountId]
      );

      let updatedCount = 0;

      // Assign the enabled policy to every endpoint.
      for (const endpoint of endpointResult.rows) {
        const result = await query(
          `
          INSERT INTO public.endpoint_policies
          (
            endpoint_id,
            policy_id,
            assigned_by
          )
          VALUES
          (
            $1,
            $2,
            $3
          )
          ON CONFLICT (endpoint_id, policy_id)
          DO UPDATE SET
            assigned_at = NOW(),
            assigned_by = EXCLUDED.assigned_by
          RETURNING id
          `,
          [
            endpoint.id,
            policyId,
            user.id,
          ]
        );

        if (result.rows.length > 0) {
          updatedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        updatedCount,
        message:
          `Policy "${policy.name}" was enabled and applied to ` +
          `${updatedCount} endpoint${
            updatedCount === 1 ? "" : "s"
          }.`,
      });
    }

    // --------------------------------------------------
    // 7. Make sure the policy is active for normal Apply
    // --------------------------------------------------
    if (policy.is_active === false) {
      return NextResponse.json(
        {
          success: false,
          error: "Inactive policies cannot be applied to endpoints.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 8. Read threat policy configuration
    // --------------------------------------------------
    const policyConfig =
      typeof policy.config === "string"
        ? JSON.parse(policy.config)
        : policy.config || {};

    const threatType = String(
      policyConfig.threatType || ""
    ).trim();

    let action = String(
      policyConfig.action || ""
    ).trim().toLowerCase();

    if (!threatType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This policy does not contain a threat type.",
        },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This policy does not contain a threat action.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 9. Normalize policy action
    //
    // Existing agent behavior:
    // block -> kill
    // --------------------------------------------------
    if (action === "block") {
      action = "kill";
    }

    // --------------------------------------------------
    // 10. Only use actions supported by the existing
    //     threat-action command infrastructure.
    //
    // Allow is intentionally excluded for now because
    // the installed agent whitelist path still needs
    // to be fixed.
    // --------------------------------------------------
    const supportedActions = [
      "quarantine",
      "kill",
      "allow",
      "delete",
    ];

    if (!supportedActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `Policy action "${action}" is not currently supported for Apply Policy.`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 11. Get all endpoints belonging to this account
    // --------------------------------------------------
    const endpointResult = await query(
      `
      SELECT id
      FROM endpoints
      WHERE account_id = $1
      `,
      [policyAccountId]
    );

    const endpoints = endpointResult.rows;

    // --------------------------------------------------
    // 12. No endpoints found
    // --------------------------------------------------
    if (endpoints.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: "No endpoints were found for this account.",
      });
    }

    // --------------------------------------------------
    // 13. Assign policy to every endpoint
    // --------------------------------------------------
    let updatedCount = 0;

    for (const endpoint of endpoints) {
      const result = await query(
        `
        INSERT INTO endpoint_policies
        (
          endpoint_id,
          policy_id,
          assigned_by
        )
        VALUES
        (
          $1,
          $2,
          $3
        )
        ON CONFLICT (endpoint_id, policy_id)
        DO UPDATE SET
          assigned_at = NOW(),
          assigned_by = EXCLUDED.assigned_by
        RETURNING id
        `,
        [
          endpoint.id,
          policyId,
          user.id,
        ]
      );

      if (result.rows.length > 0) {
        updatedCount++;
      }
    }

    // --------------------------------------------------
    // 14. Find existing matching threats
    //
    // Only "detected" threats are processed.
    // Already handled threats will not be processed again.
    // --------------------------------------------------
    const threatResult = await query(
      `
      SELECT
        id,
        endpoint_id,
        file_path,
        process_id,
        file_hash
      FROM threats
      WHERE account_id = $1
        AND status = 'detected'
        AND LOWER(type) = LOWER($2)
      ORDER BY detected_at ASC
      `,
      [
        policyAccountId,
        threatType,
      ]
    );

    const threats = threatResult.rows;

    // --------------------------------------------------
    // 15. Create threat-action commands
    // --------------------------------------------------
    let matchedThreatCount = 0;
    let commandCreatedCount = 0;
    let skippedThreatCount = 0;

    for (const threat of threats) {
      matchedThreatCount++;

      // ----------------------------------------------
      // Validate required data for the action
      // ----------------------------------------------
      if (
        action === "quarantine" &&
        !threat.file_path
      ) {
        skippedThreatCount++;
        continue;
      }

      if (
        action === "kill" &&
        !threat.process_id
      ) {
        skippedThreatCount++;
        continue;
      }

      if (
        action === "allow" &&
        !threat.file_hash &&
        !threat.file_path
      ) {
        skippedThreatCount++;
        continue;
      }

      if (
        action === "delete" &&
        !threat.file_path
      ) {
        skippedThreatCount++;
        continue;
      }

      // ----------------------------------------------
      // Create the same command structure used by the
      // existing manual threat-action functionality.
      //
      // policy_id links this command to the policy that
      // created it so pending commands can be cancelled
      // when that policy is disabled.
      // ----------------------------------------------
      const commandResult = await query(
        `
        INSERT INTO threat_action_commands
        (
          account_id,
          endpoint_id,
          threat_id,
          policy_id,
          action,
          status,
          payload
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5::threat_action_type,
          'pending',
          $6::jsonb
        )
        RETURNING id
        `,
        [
          policyAccountId,
          threat.endpoint_id,
          threat.id,
          policyId,
          action,
          JSON.stringify({
            file_path: threat.file_path ?? null,
            process_id: threat.process_id ?? null,
            file_hash: threat.file_hash ?? null,
          }),
        ]
      );

      if (commandResult.rows.length > 0) {
        commandCreatedCount++;
      }
    }

    // --------------------------------------------------
    // 16. Return result
    // --------------------------------------------------
    return NextResponse.json({
      success: true,

      updatedCount,

      matchedThreatCount,

      commandCreatedCount,

      skippedThreatCount,

      message:
        `Policy "${policy.name}" applied to ${updatedCount} endpoint${
          updatedCount === 1 ? "" : "s"
        }. ` +
        `${commandCreatedCount} threat action command${
          commandCreatedCount === 1 ? "" : "s"
        } created.`,
    });
  } catch (error) {
    console.error(
      "Apply policy to endpoints error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to apply policy to endpoints.",
      },
      { status: 500 }
    );
  }
}