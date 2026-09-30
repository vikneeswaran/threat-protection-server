import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getInstallationToken } from "@/lib/installation-token";
import { getInstallerData } from "@/lib/installers/installer.service";
import { createUnixInstallerPackage, type UnixPlatform } from "@/lib/installers/unix-package.service";

export async function downloadUnixInstaller(request: Request, platform: UnixPlatform) {
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const user = await requireSessionUser().catch(() => null);
    let accountId = user?.account_id;
    let installationToken: string | null = null;

    if (accountId) {
      installationToken = await getInstallationToken(accountId);
    } else {
      const token = new URL(request.url).searchParams.get("token");
      if (token) {
        const result = await query<{ account_id: string }>(
          `SELECT account_id FROM installation_tokens
           WHERE installation_token = $1 AND expires_at > NOW() LIMIT 1`,
          [token]
        );
        if (result.rows[0]) {
          accountId = result.rows[0].account_id;
          installationToken = token;
        }
      }
    }

    if (!accountId || !installationToken) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication" }, { status: 401 });
    }

    const data = await getInstallerData(accountId, platform === "macos" ? "macOS" : "Linux");
    const result = await createUnixInstallerPackage({
      platform,
      downloadUrl: data.installer.downloadUrl,
      fileName: data.installer.fileName,
      version: data.installer.version,
      installationToken,
    });
    cleanup = result.cleanup;
    const buffer = await fs.readFile(result.packagePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.packageName}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error(`${platform} installer download error:`, error);
    return NextResponse.json({ error: `Failed to generate ${platform} installer package.` }, { status: 500 });
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (error) {
        console.error(`${platform} installer cleanup error:`, error);
      }
    }
  }
}
