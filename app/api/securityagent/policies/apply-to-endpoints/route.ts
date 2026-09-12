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

    const { policyId, accountId } = body;

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

    // If the frontend supplied an accountId, make sure
    // it matches the policy account.
    if (accountId && String(accountId) !== String(policyAccountId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy does not belong to the selected account.",
        },
        { status: 400 }
      );
    }

    
    // --------------------------------------------------
    // 5. Make sure the policy is active
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
    // 6. Get all endpoints belonging to this account
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
    // 7. No endpoints found
    // --------------------------------------------------
    if (endpoints.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: "No endpoints were found for this account.",
      });
    }

    // --------------------------------------------------
    // 8. Assign policy to every endpoint
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
    // 9. Return result
    // --------------------------------------------------
    return NextResponse.json({
      success: true,
      updatedCount,
      message: `Policy "${policy.name}" applied to ${updatedCount} endpoint${
        updatedCount === 1 ? "" : "s"
      }.`,
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