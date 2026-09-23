import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Threat types supported by the current agent detection engine.
    const threatTypes = [
      "ransomware",
      "trojan",
      "pup",
      "worm",
      "rootkit",
      "suspicious",
      "resource_abuse",
      "process_anomaly",
    ];

    return NextResponse.json(threatTypes);
  } catch (error) {
    console.error("Failed to fetch threat types:", error);

    return NextResponse.json(
      { error: "Failed to fetch threat types" },
      { status: 500 }
    );
  }
}