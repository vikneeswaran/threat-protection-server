import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getInstallerData } from "@/lib/installers/installer.service";
import { getInstallationToken } from "@/lib/installation-token";
import { createWindowsInstallerPackage } from "@/lib/installers/windows-package.service";

export async function GET(request: Request) {
  let cleanup: (() => Promise<void>) | undefined;

  try {
    // --------------------------------------------------
    // 1. Try to authenticate from session OR URL params
    // --------------------------------------------------

    let accountId: string | null = null;
    let installationToken: string | null = null;

    // Check for session user first
    const user = await requireSessionUser().catch(() => null);

    if (user) {
      // User is authenticated via session
      accountId = user.account_id;
      installationToken = await getInstallationToken(accountId);
    } else {
      // Try to get from URL parameters (for direct downloads)
      const { searchParams } = new URL(request.url);
      const paramAccountId = searchParams.get("accountId");
      const paramToken = searchParams.get("token");

      if (paramAccountId && paramToken) {
        accountId = paramAccountId;
        installationToken = paramToken;
      }
    }

    if (!accountId || !installationToken) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication" },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Get Windows installer information
    // --------------------------------------------------

    const data = await getInstallerData(
      accountId,
      "Windows"
    );

    // --------------------------------------------------
    // 3. Create account-specific installer package
    // --------------------------------------------------

    const packageResult =
      await createWindowsInstallerPackage({
        downloadUrl: data.installer.downloadUrl,
        version: data.installer.version,
        installationToken,
      });

    cleanup = packageResult.cleanup;

    // --------------------------------------------------
    // 4. Read generated package
    // --------------------------------------------------

    const packageBuffer = await (
      await import("fs/promises")
    ).readFile(packageResult.packagePath);

    // --------------------------------------------------
    // 5. Return ZIP as download
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
    // 6. Always remove temporary files
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
