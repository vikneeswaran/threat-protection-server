import { randomBytes } from "crypto";
import { query } from "@/lib/db";

function generateInstallationToken(): string {
  return randomBytes(104)
    .toString("base64url")
    .slice(0, 128);
}

export async function getInstallationToken(accountId: string) {
  const existing = await query(
    `
      SELECT installation_token
      FROM installation_tokens
      WHERE account_id = $1
      LIMIT 1
    `,
    [accountId]
  );

  // Existing token found
  if (existing.rows.length > 0) {
    const currentToken = existing.rows[0].installation_token;

    // Existing token is old format
    if (currentToken.length !== 128) {
      const newToken = generateInstallationToken();

      await query(
        `
          UPDATE installation_tokens
          SET installation_token = $1
          WHERE account_id = $2
        `,
        [newToken, accountId]
      );

      return newToken;
    }

    // Existing token is already correct
    return currentToken;
  }

  // No token exists for this account
  const newToken = generateInstallationToken();

  await query(
    `
      INSERT INTO installation_tokens
      (
        account_id,
        installation_token
      )
      VALUES ($1, $2)
    `,
    [accountId, newToken]
  );

  return newToken;
}