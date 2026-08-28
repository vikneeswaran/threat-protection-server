import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      agent_id,
      account_id,
      endpoint_id,
      scan_id,
      scan_type,
      start_time,
      end_time,
      total_threats,
      severity_breakdown,
    } = body;

    // -----------------------------------------
    // 1. Validate required fields
    // -----------------------------------------
    if (!account_id || typeof account_id !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Account ID is required.",
        },
        { status: 400 }
      );
    }

    if (!scan_id || typeof scan_id !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Scan ID is required.",
        },
        { status: 400 }
      );
    }

    if (!scan_type || typeof scan_type !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Scan type is required.",
        },
        { status: 400 }
      );
    }

    if (total_threats === undefined || typeof total_threats !== "number") {
      return NextResponse.json(
        {
          success: false,
          message: "Total threats count is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Verify account exists and is active
    // -----------------------------------------
    const accountResult = await query(
      `
      SELECT
        id,
        is_active
      FROM accounts
      WHERE id = $1
      LIMIT 1
      `,
      [account_id]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Account not found.",
        },
        { status: 404 }
      );
    }

    const account = accountResult.rows[0];

    if (!account.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "Account is inactive.",
        },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // 3. Find or create endpoint from agent_id
    // -----------------------------------------
    let endpointIdToUse = endpoint_id;

    if (!endpointIdToUse && agent_id) {
      const endpointResult = await query(
        `
        SELECT id
        FROM endpoints
        WHERE agent_id = $1
          AND account_id = $2
        LIMIT 1
        `,
        [agent_id, account_id]
      );

      if (endpointResult.rows.length > 0) {
        endpointIdToUse = endpointResult.rows[0].id;
      }
    }

    // -----------------------------------------
    // 4. Parse severity breakdown
    // -----------------------------------------
    const critical = severity_breakdown?.critical || 0;
    const high = severity_breakdown?.high || 0;
    const medium = severity_breakdown?.medium || 0;
    const low = severity_breakdown?.low || 0;

    // -----------------------------------------
    // 5. Insert scan summary record
    // -----------------------------------------
    const scanResult = await query(
      `
      INSERT INTO scan_summaries
      (
        account_id,
        endpoint_id,
        agent_id,
        scan_id,
        scan_type,
        start_time,
        end_time,
        total_threats,
        critical_count,
        high_count,
        medium_count,
        low_count,
        status,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        'completed',
        NOW(),
        NOW()
      )
      RETURNING
        id,
        account_id,
        endpoint_id,
        scan_id,
        scan_type,
        total_threats,
        critical_count,
        high_count,
        medium_count,
        low_count,
        status,
        created_at
      `,
      [
        account_id,
        endpointIdToUse || null,
        agent_id || null,
        scan_id,
        scan_type,
        start_time || new Date().toISOString(),
        end_time || new Date().toISOString(),
        total_threats,
        critical,
        high,
        medium,
        low,
      ]
    );

    const scan = scanResult.rows[0];

    // -----------------------------------------
    // 6. Update endpoint threat status if threats found
    // -----------------------------------------
    if (endpointIdToUse && total_threats > 0) {
      await query(
        `
        UPDATE endpoints
        SET
          infected = true,
          updated_at = NOW()
        WHERE id = $1
        `,
        [endpointIdToUse]
      );
    }

    // -----------------------------------------
    // 7. Log scan summary event
    // -----------------------------------------
    console.info(
      `[Scan Summary Reported] Account: ${account_id}, Scan: ${scan_type}, Threats: ${total_threats}`
    );

    // -----------------------------------------
    // 8. Return success
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Scan summary reported successfully.",
      scanId: scan.id,
      accountId: scan.account_id,
      scanType: scan.scan_type,
      totalThreats: scan.total_threats,
      severityBreakdown: {
        critical: scan.critical_count,
        high: scan.high_count,
        medium: scan.medium_count,
        low: scan.low_count,
      },
      status: scan.status,
      createdAt: scan.created_at,
    });
  } catch (error) {
    console.error("Scan Summary Report Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to report scan summary.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
