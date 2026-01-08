import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const TOKEN_SECRET = process.env.INSTALLER_TOKEN_SECRET

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return Buffer.from(normalized, "base64")
}

function verifyAndDecodeToken(token: string) {
  // Check if it's a signed JWT token (has two parts with dot separator)
  if (token.includes(".")) {
    if (!TOKEN_SECRET) {
      throw new Error("Token secret not configured")
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
    return JSON.parse(payloadJson)
  } else {
    // Legacy base64-encoded JSON token
    const cleaned = String(token).replace(/\s+/g, "")
    const decodedStr = Buffer.from(cleaned, "base64").toString("utf-8")
    return JSON.parse(decodedStr)
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch (parseErr) {
      const raw = await request.text()
      try {
        const repaired = raw.replace(/("token"\s*:\s*")([^"]*)(")/s, (_, p1, p2, p3) => p1 + String(p2).replace(/\s+/g, "") + p3)
        body = JSON.parse(repaired)
        console.warn("Repaired JSON body by cleaning token whitespace")
      } catch (repairErr) {
        console.error("Failed to parse JSON body and repair token:", repairErr, "original error:", parseErr)
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }
    }
    const { token, hostname, os, os_version, agent_version, agent_id } = body

    if (!token || !hostname || !os) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Decode and verify token (supports both signed JWT and legacy base64)
    let accountId: string
    try {
      const decoded = verifyAndDecodeToken(token)
      accountId = decoded.accountId
    } catch (e) {
      console.error("Invalid registration token decode error:", e)
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Check if endpoint already exists — prefer `agent_id` when provided, otherwise fall back to mac+hostname
    let existingEndpoint: any = null
    if (agent_id) {
      const { data } = await supabaseAdmin.from("endpoints").select("id").eq("agent_id", agent_id).maybeSingle()
      existingEndpoint = data
    } else {
      const { data } = await supabaseAdmin
        .from("endpoints")
        .select("id")
        .eq("account_id", accountId)
        .eq("hostname", hostname)
        .eq("mac_address", body.mac_address || null)
        .maybeSingle()
      existingEndpoint = data
    }

    if (existingEndpoint) {
      // Update existing endpoint using primary lookup
      const updateQuery = supabaseAdmin.from("endpoints").update({
        hostname,
        os,
        os_version,
        agent_version,
        agent_id: agent_id || null,
        ip_address: body.ip_address || null,
        mac_address: body.mac_address || null,
        status: "online",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (agent_id) {
        updateQuery.eq("agent_id", agent_id)
      } else {
        updateQuery.eq("id", existingEndpoint.id)
      }

      const { data: updatedEndpoint, error: updateError } = await updateQuery.select().single()

      if (updateError) {
        console.error("Failed to update endpoint:", updateError)
        return NextResponse.json({ error: "Failed to update endpoint" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Endpoint updated",
        endpoint_id: updatedEndpoint.id,
      })
    }

    // Register new endpoint
    const { data: newEndpoint, error: insertError } = await supabaseAdmin
      .from("endpoints")
      .insert({
        account_id: accountId,
        agent_id: agent_id || null,
        hostname,
        os,
        os_version,
        agent_version,
        ip_address: body.ip_address || null,
        mac_address: body.mac_address || null,
        status: "online",
        last_seen_at: new Date().toISOString(),
        registered_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("Failed to register endpoint:", insertError)
      return NextResponse.json({ error: "Failed to register endpoint" }, { status: 500 })
    }

    // Log the registration
    await supabaseAdmin.from("audit_logs").insert({
      account_id: accountId,
      action: "endpoint_registered",
      entity_type: "endpoint",
      entity_id: newEndpoint.id,
      details: { hostname, os, os_version, agent_version, agent_id },
    })

    return NextResponse.json({
      success: true,
      message: "Endpoint registered",
      endpoint_id: newEndpoint.id,
    })
  } catch (error) {
    console.error("Registration error:", error)
    const isDebug = process.env.DEBUG_REGISTRATION === "true" || process.env.NODE_ENV !== "production"
    const errMessage = error instanceof Error ? error.message : String(error)
    const payload = isDebug
      ? { error: "Internal server error", details: errMessage, stack: error instanceof Error ? error.stack : undefined }
      : { error: "Internal server error" }
    return NextResponse.json(payload, { status: 500 })
  }
}
