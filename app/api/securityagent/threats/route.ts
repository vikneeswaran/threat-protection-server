import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Fetch all detected threats with endpoint information.
export async function GET() {
  try {
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
      ORDER BY t.detected_at DESC
      `
    );

    return NextResponse.json({
      success: true,
      threats: result.rows,
    });
  } catch (error) {
  console.error("Threat API Error:", error);

  return NextResponse.json({
    success: false,
    message: "Failed to fetch threats."
  });
}
}