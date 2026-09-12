import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

/*
 * ============================================================
 * GET
 * ============================================================
 *
 * Parent account:
 *   - Returns its own policies
 *   - Returns direct child account policies
 *
 * Child account:
 *   - Returns its own policies
 *   - Returns inherited policies from its parent
 *
 * Additional fields returned:
 *
 *   applies_to_account_id
 *   applies_to_account_name
 *   is_current_account
 *   is_inherited
 *   parent_allows_child_overrides
 *
 * These fields allow the frontend to correctly enable/disable
 * the Edit button based on the selected child account.
 */
export async function GET() {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
     * --------------------------------------------------------
     * Get current account
     * --------------------------------------------------------
     */
    const accountResult = await query(
      `
        SELECT
          id,
          name,
          parent_account_id
        FROM public.accounts
        WHERE id = $1
      `,
      [user.account_id]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const account = accountResult.rows[0];

    /*
     * --------------------------------------------------------
     * Get current account policy setting
     * --------------------------------------------------------
     */
    const settingsResult = await query(
      `
        SELECT
          allow_child_overrides
        FROM public.account_policy_settings
        WHERE account_id = $1
      `,
      [user.account_id]
    );

    const allowChildOverrides =
      settingsResult.rows.length > 0
        ? Boolean(
            settingsResult.rows[0]
              .allow_child_overrides
          )
        : false;

    const policies: any[] = [];

    /*
     * ========================================================
     * CASE 1
     * ========================================================
     *
     * Current account's own policies.
     *
     * These are always associated with the current account.
     */
    const ownPoliciesResult = await query(
      `
        SELECT
          p.id,
          p.account_id,
          p.parent_policy_id,
          p.name,
          p.description,
          p.type,
          p.config,
          p.is_default,
          p.is_active,
          p.created_by,
          p.created_at,
          p.updated_at,
          p.status,
          a.name AS account_name
        FROM public.policies p
        LEFT JOIN public.accounts a
          ON a.id = p.account_id
        WHERE p.account_id = $1
        ORDER BY p.created_at DESC
      `,
      [user.account_id]
    );

    for (const policy of ownPoliciesResult.rows) {
      policies.push({
        ...policy,

        /*
         * The account that actually owns/applies the policy.
         */
        applies_to_account_id:
          policy.account_id,

        applies_to_account_name:
          policy.account_name ||
          account.name ||
          null,

        /*
         * This policy belongs to the logged-in account.
         */
        is_current_account: true,

        is_inherited: false,

        parent_allows_child_overrides: false,
      });
    }

    /*
     * ========================================================
     * CASE 2
     * ========================================================
     *
     * Logged-in user is a PARENT account.
     *
     * Return direct child policies as well.
     *
     * Example:
     *
     * Parent
     *   ├── Child 1
     *   └── Child 2
     *
     * The returned account_id remains:
     *
     *   Parent Policy -> Parent ID
     *   Child 1      -> Child 1 ID
     *   Child 2      -> Child 2 ID
     *
     * This is important for the frontend Edit button.
     */
    if (!account.parent_account_id) {
      const childPoliciesResult = await query(
        `
          SELECT
            p.id,
            p.account_id,
            p.parent_policy_id,
            p.name,
            p.description,
            p.type,
            p.config,
            p.is_default,
            p.is_active,
            p.created_by,
            p.created_at,
            p.updated_at,
            p.status,
            a.name AS account_name
          FROM public.policies p
          INNER JOIN public.accounts a
            ON a.id = p.account_id
          WHERE a.parent_account_id = $1
          ORDER BY p.created_at DESC
        `,
        [user.account_id]
      );

      /*
       * Get parent's child override setting.
       *
       * Child policies that are already stored in the child
       * account are treated as child-owned policies.
       */
      for (const policy of childPoliciesResult.rows) {
        policies.push({
          ...policy,

          applies_to_account_id:
            policy.account_id,

          applies_to_account_name:
            policy.account_name || null,

          /*
           * This is a child account policy, not the
           * logged-in parent account policy.
           */
          is_current_account: false,

          /*
           * A policy physically stored in a child account
           * is not inherited in this response.
           */
          is_inherited: false,

          parent_allows_child_overrides:
            allowChildOverrides,
        });
      }
    }

    /*
     * ========================================================
     * CASE 3
     * ========================================================
     *
     * Logged-in user is a CHILD account.
     *
     * Get policies from the parent.
     *
     * If the child already has an override of a parent policy,
     * don't show the parent policy as inherited.
     */
    if (account.parent_account_id) {
      /*
       * Check parent setting.
       */
      const parentSettingsResult = await query(
        `
          SELECT
            allow_child_overrides
          FROM public.account_policy_settings
          WHERE account_id = $1
        `,
        [account.parent_account_id]
      );

      const parentAllowsChildOverrides =
        parentSettingsResult.rows.length > 0
          ? Boolean(
              parentSettingsResult.rows[0]
                .allow_child_overrides
            )
          : false;

      /*
       * Get parent account name.
       */
      const parentAccountResult = await query(
        `
          SELECT
            id,
            name
          FROM public.accounts
          WHERE id = $1
        `,
        [account.parent_account_id]
      );

      const parentAccount =
        parentAccountResult.rows[0];

      /*
       * Get parent's policies that have not already
       * been overridden by this child.
       */
      const inheritedPoliciesResult =
        await query(
          `
            SELECT
              p.id,
              p.account_id,
              p.parent_policy_id,
              p.name,
              p.description,
              p.type,
              p.config,
              p.is_default,
              p.is_active,
              p.created_by,
              p.created_at,
              p.updated_at,
              p.status,
              a.name AS account_name
            FROM public.policies p
            LEFT JOIN public.accounts a
              ON a.id = p.account_id
            WHERE p.account_id = $1
              AND NOT EXISTS (
                SELECT 1
                FROM public.policies child_policy
                WHERE child_policy.account_id = $2
                  AND child_policy.parent_policy_id = p.id
              )
            ORDER BY p.created_at DESC
          `,
          [
            account.parent_account_id,
            user.account_id,
          ]
        );

      for (const policy of inheritedPoliciesResult.rows) {
        policies.push({
          ...policy,

          /*
           * IMPORTANT:
           *
           * account_id remains the actual owner of the
           * policy (the parent).
           */
          applies_to_account_id:
            user.account_id,

          /*
           * From the child's point of view, the inherited
           * policy applies to the current child account.
           */
          applies_to_account_name:
            account.name || null,

          /*
           * This is not owned by the current account.
           */
          is_current_account: false,

          is_inherited: true,

          parent_allows_child_overrides:
            parentAllowsChildOverrides,

          /*
           * Useful for debugging/UI if needed.
           */
          inherited_from_account_id:
            parentAccount?.id ||
            account.parent_account_id,

          inherited_from_account_name:
            parentAccount?.name || null,
        });
      }
    }

    return NextResponse.json({
      policies,
      allowChildOverrides,
    });
  } catch (error) {
    console.error(
      "Failed to fetch policies:",
      error
    );

    return NextResponse.json(
      { error: "Failed to fetch policies" },
      { status: 500 }
    );
  }
}

