import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getPool } from "@/lib/db";


export async function GET() {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

     const pool = getPool();
       const result = await pool.query(

      `
        SELECT DISTINCT
          type
        FROM public.threats
        WHERE type IS NOT NULL
          AND TRIM(type) <> ''
        ORDER BY type ASC
      `
    );

    const threatTypes = result.rows.map(
      (row) => row.type as string
    );

    // Add optional "Other" option.
    // It does not need to exist in threat_master.
    if (!threatTypes.includes("Other")) {
      threatTypes.push("Other");
    }

    return NextResponse.json(threatTypes);
  } catch (error) {
    console.error("Failed to fetch threat types:", error);

    return NextResponse.json(
      { error: "Failed to fetch threat types" },
      { status: 500 }
    );
  }
}
