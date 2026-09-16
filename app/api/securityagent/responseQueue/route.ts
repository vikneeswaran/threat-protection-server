import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const result = await query(
      `
      SELECT
        t.status,
        COUNT(*) AS count
      FROM threats t
      INNER JOIN endpoints e
        ON t.endpoint_id = e.id
      WHERE e.account_id = $1
      GROUP BY t.status
      ORDER BY t.status;
      `,
      [user.account_id]
    );

    return NextResponse.json({
      success: true,
      queue: result.rows,
    });
  } catch (error) {
    console.error("Response Queue API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch response queue.",
      },
      {
        status: 500,
      }
    );
  }
}