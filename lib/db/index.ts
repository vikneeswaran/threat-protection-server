import { Pool, type QueryResultRow } from "pg"

let pool: Pool | null = null

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL

  if (url) {
    return url
  }

  const username = process.env.POSTGRES_USER || process.env.USER || "postgres"
  const password = process.env.POSTGRES_PASSWORD
  const host = process.env.POSTGRES_HOST || "127.0.0.1"
  const port = process.env.POSTGRES_PORT || "5432"
  const database = process.env.POSTGRES_DB || "ktps_main"
  const authPart = password ? `${username}:${password}` : username

  return `postgresql://${authPart}@${host}:${port}/${database}`
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })
  }

  return pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const db = getPool()
  return db.query<T>(text, params)
}
