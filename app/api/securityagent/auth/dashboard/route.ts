import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/dashboard.service";

export async function GET() {
  try {
    // Check if the user is logged in
    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    
   const dashboardData = await getDashboardData(user.account_id);

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Dashboard API Error:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}