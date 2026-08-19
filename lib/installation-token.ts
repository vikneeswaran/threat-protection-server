import { randomBytes } from "crypto";
import { query } from "@/lib/db";

function generateInstallationToken(): string {
  return randomBytes(104)
    .toString("base64url")
    .slice(0, 128);
}

function getTokenExpiry(): Date {
  const expiry = new Date();
  // Token is valid for 1 year
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}

export async function getInstallationToken(accountId: string) {
  const existing = await query(
    `
      SELECT
        id,
        installation_token,
        expires_at
      FROM installation_tokens
      WHERE account_id = $1
      LIMIT 1
    `,
    [accountId]
  );

  // Existing token found
  if (existing.rows.length > 0) {
    const tokenRecord = existing.rows[0];

    // Token format is invalid
    if (tokenRecord.installation_token.length !== 128) {
      const newToken = generateInstallationToken();
      const expiresAt = getTokenExpiry();

      await query(
        `
          UPDATE installation_tokens
          SET
            installation_token = $1,
            expires_at = $2
          WHERE account_id = $3
        `,
        [newToken, expiresAt, accountId]
      );

      return newToken;
    }

    // Token is still valid
    if (new Date(tokenRecord.expires_at) > new Date()) {
      return tokenRecord.installation_token;
    }

    // Token expired → generate a new token
    const newToken = generateInstallationToken();
    const expiresAt = getTokenExpiry();

    await query(
      `
        UPDATE installation_tokens
        SET
          installation_token = $1,
          expires_at = $2
        WHERE account_id = $3
      `,
      [newToken, expiresAt, accountId]
    );

    return newToken;
  }

  // No token exists → create one
  const newToken = generateInstallationToken();
  const expiresAt = getTokenExpiry();

  await query(
    `
      INSERT INTO installation_tokens
      (
        account_id,
        installation_token,
        expires_at
      )
      VALUES ($1, $2, $3)
    `,
    [accountId, newToken, expiresAt]
  );

  return newToken;
}