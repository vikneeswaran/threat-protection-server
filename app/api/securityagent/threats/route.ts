import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

// Fetch detected threats belonging only to endpoints
// of the currently logged-in account.
export async function GET() {
  try {
    const user = await requireSessionUser();
    console.log("THREATS API USER:", {
  id: user?.id,
  email: user?.email,
  account_id: user?.account_id,
});

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await query(
      `
      SELECT
        t.id,
        t.name,
        t.description,
        t.severity,
        t.status,
        t.type,
        t.file_path,
        t.file_hash,
        t.process_name,
        t.process_id,
        t.detection_engine,
        t.detection_source,
        t.detected_at,
        t.resolved_at,
        e.hostname,
        e.ip_address,
        e.os,
        e.status AS endpoint_status
      FROM threats t
      INNER JOIN endpoints e
        ON t.endpoint_id = e.id
      WHERE e.account_id = $1
      ORDER BY t.detected_at DESC
      `,
      [user.account_id]
    );

    return NextResponse.json({
      success: true,
      threats: result.rows,
    });
  } catch (error) {
    console.error("Threat API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch threats.",
      },
      { status: 500 }
    );
  }
}