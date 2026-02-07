import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"

const TOKEN_SECRET = process.env.INSTALLER_TOKEN_SECRET
const TOKEN_TTL_SECONDS = Number(process.env.INSTALLER_TOKEN_TTL_SECONDS ?? 7 * 24 * 60 * 60)
const RATE_LIMIT_WINDOW_MS = Number(process.env.INSTALLER_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000)
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.INSTALLER_RATE_LIMIT_MAX ?? 60) // allow more for agents

const rateLimitBuckets = new Map<string, number[]>()

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return Buffer.from(normalized, "base64")
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {return forwarded.split(",")[0]?.trim() || "unknown"}
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {return realIp.trim()}
  return "unknown"
}

function isRateLimited(key: string) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const bucket = rateLimitBuckets.get(key) ?? []
  const recent = bucket.filter((ts) => ts >= windowStart)

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(key, recent)
    return true
  }

  recent.push(now)
  rateLimitBuckets.set(key, recent)
  return false
}

function verifySignedToken(token: string) {
  if (!TOKEN_SECRET) {
    throw new Error("Installer token secret not configured")
  }

  const parts = token.split(".")
  if (parts.length !== 2) {
    throw new Error("Invalid token format")
  }

  const [payloadPart, signaturePart] = parts
  const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadPart).digest()
  const providedSig = base64UrlDecode(signaturePart)

  if (!crypto.timingSafeEqual(expectedSig, providedSig)) {
    throw new Error("Invalid token signature")
  }

  const payloadJson = base64UrlDecode(payloadPart).toString("utf-8")
  const payload = JSON.parse(payloadJson)

  if (!payload.accountId) {
    throw new Error("Invalid token: missing accountId")
  }

  const now = Date.now()
  if (payload.exp && typeof payload.exp === "number" && now > payload.exp) {
    throw new Error("Token expired")
  }

  if (!payload.exp) {
    // Backstop expiry if older format without exp is used
    const issued = typeof payload.timestamp === "number" ? payload.timestamp : now
    if (now - issued > TOKEN_TTL_SECONDS * 1000) {
      throw new Error("Token expired")
    }
  }

  return payload as {
    accountId: string
    subAccountId?: string | null
    accountName?: string
    generatedBy?: string
  }
}

async function safeAuditLog(params: {
  action: string
  entityType: string
  entityId: string
  accountId: string
  ip?: string
  userAgent?: string | null
  details?: Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    await admin.from("audit_logs").insert({
      account_id: params.accountId,
      user_id: null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      details: params.details ?? null,
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    })
  } catch (error) {
    console.warn("Failed to write audit log", error)
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!TOKEN_SECRET) {
      return NextResponse.json({ error: "Installer token secret not configured" }, { status: 500 })
    }

    const clientIp = getClientIp(request)
    const rateKey = `${clientIp}:config`

    if (isRateLimited(rateKey)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing token parameter" }, { status: 400 })
    }

    // Decode and validate the token
    let accountId: string
    let subAccountId: string | null = null
    let generatedBy: string | undefined

    try {
      const payload = verifySignedToken(token)
      accountId = payload.accountId
      subAccountId = payload.subAccountId || null
      generatedBy = payload.generatedBy
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || "Invalid token" }, { status: 400 })
    }

    // Use admin client since this is an unauthenticated endpoint (called during install)
    const admin = createAdminClient()
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: "Invalid account" }, { status: 404 })
    }

    // Generate config.json
    const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com"
    const normalizedBase = rawBase.replace(/\/$/, "")
    const apiBase = normalizedBase.endsWith("/api/agent") ? normalizedBase : `${normalizedBase}/api/agent`

    const config = {
      api_base: apiBase,
      registration_token: token,
      account_id: accountId,
      sub_account_id: subAccountId,
      auto_register: true,
      console_url: `${normalizedBase}/securityAgent`,
      heartbeat_interval: 300,
    }

    void safeAuditLog({
      action: "installer_config_served",
      entityType: "config",
      entityId: accountId,
      accountId,
      ip: clientIp,
      userAgent: request.headers.get("user-agent"),
      details: { subAccountId, generatedBy },
    })

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
