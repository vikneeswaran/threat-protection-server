import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getPool } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";

function getLicenceType(licenses: number): number {
  if (licenses >= 1 && licenses <= 50) {
    return 2;
  }

  if (licenses >= 51 && licenses <= 100) {
    return 3;
  }

  if (licenses >= 101 && licenses <= 500) {
    return 4;
  }

  if (licenses >= 501) {
    return 5;
  }

  return 0;
}

export async function POST(request: Request) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // -----------------------------------
    // 1. Identify logged-in user
    // -----------------------------------

    const currentUser = await requireSessionUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // -----------------------------------
    // 2. Read request data
    // -----------------------------------

    const body = await request.json();

    const {
      fullName,
      email,
      password,
      confirmPassword,
      userType,
    } = body;

    const cleanedFullName = String(fullName || "")
      .trim()
      .replace(/\s+/g, " ");

    const cleanedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const cleanedUserType = String(userType || "")
      .trim()
      .toLowerCase();

    // -----------------------------------
    // 3. Validate input
    // -----------------------------------

    if (
      !cleanedFullName ||
      !cleanedEmail ||
      !password ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Full name, email, password and confirm password are required.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Password and confirm password do not match.",
        },
        { status: 400 }
      );
    }

    if (!["admin", "viewer"].includes(cleanedUserType)) {
      return NextResponse.json(
        {
          success: false,
          message: "User type must be Admin or Non-Admin.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------
    // 4. Start transaction
    // -----------------------------------

    await client.query("BEGIN");

    // -----------------------------------
    // 5. Get current user's account
    // -----------------------------------

    const accountResult = await client.query(
      `
      SELECT
        id,
        name,
        total_licenses,
        is_active
      FROM accounts
      WHERE id = $1
        AND is_active = TRUE
      FOR UPDATE
      `,
      [currentUser.account_id]
    );

    if (accountResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "Account not found.",
        },
        { status: 404 }
      );
    }

    const account = accountResult.rows[0];

    // -----------------------------------
    // 6. Check duplicate email
    // -----------------------------------

    const existingUser = await client.query(
      `
      SELECT id
      FROM app_users
      WHERE LOWER(TRIM(email)) = $1
      LIMIT 1
      `,
      [cleanedEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "Email already registered.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------
    // 7. Determine licence type
    //
    // IMPORTANT:
    // Creating a user DOES NOT consume
    // or allocate any licenses.
    // -----------------------------------

    const totalLicenses = Number(account.total_licenses);

    const licenceType = getLicenceType(totalLicenses);

    if (licenceType === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to determine license type for this account.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------
    // 8. Hash password
    // -----------------------------------

    const passwordHash = await bcrypt.hash(password, 10);

    // -----------------------------------
    // 9. Create app_users record
    // -----------------------------------

    const userResult = await client.query(
      `
      INSERT INTO app_users
      (
        id,
        email,
        full_name,
        company_name,
        password_hash,
        licence_type,
        email_verified,
        is_active
      )
      VALUES
      (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        FALSE,
        TRUE
      )
      RETURNING id
      `,
      [
        cleanedEmail,
        cleanedFullName,
        account.name,
        passwordHash,
        licenceType,
      ]
    );

    const newUserId = userResult.rows[0].id;

    // -----------------------------------
    // 10. Create profile
    //
    // IMPORTANT:
    // User stays inside the CURRENT account.
    // We do NOT create another accounts row.
    // -----------------------------------

    await client.query(
      `
      INSERT INTO profiles
      (
        id,
        account_id,
        email,
        full_name,
        role,
        is_active
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5::user_role,
        TRUE
      )
      `,
      [
        newUserId,
        currentUser.account_id,
        cleanedEmail,
        cleanedFullName,
        cleanedUserType,
      ]
    );

    // -----------------------------------
    // 11. Commit
    // -----------------------------------

    await client.query("COMMIT");

    // -----------------------------------
    // 12. Return success
    // -----------------------------------

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully.",

        user: {
          id: newUserId,
          fullName: cleanedFullName,
          email: cleanedEmail,
          role: cleanedUserType,
          companyName: account.name,
          accountId: currentUser.account_id,
          licenceType,
        },

        licenses: {
          totalLicenses: totalLicenses,
          allocatedLicensesChanged: false,
          usedLicensesChanged: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // -----------------------------------
    // Rollback on failure
    // -----------------------------------

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    console.error("Create User Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create user.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}