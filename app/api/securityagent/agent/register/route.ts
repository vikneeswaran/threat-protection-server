import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface JWTPayload {
  accountId: string;
  iat: number;
  exp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      installationToken,
      registrationToken,
      installerVersion,
      platform,
      // agentId, hostname, os, osVersion are accepted but not used yet
      // They may be used in future updates for endpoint registration
    } = body;

    // -----------------------------------------
    // 1. Validate request
    // -----------------------------------------
    const token = installationToken || registrationToken;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Installation token or registration token is required.",
        },
        { status: 400 }
      );
    }

    if (!installerVersion || typeof installerVersion !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Installer version is required.",
        },
        { status: 400 }
      );
    }

    if (!platform || typeof platform !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Platform is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 2. Validate token format (JWT or legacy)
    // -----------------------------------------
    let accountId: string | null = null;
    let tokenRecord: Record<string, unknown> | null = null;

    // Try JWT token first
    if (token.includes(".")) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        accountId = decoded.accountId;
        
        console.info(
          `[Agent Register] JWT token validated for account: ${accountId}`
        );
      } catch {
        console.warn("[Agent Register] JWT verification failed, trying legacy token");
        // Fall through to legacy token check
      }
    }

    // If JWT didn't work, try legacy token lookup
    if (!accountId) {
      if (token.length !== 128) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid installation token format.",
          },
          { status: 400 }
        );
      }

      const legacyTokenResult = await query(
        `
        SELECT
          id,
          account_id,
          installation_token,
          expires_at
        FROM installation_tokens
        WHERE installation_token = $1
        LIMIT 1
        `,
        [token]
      );

      if (legacyTokenResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid installation token.",
          },
          { status: 401 }
        );
      }

      tokenRecord = legacyTokenResult.rows[0] as Record<string, unknown>;

      // -----------------------------------------
      // 3. Check token expiry (legacy)
      // -----------------------------------------
      if (new Date(tokenRecord.expires_at as string) <= new Date()) {
        return NextResponse.json(
          {
            success: false,
            message: "Installation token has expired.",
          },
          { status: 401 }
        );
      }

      accountId = tokenRecord.account_id as string;
    }

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to resolve account from token.",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 4. Check account
    // -----------------------------------------
    const accountResult = await query(
      `
      SELECT
        id,
        total_licenses,
        allocated_licenses,
        used_licenses,
        is_active
      FROM accounts
      WHERE id = $1
      LIMIT 1
      `,
      [accountId]
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

    const account = accountResult.rows[0] as Record<string, unknown>;

    // -----------------------------------------
    // 5. Check account status
    // -----------------------------------------
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
    // 6. Check license availability
    // -----------------------------------------
    const activeInstancesResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM installation_instances
      WHERE account_id = $1
        AND status IN ('PENDING', 'INSTALLED', 'ACTIVE')
      `,
      [accountId]
    );

    const activeInstances = (activeInstancesResult.rows[0] as Record<string, number>).count;
    const totalLicenses = Number(account.total_licenses);

    if (activeInstances >= totalLicenses) {
      return NextResponse.json(
        {
          success: false,
          message: "No available licenses for this account.",
        },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // 7. Create installation instance
    // -----------------------------------------
    const instanceResult = await query(
      `
      INSERT INTO installation_instances
      (
        account_id,
        installation_token,
        installer_version,
        platform,
        status,
        expires_at,
        installation_token_id
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        'PENDING',
        $5,
        $6
      )
      RETURNING
        id,
        account_id,
        installer_version,
        platform,
        status,
        expires_at,
        created_at,
        installation_token_id
      `,
      [
        accountId,
        token,
        installerVersion,
        platform,
        tokenRecord ? tokenRecord.expires_at : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        tokenRecord ? tokenRecord.id : null,
      ]
    );

    const instance = instanceResult.rows[0] as Record<string, unknown>;

    // -----------------------------------------
    // 8. Return success with account_id
    // -----------------------------------------
    return NextResponse.json({
      success: true,
      message: "Agent registration successful.",
      accountId,
      installationInstanceId: instance.id,
      installerVersion: instance.installer_version,
      platform: instance.platform,
      status: instance.status,
    });
  } catch (error) {
    console.error("Agent Registration Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Agent registration failed.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
