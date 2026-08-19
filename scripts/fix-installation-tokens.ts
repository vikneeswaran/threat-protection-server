import { randomBytes } from "crypto";
import { query } from "@/lib/db";

function generateInstallationToken(): string {
  return randomBytes(104)
    .toString("base64url")
    .slice(0, 128);
}

function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}

async function main() {
  console.log("Finding incorrect installation tokens...");

  const result = await query(`
    SELECT
      id,
      account_id,
      installation_token
    FROM installation_tokens
    WHERE LENGTH(installation_token) <> 128
    ORDER BY expires_at
  `);

  console.log(`Found ${result.rows.length} incorrect tokens.`);

  for (const tokenRecord of result.rows) {
    const newToken = generateInstallationToken();
    const expiresAt = getTokenExpiry();

    if (newToken.length !== 128) {
      throw new Error(
        `Generated token has incorrect length: ${newToken.length}`
      );
    }

    await query(
      `
      UPDATE installation_tokens
      SET
        installation_token = $1,
        expires_at = $2
      WHERE id = $3
      `,
      [newToken, expiresAt, tokenRecord.id]
    );

    console.log(
      `Updated account ${tokenRecord.account_id}: ${tokenRecord.installation_token.length} -> ${newToken.length}`
    );
  }

  console.log("Migration completed.");

  const verify = await query(`
    SELECT
      LENGTH(installation_token) AS token_length,
      COUNT(*) AS count
    FROM installation_tokens
    GROUP BY LENGTH(installation_token)
    ORDER BY token_length
  `);

  console.table(verify.rows);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});