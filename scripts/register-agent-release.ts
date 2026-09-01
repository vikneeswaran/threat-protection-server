import { query } from "@/lib/db";
import {
  AGENT_PLATFORMS,
  AGENT_PLATFORM_LABELS,
  type AgentPlatform,
} from "@/lib/installers/agent-package.types";
import {
  AGENT_RELEASE_VERSION,
  getPublishedArtifactFileName,
  getPublishedArtifactUrl,
} from "@/lib/installers/agent-release";

/*
 * Publishes an agent release to the installers table so the console
 * downloads serve the requested version.
 *
 * Usage:
 *   pnpm exec tsx scripts/register-agent-release.ts [version]
 *
 * The version defaults to AGENT_RELEASE_VERSION, which mirrors the
 * VERSION value of the agent build workflow.
 */

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

async function getArtifactSize(url: string): Promise<number> {
  const response = await fetch(url, {
    method: "HEAD",
  });

  if (!response.ok) {
    throw new Error(`Artifact is not published: ${url} (HTTP ${response.status})`);
  }

  const contentLength = Number(
    response.headers.get("content-length") || 0
  );

  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error(`Artifact size could not be determined: ${url}`);
  }

  return contentLength;
}

async function registerPlatform(
  platform: AgentPlatform,
  version: string
): Promise<void> {
  const label = AGENT_PLATFORM_LABELS[platform];
  const fileName = getPublishedArtifactFileName(platform, version);
  const downloadUrl = getPublishedArtifactUrl(platform, version);
  const fileSize = await getArtifactSize(downloadUrl);

  const existing = await query(
    `
    SELECT id
    FROM installers
    WHERE version = $1
      AND LOWER(platform) = LOWER($2)
    LIMIT 1
    `,
    [version, label]
  );

  if (existing.rows[0]) {
    await query(
      `
      UPDATE installers
      SET
        file_name = $1,
        file_size = $2,
        download_url = $3,
        is_active = true
      WHERE id = $4
      `,
      [fileName, fileSize, downloadUrl, existing.rows[0].id]
    );
  } else {
    await query(
      `
      INSERT INTO installers (
        version,
        platform,
        file_name,
        file_size,
        download_url,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, true)
      `,
      [version, label, fileName, fileSize, downloadUrl]
    );
  }

  // Older builds must not be picked up as the latest active installer.
  await query(
    `
    UPDATE installers
    SET is_active = false
    WHERE LOWER(platform) = LOWER($1)
      AND version <> $2
      AND is_active = true
    `,
    [label, version]
  );

  console.info(`${label}: registered ${fileName} (${fileSize} bytes)`);
}

async function main() {
  const version = process.argv[2] || AGENT_RELEASE_VERSION;

  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  console.info(`Registering agent release ${version}...`);

  for (const platform of AGENT_PLATFORMS) {
    await registerPlatform(platform, version);
  }

  const verify = await query(
    `
    SELECT platform, version, file_name, is_active
    FROM installers
    WHERE is_active = true
    ORDER BY platform
    `
  );

  console.table(verify.rows);
}

main().catch((error) => {
  console.error("Failed to register agent release:", error);
  process.exit(1);
});
