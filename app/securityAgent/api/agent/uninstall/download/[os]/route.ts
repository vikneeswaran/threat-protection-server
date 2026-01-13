import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(request: NextRequest, { params }: { params: Promise<{ os: string }> }) {
  const { os } = await params

  let filename: string
  let contentType: string

  switch (os.toLowerCase()) {
    case "macos":
      filename = "uninstall-kuamini-macos.sh"
      contentType = "application/x-sh"
      break
    case "linux":
      filename = "uninstall-kuamini-linux.sh"
      contentType = "application/x-sh"
      break
    case "windows":
      filename = "uninstall-kuamini-windows.ps1"
      contentType = "application/octet-stream"
      break
    default:
      return NextResponse.json({ error: "Unsupported OS" }, { status: 400 })
  }

  try {
    // Read the uninstaller file from public/tray directory
    const filePath = join(process.cwd(), "public", "tray", filename)
    const script = await readFile(filePath, "utf-8")

    return new NextResponse(script, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error(`Error reading uninstaller file ${filename}:`, error)
    return NextResponse.json({ error: "Uninstaller file not found" }, { status: 404 })
  }
}
