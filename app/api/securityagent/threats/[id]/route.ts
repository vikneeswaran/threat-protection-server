import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

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
      WHERE t.id = $1
        AND e.account_id = $2
      `,
      [id, user.account_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Threat not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      threat: result.rows[0],
    });
  } catch (error) {
    console.error("Threat Detail API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load threat",
      },
      { status: 500 }
    );
  }
}