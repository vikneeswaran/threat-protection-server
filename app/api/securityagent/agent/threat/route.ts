import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      installationInstanceId,
      endpointId,
      agentId,
      accountId,
      name,
      description,
      severity,
      type,
      filePath,
      fileHash,
      processName,
      processId,
      detectionEngine,
      detectionSource,
    } = body;

    // --------------------------------------------------
    // 1. Validate required threat information
    // --------------------------------------------------

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Threat name is required.",
        },
        { status: 400 }
      );
    }

    if (!severity || typeof severity !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Threat severity is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Validate installation instance
    // --------------------------------------------------

    if (
      !installationInstanceId ||
      typeof installationInstanceId !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance ID is required.",
        },
        { status: 400 }
      );
    }

    const instanceResult = await query(
      `
      SELECT
        id,
        account_id,
        endpoint_id,
        status,
        expires_at
      FROM installation_instances
      WHERE id = $1
      LIMIT 1
      `,
      [installationInstanceId]
    );

    if (instanceResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance not found.",
        },
        { status: 404 }
      );
    }

    const instance = instanceResult.rows[0];

    // --------------------------------------------------
    // 3. Validate installation instance status
    // --------------------------------------------------

    if (!["PENDING", "INSTALLED", "ACTIVE"].includes(instance.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance is not active.",
        },
        { status: 403 }
      );
    }

    if (
      instance.expires_at &&
      new Date(instance.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation instance has expired.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 4. Resolve account
    // --------------------------------------------------

    const resolvedAccountId = instance.account_id;

    if (accountId && accountId !== resolvedAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Account does not match installation instance.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 5. Validate account
    // --------------------------------------------------

    const accountResult = await query(
      `
      SELECT
        id,
        is_active
      FROM accounts
      WHERE id = $1
      LIMIT 1
      `,
      [resolvedAccountId]
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

    // --------------------------------------------------
    // 6. Resolve endpoint
    // --------------------------------------------------

    const resolvedEndpointId = endpointId || instance.endpoint_id;

    if (!resolvedEndpointId) {
      return NextResponse.json(
        {
          success: false,
          message: "Endpoint ID is required.",
        },
        { status: 400 }
      );
    }

    const endpointResult = await query(
      `
      SELECT
        id,
        account_id,
        agent_id
      FROM endpoints
      WHERE id = $1
      LIMIT 1
      `,
      [resolvedEndpointId]
    );

    if (endpointResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Endpoint not found.",
        },
        { status: 404 }
      );
    }

    const endpoint = endpointResult.rows[0];

    // --------------------------------------------------
    // 7. Make sure endpoint belongs to same account
    // --------------------------------------------------

    if (endpoint.account_id !== resolvedAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Endpoint does not belong to the installation account.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 8. Validate agent ID when provided
    // --------------------------------------------------

    if (
      agentId &&
      endpoint.agent_id &&
      agentId !== endpoint.agent_id
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Agent ID does not match endpoint.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 9. Validate severity
    // --------------------------------------------------

    const allowedSeverities = [
      "low",
      "medium",
      "high",
      "critical",
    ];

    if (!allowedSeverities.includes(severity.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid threat severity.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 10. Insert threat
    // --------------------------------------------------

    const threatResult = await query(
      `
      INSERT INTO threats
      (
        account_id,
        endpoint_id,
        name,
        description,
        severity,
        type,
        file_path,
        file_hash,
        process_name,
        process_id,
        detection_engine,
        detection_source,
        detected_at,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5::threat_severity,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING
        id,
        account_id,
        endpoint_id,
        name,
        description,
        severity,
        status,
        type,
        file_path,
        file_hash,
        process_name,
        process_id,
        detection_engine,
        detection_source,
        detected_at,
        created_at,
        updated_at
      `,
      [
        resolvedAccountId,
        resolvedEndpointId,
        name,
        description || null,
        severity.toLowerCase(),
        type || "unknown",
        filePath || null,
        fileHash || null,
        processName || null,
        processId ?? null,
        detectionEngine || null,
        detectionSource || "agent",
      ]
    );

    const threat = threatResult.rows[0];

    // --------------------------------------------------
    // 11. Return success
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        message: "Threat reported successfully.",
        threat,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Agent Threat Reporting Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to report threat.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}