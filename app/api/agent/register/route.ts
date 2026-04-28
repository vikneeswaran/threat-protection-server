import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import net from "node:net"
import { getPool, query } from "@/lib/db"

const TOKEN_SECRET = process.env.INSTALLER_TOKEN_SECRET

type RegistrationBody = {
  token?: string
  hostname?: string
  os?: string
  os_version?: string
  agent_version?: string
  agent_id?: string
  ip_address?: string
  public_ip?: string
  mac_address?: string
  system_info?: {
    local_ip?: string
    ip?: string
    public_ip?: string
    mac?: string
    mac_address?: string
  }
}

type TokenPayload = {
  accountId?: unknown
}

type DbError = {
  code?: string
  message?: string
  stack?: string
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return Buffer.from(normalized, "base64")
}

function verifyAndDecodeToken(token: string): unknown {
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

function toRegistrationBody(value: unknown): RegistrationBody | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  return value as RegistrationBody
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function sanitizeLocalIpv4(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const ip = value.trim()
  if (net.isIP(ip) !== 4) {
    return null
  }
  if (ip.startsWith("127.") || ip.startsWith("169.254.") || ip === "0.0.0.0") {
    return null
  }
  return ip
}

function sanitizePublicIpv4(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const ip = value.trim()
  if (net.isIP(ip) !== 4) {
    return null
  }
  const [firstOctetRaw, secondOctetRaw] = ip.split(".")
  const firstOctet = Number(firstOctetRaw)
  const secondOctet = Number(secondOctetRaw)
  const isPrivate172 = firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31

  if (ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("169.254.") || isPrivate172 || ip.startsWith("192.168.") || ip === "0.0.0.0") {
    return null
  }
  return ip
}

function sanitizeMacAddress(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, ":")
  if (!normalized) {
    return null
  }

  if (/^[0-9a-f]{12}$/i.test(normalized)) {
    return normalized.match(/.{1,2}/g)?.join(":") ?? null
  }

  if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(normalized) && normalized !== "00:00:00:00:00:00") {
    return normalized
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    let body: RegistrationBody
    try {
      const parsed = await request.json()
      const normalized = toRegistrationBody(parsed)
      if (!normalized) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }
      body = normalized
    } catch (parseErr) {
      const raw = await request.text()
      try {
        const repaired = raw.replace(/("token"\s*:\s*")([^"]*)(")/g, (_, p1, p2, p3) => p1 + String(p2).replace(/\s+/g, "") + p3)
        const parsed = JSON.parse(repaired)
        const normalized = toRegistrationBody(parsed)
        if (!normalized) {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
        }
        body = normalized
        console.warn("Repaired JSON body by cleaning token whitespace")
      } catch (repairErr) {
        console.error("Failed to parse JSON body and repair token:", repairErr, "original error:", parseErr)
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }
    }
    const { token, hostname, os, os_version, agent_version, agent_id } = body
    const localIp = sanitizeLocalIpv4(body?.system_info?.local_ip || body?.system_info?.ip || body?.ip_address)
    const publicIp = sanitizePublicIpv4(body?.system_info?.public_ip || body?.public_ip)
    const macAddress = sanitizeMacAddress(body?.system_info?.mac || body?.system_info?.mac_address || body?.mac_address)

    if (!hostname || !os) {
      return NextResponse.json({ error: "Missing required fields: hostname and os" }, { status: 400 })
    }

    // Determine account_id
    let accountId: string | null = null

    if (token) {
      // Decode and verify token (supports both signed JWT and legacy base64)
      try {
        const decoded = verifyAndDecodeToken(token) as TokenPayload
        accountId = typeof decoded.accountId === "string" ? decoded.accountId : null
      } catch (e) {
        console.error("Invalid registration token decode error:", e)
        return NextResponse.json({ error: "Invalid token" }, { status: 400 })
      }

      if (!accountId || !isUuid(accountId)) {
        return NextResponse.json({ error: "Invalid token payload: missing or invalid accountId" }, { status: 400 })
      }

      const accountCheck = await query<{ id: string }>(`SELECT id::text FROM accounts WHERE id = $1 LIMIT 1`, [accountId])
      if (!accountCheck.rows[0]?.id) {
        return NextResponse.json({ error: "Account not found for token" }, { status: 403 })
      }
    } else {
      // Auto-registration without token
      // For agents that register without a token, try to find a default account
      console.warn("Registration without token - attempting to find default account")
      
      // Get the first account (for single-account or dev deployments)
      const defaultAccountResult = await query<{ id: string }>(`SELECT id::text FROM accounts ORDER BY created_at ASC LIMIT 1`, [])
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
                public_ip = $8,
                status = 'online',
                last_seen_at = NOW(),
                updated_at = NOW()
            WHERE id = $9
            RETURNING id::text
          `,
          [hostname, os, os_version || null, agent_version || null, agent_id || null, localIp, macAddress, publicIp, existingEndpoint.id],
        )

        await client.query("COMMIT")
        return NextResponse.json({ success: true, message: "Endpoint updated", endpoint_id: updatedResult.rows[0].id })
      }

      const insertedResult = await client.query<{ id: string }>(
        `
          INSERT INTO endpoints (
            account_id, agent_id, hostname, os, os_version, agent_version, ip_address, public_ip, mac_address,
            status, last_seen_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'online', NOW())
          RETURNING id::text
        `,
        [accountId, agent_id || null, hostname, os, os_version || null, agent_version || null, localIp, publicIp, macAddress],
      )

      try {
        await client.query(
          `INSERT INTO audit_logs (account_id, action, entity_type, entity_id, details)
           VALUES ($1, 'endpoint_registered', 'endpoint', $2, $3::jsonb)`,
          [accountId, insertedResult.rows[0].id, JSON.stringify({ hostname, os, os_version, agent_version, agent_id })],
        )
      } catch (auditErr) {
        // Never fail endpoint registration because of audit log write issues.
        console.warn("Audit log insert failed during register; continuing:", auditErr)
      }

      await client.query("COMMIT")
      return NextResponse.json({ success: true, message: "Endpoint registered", endpoint_id: insertedResult.rows[0].id })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    const dbError = error as DbError

    console.error("Registration error:", error)
    if (dbError?.code === "23503") {
      return NextResponse.json({ error: "Registration failed: invalid account reference" }, { status: 400 })
    }
    if (dbError?.code === "23505") {
      return NextResponse.json({ error: "Registration conflict: endpoint already exists" }, { status: 409 })
    }
    const isDebug = process.env.DEBUG_REGISTRATION === "true" || process.env.NODE_ENV !== "production"
    const errMessage = error instanceof Error ? error.message : String(error)
    const payload = isDebug
      ? { error: "Internal server error", details: errMessage, stack: error instanceof Error ? error.stack : undefined }
      : { error: "Internal server error" }
    return NextResponse.json(payload, { status: 500 })
  }
}
