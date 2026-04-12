import { Pool } from "pg"

let pool: Pool | null = null

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }
  return url
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

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const db = getPool()
  return db.query<T>(text, params)
}
