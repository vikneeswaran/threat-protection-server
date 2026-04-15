import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPool, query } from "@/lib/db"

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
        const repaired = raw.replace(/("token"\s*:\s*")([^"]*)(")/g, (_, p1, p2, p3) => p1 + String(p2).replace(/\s+/g, "") + p3)
        body = JSON.parse(repaired)
        console.warn("Repaired JSON body by cleaning token whitespace")
      } catch (repairErr) {
        console.error("Failed to parse JSON body and repair token:", repairErr, "original error:", parseErr)
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }
    }
    const { token, hostname, os, os_version, agent_version, agent_id } = body

    if (!hostname || !os) {
      return NextResponse.json({ error: "Missing required fields: hostname and os" }, { status: 400 })
    }

    // Determine account_id
    let accountId: string | null = null

    if (token) {
      // Decode and verify token (supports both signed JWT and legacy base64)
      try {
        const decoded = verifyAndDecodeToken(token)
        accountId = decoded.accountId
      } catch (e) {
        console.error("Invalid registration token decode error:", e)
        return NextResponse.json({ error: "Invalid token" }, { status: 400 })
      }
    } else {
      // Auto-registration without token
      // For agents that register without a token, try to find a default account
      console.warn("Registration without token - attempting to find default account")
      
      // Get the first active account (for single-account or dev deployments)
      const defaultAccountResult = await query<{ id: string }>(
        `SELECT id::text FROM accounts WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
        [],
      )
      const defaultAccount = defaultAccountResult.rows[0]
      
      if (!defaultAccount?.id) {
        return NextResponse.json({ 
          error: "No active accounts found. Please create an account first or provide a registration token." 
        }, { status: 403 })
      }
      
      accountId = defaultAccount.id
      console.info("Assigned default account for token-less registration:", accountId)
    }

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      const existingResult = agent_id
        ? await client.query<{ id: string }>(`SELECT id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`, [agent_id])
        : await client.query<{ id: string }>(
            `SELECT id::text FROM endpoints WHERE account_id = $1 AND hostname = $2 AND mac_address IS NOT DISTINCT FROM $3 LIMIT 1`,
            [accountId, hostname, body.mac_address || null],
          )
      const existingEndpoint = existingResult.rows[0]

      if (existingEndpoint) {
        const updatedResult = await client.query<{ id: string }>(
          `
            UPDATE endpoints
            SET hostname = $1,
                os = $2,
                os_version = $3,
                agent_version = $4,
                agent_id = $5,
                ip_address = $6,
                mac_address = $7,
                status = 'online',
                last_seen_at = NOW(),
                updated_at = NOW()
            WHERE id = $8
            RETURNING id::text
          `,
          [hostname, os, os_version || null, agent_version || null, agent_id || null, body.ip_address || null, body.mac_address || null, existingEndpoint.id],
        )

        await client.query("COMMIT")
        return NextResponse.json({ success: true, message: "Endpoint updated", endpoint_id: updatedResult.rows[0].id })
      }

      const insertedResult = await client.query<{ id: string }>(
        `
          INSERT INTO endpoints (
            account_id, agent_id, hostname, os, os_version, agent_version, ip_address, mac_address,
            status, last_seen_at, registered_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'online', NOW(), NOW())
          RETURNING id::text
        `,
        [accountId, agent_id || null, hostname, os, os_version || null, agent_version || null, body.ip_address || null, body.mac_address || null],
      )

      await client.query(
        `INSERT INTO audit_logs (account_id, action, entity_type, entity_id, details)
         VALUES ($1, 'endpoint_registered', 'endpoint', $2, $3::jsonb)`,
        [accountId, insertedResult.rows[0].id, JSON.stringify({ hostname, os, os_version, agent_version, agent_id })],
      )

      await client.query("COMMIT")
      return NextResponse.json({ success: true, message: "Endpoint registered", endpoint_id: insertedResult.rows[0].id })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
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
