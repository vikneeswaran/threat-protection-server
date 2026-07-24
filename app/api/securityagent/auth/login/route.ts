import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { query } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

type LoginUserRow = {
  id: string;
  password_hash: string;
};

// API endpoint to authenticate user login and create a session.
export async function POST(request: Request) {
  try {

    // Extract and clean login credentials from request body.
    const body = await request.json()
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")

    
    // Validate that email and password are provided before login.
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }
    
    // Fetch active user details and verify password from database.
    const result = await query<LoginUserRow>(
      `
        SELECT id, password_hash
        FROM app_users
        WHERE email = $1
          AND is_active = TRUE
          AND password_hash IS NOT NULL
          AND password_hash = crypt($2, password_hash)
        LIMIT 1
      `,
      [email, password]
    )

const user = result.rows[0];

// Return error response when user credentials are invalid.
if (!user) {
  return NextResponse.json(
    { error: "Invalid email or password" },
    { status: 401 }
  );
}

// Compare entered password with stored hashed password.
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

    // Update user's last login time after successful authentication.
    await query(
      `
        UPDATE app_users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
    )

    // Create user session after successful login.
    await createSession(user.id)

    return NextResponse.json({ success: true })
  
    // Handle unexpected errors during login process.
  } catch (error) {
    console.error("Security agent login error", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
