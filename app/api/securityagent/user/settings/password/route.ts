import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

import { query } from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type UserRow = {
  id: string;
  password_hash: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = body;

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          error: "All fields are required.",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        {
          error: "New password and Confirm password do not match.",
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("kta_session")?.value;

    if (!token) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const tokenHash = hashToken(token);

    const result = await query<UserRow>(
      `
      SELECT
          u.id,
          u.password_hash
      FROM app_sessions s
      INNER JOIN app_users u
          ON u.id = s.user_id
      WHERE
          s.session_token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.is_active = TRUE
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Verify using bcrypt
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    // Verify using PostgreSQL crypt()
    const cryptCheck = await query(
      `
      SELECT id
      FROM app_users
      WHERE
          id = $1
          AND password_hash = crypt($2, password_hash)
      `,
      [user.id, currentPassword]
    );

    if (!passwordMatch || cryptCheck.rows.length === 0) {
      return NextResponse.json(
        {
          error: "Current password is incorrect.",
        },
        { status: 401 }
      );
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      10
    );

    await query(
      `
      UPDATE app_users
      SET
          password_hash = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [newPasswordHash, user.id]
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error(
      "Update Password Error:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to update password.",
      },
      {
        status: 500,
      }
    );
  }
}