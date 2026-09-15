import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

// Fetch all detected threats with endpoint information.
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
        COALESCE(e.hostname, 'Unknown Endpoint') AS hostname,
        e.ip_address,
        e.os,
        COALESCE(e.status::text, 'deleted') AS endpoint_status
      FROM threats t
      LEFT JOIN endpoints e
        ON t.endpoint_id = e.id
      WHERE t.account_id = $1
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

    return NextResponse.json({
      success: false,
      message: "Failed to fetch threats.",
    });
  }
}