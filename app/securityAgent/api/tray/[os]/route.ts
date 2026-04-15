import { NextResponse } from "next/server"

// Serve static tray bundles from the public/tray directory.
// Files should exist at public/tray/{macos|linux|windows}.zip at build time.
export async function GET(request: Request, { params }: { params: Promise<{ os: string }> }) {
  const { os } = await params

  let filename: string

  switch (os.toLowerCase()) {
    case "macos":
      filename = "macos.zip"
      break
    case "linux":
      filename = "linux.zip"
      break
    case "windows":
      filename = "windows.zip"
      break
    default:
      return NextResponse.json({ error: "Unsupported OS" }, { status: 400 })
  }

  // Redirect to the static asset under /tray so nginx can serve it directly.
  const target = new URL(`/tray/${filename}`, request.url)
  return NextResponse.redirect(target)
}
