
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "http://localhost:3001/api/server-info",
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Server 2 unavailable");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        status: "Error",
        message: "Unable to connect to Server 2",
      },
      { status: 500 }
    );
  }
}