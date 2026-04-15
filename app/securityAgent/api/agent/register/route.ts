import { type NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, hostname, os, os_version, agent_version, ip_address, mac_address, agent_id } = body

    if (!token) {
      return NextResponse.json({ error: "Registration token is required" }, { status: 400 })
    }

    // Decode the registration token
      let accountId: string
      try {
        const cleaned = String(token).replace(/\s+/g, "")
        const decodedStr = Buffer.from(cleaned, "base64").toString("utf-8")
        const decoded = JSON.parse(decodedStr)
        accountId = decoded.accountId
      } catch (e) {
        console.error("Invalid registration token decode error:", e)
        return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      const accountResult = await client.query<{
        id: string
        total_licenses: number
        used_licenses: number
      }>(
        `
          SELECT id::text, total_licenses, used_licenses
          FROM accounts
          WHERE id = $1 AND is_active = TRUE
          LIMIT 1
        `,
        [accountId],
      )
      const account = accountResult.rows[0]

      if (!account) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Invalid or inactive account" }, { status: 400 })
      }

      // Check if there are available licenses
      const availableLicenses = account.total_licenses - account.used_licenses
      if (availableLicenses <= 0) {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { error: "No available licenses. Please upgrade your plan or allocate more licenses." },
          { status: 403 },
        )
      }

      // Check if endpoint already exists — prefer `agent_id` when provided, otherwise fall back to mac+hostname
      let existingEndpoint: { id: string } | undefined
      if (agent_id) {
        const existingResult = await client.query<{ id: string }>(
          `SELECT id::text FROM endpoints WHERE agent_id = $1 LIMIT 1`,
          [agent_id],
        )
        existingEndpoint = existingResult.rows[0]
      } else {
        const existingResult = await client.query<{ id: string }>(
          `
            SELECT id::text
            FROM endpoints
            WHERE account_id = $1 AND hostname = $2 AND mac_address = $3
            LIMIT 1
          `,
          [accountId, hostname, mac_address],
        )
        existingEndpoint = existingResult.rows[0]
      }

      if (existingEndpoint) {
        const updatedResult = await client.query<{ id: string }>(
          `
            UPDATE endpoints
            SET os = $1,
                os_version = $2,
                agent_version = $3,
                ip_address = $4,
                mac_address = $5,
                agent_id = $6,
                status = 'online',
                last_seen_at = NOW(),
                updated_at = NOW()
            WHERE id = $7
            RETURNING id::text
          `,
          [os, os_version, agent_version, ip_address, mac_address, agent_id || null, existingEndpoint.id],
        )

        await client.query("COMMIT")
        return NextResponse.json({
          success: true,
          endpoint_id: updatedResult.rows[0].id,
          message: "Endpoint re-registered successfully",
        })
      }

      const endpointResult = await client.query<{ id: string }>(
        `
          INSERT INTO endpoints (
            account_id,
            agent_id,
            hostname,
            os,
            os_version,
            agent_version,
            ip_address,
            mac_address,
            status,
            last_seen_at,
            registered_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'online', NOW(), NOW())
          RETURNING id::text
        `,
        [accountId, agent_id || null, hostname, os, os_version, agent_version, ip_address, mac_address],
      )

      await client.query(
        `INSERT INTO audit_logs (account_id, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, 'create', 'endpoint', $2, $3::jsonb, $4, $5)`,
        [
          accountId,
          endpointResult.rows[0].id,
          JSON.stringify({ hostname, os, agent_version, ip_address }),
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
          request.headers.get("user-agent"),
        ],
      )

      await client.query("COMMIT")
      return NextResponse.json({
        success: true,
        endpoint_id: endpointResult.rows[0].id,
        message: "Endpoint registered successfully",
      })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Agent registration error:", error)
    const isDebug = process.env.DEBUG_REGISTRATION === "true" || process.env.NODE_ENV !== "production"
    const errMessage = error instanceof Error ? error.message : String(error)
    const payload = isDebug
      ? { error: "Internal server error", details: errMessage, stack: error instanceof Error ? error.stack : undefined }
      : { error: "Internal server error" }
    return NextResponse.json(payload, { status: 500 })
  }
}
