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

    const result = await query(
      `
        SELECT
          account_id,
          allow_child_overrides,
          created_at,
          updated_at
        FROM public.account_policy_settings
        WHERE account_id = $1
      `,
      [user.account_id]
    );

    // The account should normally already have a settings row
    // because we initialized existing accounts.
    // This fallback also handles newly created accounts.
    if (result.rows.length === 0) {
      const created = await query(
        `
          INSERT INTO public.account_policy_settings (
            account_id,
            allow_child_overrides
          )
          VALUES ($1, FALSE)
          RETURNING
            account_id,
            allow_child_overrides,
            created_at,
            updated_at
        `,
        [user.account_id]
      );

      return NextResponse.json({
        account_id: created.rows[0].account_id,
        allowChildOverrides:
          created.rows[0].allow_child_overrides,
        created_at: created.rows[0].created_at,
        updated_at: created.rows[0].updated_at,
      });
    }

    return NextResponse.json({
      account_id: result.rows[0].account_id,
      allowChildOverrides:
        result.rows[0].allow_child_overrides,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error) {
    console.error(
      "Failed to fetch policy settings:",
      error
    );

    return NextResponse.json(
      { error: "Failed to fetch policy settings" },
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
      allowChildOverrides,
    } = body;

    if (
      typeof allowChildOverrides !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "allowChildOverrides must be a boolean",
        },
        { status: 400 }
      );
    }

    const result = await query(
      `
        INSERT INTO public.account_policy_settings (
          account_id,
          allow_child_overrides
        )
        VALUES ($1, $2)
        ON CONFLICT (account_id)
        DO UPDATE SET
          allow_child_overrides = EXCLUDED.allow_child_overrides,
          updated_at = NOW()
        RETURNING
          account_id,
          allow_child_overrides,
          created_at,
          updated_at
      `,
      [
        user.account_id,
        allowChildOverrides,
      ]
    );

    return NextResponse.json({
      account_id: result.rows[0].account_id,
      allowChildOverrides:
        result.rows[0].allow_child_overrides,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error) {
    console.error(
      "Failed to update policy settings:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update policy settings" },
      { status: 500 }
    );
  }
}