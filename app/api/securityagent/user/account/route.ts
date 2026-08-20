import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";

export async function GET() {
  try {
    // Get the currently logged-in user
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // Get the current user's account and license details
    // --------------------------------------------------

    const result = await query(
      `
      SELECT
        id,
        name,
        parent_account_id,
        level,
        total_licenses,
        allocated_licenses,
        used_licenses,
        available_licenses,
        license_expires_at,
        is_active
      FROM accounts
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [user.account_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const account = result.rows[0];

    // --------------------------------------------------
    // Read license values directly from the database
    // --------------------------------------------------

    const totalLicenses =
      Number(account.total_licenses || 0);

    const allocatedLicenses =
      Number(account.allocated_licenses || 0);

    const usedLicenses =
      Number(account.used_licenses || 0);

    const availableLicenses =
      Number(account.available_licenses || 0);

    // --------------------------------------------------
    // Return account information
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },

      account: {
        id: account.id,

        name: account.name,

        parentAccountId:
          account.parent_account_id,

        level: account.level,

        totalLicenses:
          totalLicenses,

        allocatedLicenses:
          allocatedLicenses,

        usedLicenses:
          usedLicenses,

        availableLicenses:
          availableLicenses,

        licenseExpiresAt:
          account.license_expires_at,

        isActive:
          account.is_active,
      },
    });
  } catch (error) {
    console.error(
      "Account API Error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load account information",
      },
      { status: 500 }
    );
  }
}