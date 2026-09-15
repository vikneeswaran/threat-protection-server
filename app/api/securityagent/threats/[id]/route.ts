import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

function normalizeThreatAction(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "block") {
    return "kill";
  }

  return ["quarantine", "kill", "allow", "restore", "delete"].includes(normalized)
    ? normalized
    : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
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
          COALESCE(e.hostname, 'Unknown Endpoint') AS hostname,
          e.ip_address,
          e.os,
          COALESCE(e.status::text, 'deleted') AS endpoint_status
      FROM threats t
      LEFT JOIN endpoints e
          ON t.endpoint_id = e.id
      WHERE t.id = $1
        AND t.account_id = $2
      `,
      [id, user.account_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Threat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      threat: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load threat",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = normalizeThreatAction(body.action);

    if (!action) {
      return NextResponse.json(
        { success: false, message: "A valid action is required." },
        { status: 400 }
      );
    }

    const threatResult = await query(
      `
      SELECT id, account_id, endpoint_id, file_hash
      FROM threats
      WHERE id = $1
        AND account_id = $2
      LIMIT 1
      `,
      [id, user.account_id]
    );

    if (threatResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Threat not found" },
        { status: 404 }
      );
    }

    const threat = threatResult.rows[0];
    if (!threat.endpoint_id) {
      return NextResponse.json(
        { success: false, message: "Threat has no active endpoint to execute this action." },
        { status: 409 }
      );
    }

    const commandResult = await query(
      `
      INSERT INTO threat_action_commands
      (
        account_id,
        endpoint_id,
        threat_id,
        action,
        status,
        notes,
        payload
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4::threat_action_type,
        'pending',
        $5,
        $6::jsonb
      )
      ON CONFLICT (threat_id, action)
      WHERE status IN ('pending', 'running')
      DO NOTHING
      RETURNING id
      `,
      [
        user.account_id,
        threat.endpoint_id,
        threat.id,
        action,
        typeof body.notes === "string" ? body.notes : null,
        JSON.stringify({ source: "admin", requested_at: new Date().toISOString() }),
      ]
    );

    const persistForFileHash = body.persistForFileHash === true;
    if (persistForFileHash && threat.file_hash) {
      await query(
        `
        INSERT INTO threat_action_policies
        (
          account_id,
          file_hash,
          action,
          updated_by,
          updated_at
        )
        VALUES
        (
          $1,
          $2,
          $3::threat_action_type,
          $4,
          NOW()
        )
        ON CONFLICT (account_id, file_hash)
        DO UPDATE
        SET
          action = EXCLUDED.action,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        `,
        [user.account_id, threat.file_hash, action, user.id]
      );
    }

    return NextResponse.json({
      success: true,
      threatId: threat.id,
      commandId: commandResult.rows[0]?.id ?? null,
      action,
      queued: commandResult.rows.length > 0,
      persistForFileHash,
    });
  } catch (error) {
    console.error("Failed to queue threat action:", error);
    return NextResponse.json(
      { success: false, message: "Failed to queue threat action." },
      { status: 500 }
    );
  }
}