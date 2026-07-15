import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    console.info("Reset password requested for:", email);

    // TODO:
    // 1. Check if the email exists in the database.
    // 2. Generate a reset token.
    // 3. Send the reset password email.

    return NextResponse.json({
      success: true,
      message: "Password reset link sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to send reset email.",
      },
      { status: 500 }
    );
  }
}