import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await query(`
      SELECT
        COUNT(*) FILTER (
          WHERE DATE(detected_at) = CURRENT_DATE
        ) AS detected,

        COUNT(*) FILTER (
          WHERE severity = 'critical'
        ) AS critical,

        COUNT(*) FILTER (
          WHERE status = 'detected'
        ) AS open_incidents,

        COUNT(*) FILTER (
          WHERE DATE(resolved_at) = CURRENT_DATE
        ) AS resolved
      FROM threats
      WHERE account_id = $1;
    `, [user.account_id]);

    return NextResponse.json({
      success: true,
      summary: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch threat summary",
      },
      { status: 500 }
    );
  }
}