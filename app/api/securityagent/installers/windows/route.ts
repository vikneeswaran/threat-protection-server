import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getInstallerData } from "@/lib/installers/installer.service";
import { getInstallationToken } from "@/lib/installation-token";


export async function GET() {
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
  "Windows"
);

 const installationToken = await getInstallationToken(
      user.account_id
    );

    return NextResponse.json({
      success: true,
      license: data.license,
      installer: data.installer,
      installationToken,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load installer." },
      { status: 500 }
    );
  }
}