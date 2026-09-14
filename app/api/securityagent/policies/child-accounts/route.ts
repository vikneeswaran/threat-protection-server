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

    const parentAccountId = user.account_id;

    if (!parentAccountId) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 400 }
      );
    }

    const result = await query(
      `
        SELECT
          id,
          name
        FROM public.accounts
        WHERE parent_account_id = $1
        ORDER BY name ASC
      `,
      [parentAccountId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch child accounts:", error);

    return NextResponse.json(
      { error: "Failed to fetch child accounts" },
      { status: 500 }
    );
  }
}