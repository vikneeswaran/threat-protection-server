import type { AgentPlatform } from "@/lib/installers/agent-package.types";

/*
 * Single source of truth for the agent release the console ships.
 *
 * It has to match the VERSION value of the agent build workflow
 * (threat-protection-agent/.github/workflows/build-agents.yml) because
 * the published artifact names are derived from it. The value can be
 * overridden without a redeploy through AGENT_RELEASE_VERSION.
 */
export const AGENT_RELEASE_VERSION =
  process.env.AGENT_RELEASE_VERSION?.trim() || "1.0.30";

/*
 * Location of the published agent artifacts and of the install /
 * uninstall scripts that are stored next to them.
 */
export const DEFAULT_AGENT_ASSET_BASE_URL =
  "https://raw.githubusercontent.com/vikneeswaran/threat-protection-agent/main/public/tray";

/*
 * Name of the artifact as it is published by the agent build workflow.
 */
export function getPublishedArtifactFileName(
  platform: AgentPlatform,
  version: string = AGENT_RELEASE_VERSION
): string {
  if (platform === "windows") {
    return `KuaminiSecurityClient-${version}-windows.zip`;
  }

  if (platform === "macos") {
    return `KuaminiSecurityClient-${version}.pkg`;
  }

  return `KuaminiSecurityClient-${version}-linux.tar.gz`;
}

/*
 * Name of the installer file that ends up inside the account package.
 * On Windows the published ZIP is unpacked, so the packaged file is the
 * MSI it contains.
 */
export function getPackagedArtifactFileName(
  platform: AgentPlatform,
  version: string = AGENT_RELEASE_VERSION
): string {
  if (platform === "windows") {
    return `KuaminiSecurityClient-${version}.msi`;
  }

  return getPublishedArtifactFileName(platform, version);
}

export function getPublishedArtifactUrl(
  platform: AgentPlatform,
  version: string = AGENT_RELEASE_VERSION,
  baseUrl: string = process.env.AGENT_ASSET_BASE_URL ||
    DEFAULT_AGENT_ASSET_BASE_URL
): string {
  return `${baseUrl.replace(/\/+$/, "")}/${getPublishedArtifactFileName(
    platform,
    version
  )}`;
}
