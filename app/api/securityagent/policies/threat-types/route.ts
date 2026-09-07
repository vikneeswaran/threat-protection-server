import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await query(
      `
        SELECT DISTINCT
          threat_name
        FROM public.threat_master
        WHERE threat_name IS NOT NULL
          AND TRIM(threat_name) <> ''
        ORDER BY threat_name ASC
      `
    );

    const threatTypes = result.rows.map(
      (row) => row.threat_name as string
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