import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await request.json();

    return NextResponse.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
  console.error("Reset password error:", error);

  return NextResponse.json(
    {
      success: false,
      message: "Password reset failed.",
    },
    { status: 500 }
  );
}
}