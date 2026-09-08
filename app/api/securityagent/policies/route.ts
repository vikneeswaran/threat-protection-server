import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

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
     * Get the current account and its parent.
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

    const account = accountResult.rows[0];

    /*
     * Get the current account's policy setting.
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
        ? settingsResult.rows[0].allow_child_overrides
        : false;

    /*
     * Get policies owned by the current account.
     *
     * These include both normal policies created directly
     * by the account and child-specific override policies.
     */
    const ownPoliciesResult = await query(
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
        WHERE account_id = $1
        ORDER BY created_at DESC
      `,
      [user.account_id]
    );

    /*
     * Start with policies owned by the current account.
     */
    const policies = ownPoliciesResult.rows.map((policy) => ({
      ...policy,
      is_inherited: false,
      parent_allows_child_overrides: false,
    }));

    /*
     * If this account has a parent, inherit the parent's
     * policies automatically.
     */
    if (account.parent_account_id) {
      /*
       * Get the parent's policies.
       *
       * A parent policy is excluded if this child already
       * has an override for that policy.
       */
      const inheritedPoliciesResult = await query(
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
            p.status
          FROM public.policies p
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

      /*
       * Check whether the parent allows children to
       * override inherited policies.
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
          ? parentSettingsResult.rows[0]
              .allow_child_overrides
          : false;

      /*
       * Add inherited policies to the response.
       */
      for (const policy of inheritedPoliciesResult.rows) {
        policies.push({
          ...policy,
          is_inherited: true,
          parent_allows_child_overrides:
            parentAllowsChildOverrides,
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
     * Validate policy name.
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
     * Validate description length.
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
     * Policy configuration stored in JSONB.
     */
    const config = {
      threatType,
      priority,
      action,
    };

    /*
     * Create a policy owned by the current account.
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
     * Validate policy ID.
     */
    if (!id) {
      return NextResponse.json(
        { error: "Policy ID is required" },
        { status: 400 }
      );
    }

    /*
     * Validate policy name.
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
     * Validate description length.
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
     * Policy configuration.
     */
    const config = {
      threatType,
      priority,
      action,
    };

    /*
     * First determine whether this policy belongs to
     * the current account or is an inherited parent policy.
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

    const existingPolicy = policyResult.rows[0];

    /*
     * CASE 1:
     *
     * Policy belongs directly to the current account.
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
        is_inherited: false,
        parent_allows_child_overrides: false,
      });
    }

    /*
     * CASE 2:
     *
     * Policy belongs to another account.
     *
     * It can only be edited if:
     *
     * 1. It belongs to the current account's parent.
     * 2. The parent allows child overrides.
     */
    if (
      existingPolicy.account_id !==
      (
        await query(
          `
            SELECT parent_account_id
            FROM public.accounts
            WHERE id = $1
          `,
          [user.account_id]
        )
      ).rows[0]?.parent_account_id
    ) {
      return NextResponse.json(
        {
          error:
            "You are not allowed to modify this policy",
        },
        { status: 403 }
      );
    }

    /*
     * Check the parent's child override setting.
     */
    const parentSettingsResult = await query(
      `
        SELECT
          allow_child_overrides
        FROM public.account_policy_settings
        WHERE account_id = $1
      `,
      [existingPolicy.account_id]
    );

    const parentAllowsChildOverrides =
      parentSettingsResult.rows.length > 0
        ? parentSettingsResult.rows[0]
            .allow_child_overrides
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
     * Check whether an override already exists.
     */
    const existingOverrideResult = await query(
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
     * Normally an inherited policy should not have an
     * existing override because GET hides the parent
     * once an override exists.
     *
     * This check protects us against duplicate overrides.
     */
    if (existingOverrideResult.rows.length > 0) {
      const overrideId =
        existingOverrideResult.rows[0].id;

      const updateResult = await query(
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
        is_inherited: false,
        parent_allows_child_overrides:
          true,
      });
    }

    /*
     * Create a child-specific override.
     *
     * IMPORTANT:
     *
     * We do NOT modify the parent's policy.
     *
     * The child gets its own policy linked through
     * parent_policy_id.
     */
    const overrideResult = await query(
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
        is_inherited: false,
        parent_allows_child_overrides:
          true,
      },
      { status: 201 }
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

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const policyId = searchParams.get("id");

    if (!policyId) {
      return NextResponse.json(
        { error: "Policy ID is required" },
        { status: 400 }
      );
    }

    /*
     * Only policies owned by the current account can
     * be deleted.
     *
     * Inherited parent policies cannot be deleted from
     * a child account.
     */
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