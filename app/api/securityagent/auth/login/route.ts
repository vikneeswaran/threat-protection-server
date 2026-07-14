import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { createSession } from "@/lib/auth/session"
import bcrypt from "bcryptjs";
type LoginUserRow = {
  id: string;
  password_hash: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const result = await query<LoginUserRow>(
  `
    SELECT id, password_hash
    FROM app_users
    WHERE email = $1
      AND is_active = TRUE
      AND password_hash IS NOT NULL
    LIMIT 1
  `,
  [email]
);

const user = result.rows[0];

if (!user) {
  return NextResponse.json(
    { error: "Invalid email or password" },
    { status: 401 }
  );
}

const passwordMatch = await bcrypt.compare(
  password,
  user.password_hash
);

if (!passwordMatch) {
  return NextResponse.json(
    { error: "Invalid email or password" },
    { status: 401 }
  );
}
    await query(
      `
        UPDATE app_users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
    )

    await createSession(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Security agent login error", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
