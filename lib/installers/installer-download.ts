import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getInstallerData } from "@/lib/installers/installer.service";
import { getInstallationToken } from "@/lib/installation-token";
import {
  createAgentInstallerPackage,
  type AgentPlatform,
} from "@/lib/installers/agent-package.service";

const PLATFORM_LABELS: Record<AgentPlatform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

/*
 * Builds and returns the account specific installer package for a
 * platform. All three platform routes share this handler so every
 * download contains the same set of files.
 */
export async function downloadAgentPackage(
  platform: AgentPlatform
): Promise<NextResponse> {
  let cleanup: (() => Promise<void>) | undefined;

  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await getInstallerData(
      user.account_id,
      PLATFORM_LABELS[platform]
    );

    const installationToken = await getInstallationToken(
      user.account_id
    );

    const packageResult = await createAgentInstallerPackage({
      platform,
      downloadUrl: data.installer.downloadUrl,
      version: data.installer.version,
      installationToken,
      accountId: user.account_id,
      accountName: data.account.name,
    });

    cleanup = packageResult.cleanup;

    const packageBuffer = await fs.readFile(
      packageResult.packagePath
    );

    return new NextResponse(packageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${packageResult.packageName}"`,
        "Content-Length": packageBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error(
      `${PLATFORM_LABELS[platform]} installer download error:`,
      error
    );

    return NextResponse.json(
      {
        error: `Failed to generate ${PLATFORM_LABELS[platform]} installer package.`,
      },
      { status: 500 }
    );
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error(
          `${PLATFORM_LABELS[platform]} installer cleanup error:`,
          cleanupError
        );
      }
    }
  }
}
