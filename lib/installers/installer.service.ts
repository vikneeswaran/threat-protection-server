import { query } from "@/lib/db";

export async function getInstallerData(
  accountId: string,
  platform: string
) {
  // Get account license details
  const accountResult = await query(
    `
    SELECT
      total_licenses,
      used_licenses,
      (total_licenses - used_licenses) AS available
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

if (!installer) {
  throw new Error("No active installer found.");
}
  return {
    license: {
      total: account.total_licenses,
      used: account.used_licenses,
      available: account.available,
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