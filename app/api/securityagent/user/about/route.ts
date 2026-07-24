import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";

import { query } from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type AboutUserRow = {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  phone_number: number | null;
  licence_type: number;
  is_active: boolean;
  created_at: Date;
  last_login_at: Date | null;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("kta_session")?.value;

    console.log("Cookie:", token);
    

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokenHash = hashToken(token);
    // console.log("Cookie:", token);
    //    console.log("Hash:", tokenHash);

    // console.log("Token Hash:", tokenHash);

    const result = await query<AboutUserRow>(
      `
      SELECT
          u.id,
          u.full_name,
          u.email,
          u.company_name,
          u.phone_number,
          u.licence_type,
          u.is_active,
          u.created_at,
          u.last_login_at
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

    console.log("Rows Found:", result.rows);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch user details." },
      { status: 500 }
    );
  }
}