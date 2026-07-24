import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(`
    SELECT
status,
COUNT(*) AS count
FROM threats
GROUP BY status;
    `);

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