/*
 * ============================================================
 * POST
 * ============================================================
 *
 * Creates a policy owned by the current account.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      name,
      description,
      threatType,
      priority,
      action,
    } = body;

    /*
     * Validate name.
     */
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Policy name is required" },
        { status: 400 }
      );
    }

    /*
     * Validate threat type.
     */
    if (!threatType) {
      return NextResponse.json(
        { error: "Threat type is required" },
        { status: 400 }
      );
    }

    /*
     * Validate priority.
     */
    if (!priority) {
      return NextResponse.json(
        { error: "Priority is required" },
        { status: 400 }
      );
    }

    /*
     * Validate action.
     */
    if (!action) {
      return NextResponse.json(
        { error: "Default action is required" },
        { status: 400 }
      );
    }

    /*
     * Validate description.
     */
    if (
      typeof description === "string" &&
      description.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            "Description must be 200 characters or less",
        },
        { status: 400 }
      );
    }

    /*
     * Policy JSON configuration.
     */
    const config = {
      threatType,
      priority,
      action,
    };

    /*
     * Create policy for current account.
     */
    const result = await query(
      `
        INSERT INTO public.policies (
          account_id,
          parent_policy_id,
          name,
          description,
          type,
          config,
          is_default,
          is_active,
          created_by,
          status
        )
        VALUES (
          $1,
          NULL,
          $2,
          $3,
          'threat_actions'::policy_type,
          $4::jsonb,
          FALSE,
          TRUE,
          $5,
          'active'::policy_status
        )
        RETURNING
          id,
          account_id,
          parent_policy_id,
          name,
          description,
          type,
          config,
          is_default,
          is_active,
          created_by,
          created_at,
          updated_at,
          status
      `,
      [
        user.account_id,
        name.trim(),
        description?.trim() || null,
        JSON.stringify(config),
        user.id,
      ]
    );

    return NextResponse.json(
      {
        ...result.rows[0],

        applies_to_account_id:
          user.account_id,

        is_current_account: true,

        is_inherited: false,

        parent_allows_child_overrides: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Failed to create policy:",
      error
    );

    return NextResponse.json(
      { error: "Failed to create policy" },
      { status: 500 }
    );
  }
}

