import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing token parameter" }, { status: 400 })
    }

    // Decode and validate the token
    let accountId: string
    let subAccountId: string | null = null
    
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8")
      const tokenData = JSON.parse(decoded)
      accountId = tokenData.accountId
      subAccountId = tokenData.subAccountId || null
      
      if (!accountId) {
        throw new Error("Invalid token: missing accountId")
      }
    } catch (error) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
    }

    // Verify the account exists
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: "Invalid account" }, { status: 404 })
    }

    // Generate config.json
    const config = {
      api_base: process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com",
      registration_token: token,
      account_id: accountId,
      sub_account_id: subAccountId,
      auto_register: true,
      console_url: `${process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"}/securityAgent`,
      heartbeat_interval: 300,
    }

    return NextResponse.json(config, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Error generating config:", error)
    return NextResponse.json({ error: "Failed to generate config" }, { status: 500 })
  }
}
