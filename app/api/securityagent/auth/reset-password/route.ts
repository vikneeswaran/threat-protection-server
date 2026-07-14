// import { NextResponse } from "next/server";

// export async function POST(request: Request) {
//   try {
//     const { token, password } = await request.json();

//     // TODO:
//     // Verify token
//     // Update password

//     return NextResponse.json({
//       success: true,
//       message: "Password reset successfully.",
//     });
//   } catch {
//     return NextResponse.json(
//       {
//         message: "Password reset failed.",
//       },
//       { status: 500 }
//     );
//   }
// }



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