/*
 * ============================================================
 * PATCH
 * ============================================================
 *
 * Supports:
 *
 * 1. Current account editing its own policy.
 *
 * 2. Parent account editing a policy owned by one of its
 *    direct children.
 *
 * 3. Child account editing an inherited parent policy by
 *    creating a child-specific override.
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      id,
      name,
      description,
      threatType,
      priority,
      action,
    } = body;

    /*
     * --------------------------------------------------------
     * Validation
     * --------------------------------------------------------
     */
    if (!id) {
      return NextResponse.json(
        { error: "Policy ID is required" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Policy name is required" },
        { status: 400 }
      );
    }

    if (!threatType) {
      return NextResponse.json(
        { error: "Threat type is required" },
        { status: 400 }
      );
    }

    if (!priority) {
      return NextResponse.json(
        { error: "Priority is required" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Default action is required" },
        { status: 400 }
      );
    }

    if (
      typeof description === "string" &&
      description.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            "Description must be 200 characters or less",
        },
        { status: 400 }
      );
    }

    const config = {
      threatType,
      priority,
      action,
    };

    /*
     * --------------------------------------------------------
     * Get current account
     * --------------------------------------------------------
     */
    const accountResult = await query(
      `
        SELECT
          id,
          parent_account_id
        FROM public.accounts
        WHERE id = $1
      `,
      [user.account_id]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const currentAccount =
      accountResult.rows[0];

    /*
     * --------------------------------------------------------
     * Get requested policy
     * --------------------------------------------------------
     */
    const policyResult = await query(
      `
        SELECT
          id,
          account_id,
          parent_policy_id,
          name,
          description,
          type,
          config,
          is_default,
          is_active,
          created_by,
          created_at,
          updated_at,
          status
        FROM public.policies
        WHERE id = $1
      `,
      [id]
    );

    if (policyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    const existingPolicy =
      policyResult.rows[0];

    /*
     * ========================================================
     * CASE 1
     * ========================================================
     *
     * Policy belongs directly to current account.
     *
     * Normal update.
     */
    if (
      existingPolicy.account_id ===
      user.account_id
    ) {
      const result = await query(
        `
          UPDATE public.policies
          SET
            name = $1,
            description = $2,
            config = $3::jsonb,
            status = 'active'::policy_status,
            is_active = TRUE,
            updated_at = NOW()
          WHERE id = $4
            AND account_id = $5
          RETURNING
            id,
            account_id,
            parent_policy_id,
            name,
            description,
            type,
            config,
            is_default,
            is_active,
            created_by,
            created_at,
            updated_at,
            status
        `,
        [
          name.trim(),
          description?.trim() || null,
          JSON.stringify(config),
          id,
          user.account_id,
        ]
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...result.rows[0],

        applies_to_account_id:
          user.account_id,

        is_current_account: true,

        is_inherited: false,

        parent_allows_child_overrides: false,
      });
    }

    /*
     * ========================================================
     * CASE 2
     * ========================================================
     *
     * Current account is a PARENT and the policy belongs
     * to one of its direct CHILD accounts.
     *
     * Parent can update the child-owned policy.
     */
    if (!currentAccount.parent_account_id) {
      const childAccountResult = await query(
        `
          SELECT
            id,
            name
          FROM public.accounts
          WHERE id = $1
            AND parent_account_id = $2
        `,
        [
          existingPolicy.account_id,
          user.account_id,
        ]
      );

      if (
        childAccountResult.rows.length > 0
      ) {
        const result = await query(
          `
            UPDATE public.policies
            SET
              name = $1,
              description = $2,
              config = $3::jsonb,
              status = 'active'::policy_status,
              is_active = TRUE,
              updated_at = NOW()
            WHERE id = $4
              AND account_id = $5
            RETURNING
              id,
              account_id,
              parent_policy_id,
              name,
              description,
              type,
              config,
              is_default,
              is_active,
              created_by,
              created_at,
              updated_at,
              status
          `,
          [
            name.trim(),
            description?.trim() || null,
            JSON.stringify(config),
            id,
            existingPolicy.account_id,
          ]
        );

        if (result.rowCount === 0) {
          return NextResponse.json(
            { error: "Policy not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ...result.rows[0],

          applies_to_account_id:
            existingPolicy.account_id,

          applies_to_account_name:
            childAccountResult.rows[0]
              .name || null,

          is_current_account: false,

          is_inherited: false,

          parent_allows_child_overrides:
            true,
        });
      }
    }

    /*
     * ========================================================
     * CASE 3
     * ========================================================
     *
     * Current account is a CHILD.
     *
     * Requested policy belongs to its PARENT.
     *
     * We do not modify the parent policy.
     *
     * Instead, create/update a child-specific override.
     */
    if (
      currentAccount.parent_account_id &&
      existingPolicy.account_id ===
        currentAccount.parent_account_id
    ) {
      /*
       * Check parent setting.
       */
      const parentSettingsResult =
        await query(
          `
            SELECT
              allow_child_overrides
            FROM public.account_policy_settings
            WHERE account_id = $1
          `,
          [
            currentAccount.parent_account_id,
          ]
        );

      const parentAllowsChildOverrides =
        parentSettingsResult.rows.length > 0
          ? Boolean(
              parentSettingsResult.rows[0]
                .allow_child_overrides
            )
          : false;

      if (!parentAllowsChildOverrides) {
        return NextResponse.json(
          {
            error:
              "Parent account does not allow child account overrides",
          },
          { status: 403 }
        );
      }

      /*
       * Check if child override already exists.
       */
      const existingOverrideResult =
        await query(
          `
            SELECT
              id
            FROM public.policies
            WHERE account_id = $1
              AND parent_policy_id = $2
            LIMIT 1
          `,
          [
            user.account_id,
            existingPolicy.id,
          ]
        );

      /*
       * ------------------------------------------------------
       * Existing override
       * ------------------------------------------------------
       */
      if (
        existingOverrideResult.rows.length >
        0
      ) {
        const overrideId =
          existingOverrideResult.rows[0].id;

        const updateResult =
          await query(
            `
              UPDATE public.policies
              SET
                name = $1,
                description = $2,
                config = $3::jsonb,
                status = 'active'::policy_status,
                is_active = TRUE,
                updated_at = NOW()
              WHERE id = $4
                AND account_id = $5
              RETURNING
                id,
                account_id,
                parent_policy_id,
                name,
                description,
                type,
                config,
                is_default,
                is_active,
                created_by,
                created_at,
                updated_at,
                status
            `,
            [
              name.trim(),
              description?.trim() || null,
              JSON.stringify(config),
              overrideId,
              user.account_id,
            ]
          );

        return NextResponse.json({
          ...updateResult.rows[0],

          applies_to_account_id:
            user.account_id,

          is_current_account: true,

          is_inherited: false,

          parent_allows_child_overrides:
            true,
        });
      }

      /*
       * ------------------------------------------------------
       * Create new child override
       * ------------------------------------------------------
       */
      const overrideResult =
        await query(
          `
            INSERT INTO public.policies (
              account_id,
              parent_policy_id,
              name,
              description,
              type,
              config,
              is_default,
              is_active,
              created_by,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::jsonb,
              $7,
              TRUE,
              $8,
              'active'::policy_status
            )
            RETURNING
              id,
              account_id,
              parent_policy_id,
              name,
              description,
              type,
              config,
              is_default,
              is_active,
              created_by,
              created_at,
              updated_at,
              status
          `,
          [
            user.account_id,
            existingPolicy.id,
            name.trim(),
            description?.trim() || null,
            existingPolicy.type,
            JSON.stringify(config),
            existingPolicy.is_default,
            user.id,
          ]
        );

      return NextResponse.json(
        {
          ...overrideResult.rows[0],

          applies_to_account_id:
            user.account_id,

          is_current_account: true,

          is_inherited: false,

          parent_allows_child_overrides:
            true,
        },
        { status: 201 }
      );
    }

    /*
     * ========================================================
     * Unauthorized
     * ========================================================
     */
    return NextResponse.json(
      {
        error:
          "You are not allowed to modify this policy",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error(
      "Failed to update policy:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update policy" },
      { status: 500 }
    );
  }
}

/*
 * ============================================================
 * DELETE
 * ============================================================
 *
 * Parent:
 *   - Can delete its own policy.
 *   - Can delete a direct child policy.
 *
 * Child:
 *   - Can delete only its own policy.
 *   - Cannot delete inherited parent policy.
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const policyId =
      searchParams.get("id");

    if (!policyId) {
      return NextResponse.json(
        { error: "Policy ID is required" },
        { status: 400 }
      );
    }

    /*
     * Get current account.
     */
    const accountResult = await query(
      `
        SELECT
          id,
          parent_account_id
        FROM public.accounts
        WHERE id = $1
      `,
      [user.account_id]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const currentAccount =
      accountResult.rows[0];

    /*
     * Get policy.
     */
    const policyResult = await query(
      `
        SELECT
          id,
          account_id,
          parent_policy_id
        FROM public.policies
        WHERE id = $1
      `,
      [policyId]
    );

    if (policyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    const policy =
      policyResult.rows[0];

    /*
     * --------------------------------------------------------
     * Current account owns the policy.
     * --------------------------------------------------------
     */
    if (
      policy.account_id ===
      user.account_id
    ) {
      const result = await query(
        `
          DELETE FROM public.policies
          WHERE id = $1
            AND account_id = $2
          RETURNING id
        `,
        [
          policyId,
          user.account_id,
        ]
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        id: result.rows[0].id,
      });
    }

    /*
     * --------------------------------------------------------
     * Parent deleting direct child policy.
     * --------------------------------------------------------
     */
    if (!currentAccount.parent_account_id) {
      const childResult = await query(
        `
          SELECT
            id
          FROM public.accounts
          WHERE id = $1
            AND parent_account_id = $2
        `,
        [
          policy.account_id,
          user.account_id,
        ]
      );

      if (childResult.rows.length > 0) {
        const result = await query(
          `
            DELETE FROM public.policies
            WHERE id = $1
              AND account_id = $2
            RETURNING id
          `,
          [
            policyId,
            policy.account_id,
          ]
        );

        if (result.rowCount === 0) {
          return NextResponse.json(
            { error: "Policy not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          id: result.rows[0].id,
        });
      }
    }

    /*
     * --------------------------------------------------------
     * Inherited parent policy.
     *
     * Child must never delete the parent policy.
     * --------------------------------------------------------
     */
    return NextResponse.json(
      {
        error:
          "Inherited policies cannot be deleted",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error(
      "Failed to delete policy:",
      error
    );

    return NextResponse.json(
      { error: "Failed to delete policy" },
      { status: 500 }
    );
  }
}
