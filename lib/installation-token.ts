// lib/installation-token.ts

import { randomBytes } from "crypto";
import { query } from "@/lib/db";

export async function getInstallationToken(accountId: string) {
  // Check whether the account already has a token
  const existing = await query(
    `
      SELECT installation_token
      FROM installation_tokens
      WHERE account_id = $1
      LIMIT 1
    `,
    [accountId]
  );

  // Reuse existing token
  if (existing.rows.length > 0) {
    return existing.rows[0].installation_token;
  }

  // Generate a new token only for a new account
  const token = randomBytes(104)
    .toString("base64url")
    .slice(0, 138);

  // Store the account-level token
  await query(
    `
      INSERT INTO installation_tokens
      (
        account_id,
        installation_token,
        expires_at
      )
      VALUES
      (
        $1,
        $2,
        NOW() + INTERVAL '30 days'
      )
    `,
    [accountId, token]
  );

  return token;
}