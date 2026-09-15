import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getInstallerData } from "@/lib/installers/installer.service";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser().catch(() => null);
    let accountId: string | null = user?.account_id ?? null;

    if (!accountId) {
      const { searchParams } = new URL(request.url);
      const token = searchParams.get("token");

      if (token) {
        const tokenResult = await query<{ account_id: string }>(
          `SELECT account_id
           FROM installation_tokens
           WHERE installation_token = $1 AND expires_at > NOW()
           LIMIT 1`,
          [token]
        );
        accountId = tokenResult.rows[0]?.account_id ?? null;
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication" },
        { status: 401 }
      );
    }

    const data = await getInstallerData(accountId, "Linux");

    return NextResponse.json({
      success: true,
      license: data.license,
      installer: data.installer,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load Linux installer." },
      { status: 500 }
    );
  }
}