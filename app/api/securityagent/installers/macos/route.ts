import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getInstallerData } from "@/lib/installers/installer.service";
import { getInstallationToken } from "@/lib/installation-token";
import { createPlatformInstallerPackage } from "@/lib/installers/platform-package.service";

export async function GET() {
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
      "macOS"
    );

    const packageResult = await createPlatformInstallerPackage({
      downloadUrl: data.installer.downloadUrl,
      fileName: data.installer.fileName,
      version: data.installer.version,
      installationToken: await getInstallationToken(user.account_id),
      platform: "macos",
    });
    cleanup = packageResult.cleanup;
    const packageBuffer = await (
      await import("fs/promises")
    ).readFile(packageResult.packagePath);

    return new NextResponse(packageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${packageResult.packageName}"`,
        "Content-Length": packageBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load macOS installer." },
      { status: 500 }
    );
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error("macOS installer cleanup error:", cleanupError);
      }
    }
  }
}