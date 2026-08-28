import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getInstallerData } from "@/lib/installers/installer.service";
import { getInstallationToken } from "@/lib/installation-token";
import { createWindowsInstallerPackage } from "@/lib/installers/windows-package.service";

export async function GET() {
  let cleanup: (() => Promise<void>) | undefined;

  try {
    // --------------------------------------------------
    // 1. Authenticate current user
    // --------------------------------------------------

    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Get Windows installer information
    // --------------------------------------------------

    const data = await getInstallerData(
      user.account_id,
      "Windows"
    );

    // --------------------------------------------------
    // 3. Get account-specific installation token
    // --------------------------------------------------

    const installationToken = await getInstallationToken(
      user.account_id
    );

    // --------------------------------------------------
    // 4. Create account-specific installer package
    // --------------------------------------------------

    const packageResult =
      await createWindowsInstallerPackage({
        downloadUrl: data.installer.downloadUrl,
        version: data.installer.version,
        fileName: data.installer.fileName,
        installationToken,
      });

    cleanup = packageResult.cleanup;

    // --------------------------------------------------
    // 5. Read generated package
    // --------------------------------------------------

    const packageBuffer = await (
      await import("fs/promises")
    ).readFile(packageResult.packagePath);

    // --------------------------------------------------
    // 6. Return ZIP as download
    // --------------------------------------------------

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
      "Windows installer download error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to generate Windows installer package.",
      },
      { status: 500 }
    );
  } finally {
    // --------------------------------------------------
    // 7. Always remove temporary files
    // --------------------------------------------------

    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error(
          "Windows installer cleanup error:",
          cleanupError
        );
      }
    }
  }
}