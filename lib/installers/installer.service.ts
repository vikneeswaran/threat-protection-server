import { query } from "@/lib/db";

export async function getInstallerData(
  accountId: string,
  platform: string
) {
  // Get account license details
  const accountResult = await query(
    `
    SELECT
      name,
      total_licenses,
      allocated_licenses,
      used_licenses,
      available_licenses
    FROM accounts
    WHERE id = $1
    `,
    [accountId]
  );

  // Get latest active installer
  const installerResult = await query(
    `
    SELECT
      version,
      platform,
      file_name,
      file_size,
      download_url
    FROM installers
    WHERE
      is_active = true
      AND LOWER(platform) = LOWER($1)
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [platform]
  );

  const account = accountResult.rows[0];
  const installer = installerResult.rows[0];

  if (!account) {
    throw new Error("Account not found.");
  }

  if (!installer) {
    throw new Error("No active installer found.");
  }

  return {
    account: {
      id: accountId,
      name: account.name as string | null,
    },

    license: {
      total: Number(account.total_licenses),
      allocated: Number(account.allocated_licenses),
      used: Number(account.used_licenses),
      available: Number(account.available_licenses),
    },

    installer: {
      version: installer.version,
      platform: installer.platform,
      fileName: installer.file_name,
      fileSize: installer.file_size,
      downloadUrl: installer.download_url,
    },
  };
}