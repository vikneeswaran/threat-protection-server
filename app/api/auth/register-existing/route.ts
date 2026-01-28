import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, full_name, organization_name, license_tier } = body

    if (!email || !organization_name) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Find the existing auth user by email (SDK has no getUserByEmail helper)
    const normalizedEmail = String(email).toLowerCase()
    const perPage = 200
    let page = 1
    let userData: { id: string; email?: string | null } | null = null

    while (true) {
      const { data: pageData, error: userErr } = await admin.auth.admin.listUsers({ page, perPage })

      if (userErr) {
        console.error("admin.listUsers error:", userErr)
        return NextResponse.json({ message: "Failed to lookup user by email" }, { status: 500 })
      }

      const match = pageData?.users?.find((u) => u.email?.toLowerCase?.() === normalizedEmail)
      if (match) {
        userData = match
        break
      }

      if (!pageData || pageData.users.length < perPage) {break}
      page += 1
    }

    if (!userData) {
      return NextResponse.json({ message: "Auth user not found for email" }, { status: 404 })
    }

    // Get the license tier details
    const { data: tierData } = await admin
      .from("license_tiers")
      .select("id, max_endpoints, trial_days")
      .eq("name", license_tier || "free")
      .limit(1)
      .single()

    const tier = tierData

    // Calculate expiry if trial days
    const expiresAt = tier && tier.trial_days > 0 ? new Date(Date.now() + tier.trial_days * 24 * 60 * 60 * 1000).toISOString() : null

    // Create account
    const { data: accountData, error: accountError } = await admin
      .from("accounts")
      .insert({
        name: organization_name,
        level: 1,
        license_tier_id: tier?.id || null,
        total_licenses: tier?.max_endpoints || 0,
        license_expires_at: expiresAt,
      })
      .select()
      .single()

    if (accountError || !accountData) {
      console.error("Account creation error:", accountError)
      return NextResponse.json({ message: "Failed to create account" }, { status: 500 })
    }

    // Create profile linked to existing auth user (allow same email across multiple orgs)
    const { error: profileError } = await admin.from("profiles").insert({
      id: userData.id,
      account_id: accountData.id,
      email,
      full_name: full_name || null,
      role: "super_admin",
    })

    if (profileError) {
      console.error("Profile creation error:", profileError)
      return NextResponse.json({ message: "Failed to create profile" }, { status: 500 })
    }

    // Attempt to send an invite / magic link to the user so they can sign in and access the new organization.
    let invited = false
    try {
      const redirectTo = process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ||
        "https://kuaminisystems.com/securityAgent/auth/callback"

      // Use the Supabase admin API to generate a magic link if available. This is best-effort and will not
      // fail the whole request if the method is unavailable or errors.
      try {
        // `generateLink` may not exist on all sdk versions; cast to any for a best-effort call.
        // If your Supabase SDK provides a specific method to send magic links/invite, replace this with that call.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const gen = (admin as any).auth?.admin?.generateLink
        if (typeof gen === "function") {
          await gen("magiclink", email, { redirectTo })
          invited = true
        }
      } catch (e) {
        console.warn("Invite generation failed (sdk may not support generateLink):", e)
      }

    } catch (e) {
      console.warn("Invite attempt failed:", e)
    }

    return NextResponse.json({ message: "ok", invited })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 })
  }
}
