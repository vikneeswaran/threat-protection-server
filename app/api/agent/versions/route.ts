import { type NextRequest, NextResponse } from "next/server"
import { getCommonInstallerVersions, getInstallerVersionsByOs } from "@/lib/agent-versions"

interface VersionInfo {
  version: string
  releaseDate: string
  downloadUrl: string
  notes: string
}

interface VersionResponse {
  platform: string
  versions: VersionInfo[]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get("platform")?.toLowerCase()

    // Get limit from query params, default to 3, max 10
    const limitParam = searchParams.get("limit")
    let limit = 3
    if (limitParam) {
      const parsed = Number.parseInt(limitParam, 10)
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 10)
      }
    }

    // Return all platforms if not specified
    const platforms = platform ? [platform] : ["windows", "macos", "linux"]

    const versionsByOs = await getInstallerVersionsByOs()
    const commonVersions = await getCommonInstallerVersions(Math.max(1, limit))
    const versionMap: Record<string, VersionResponse> = {}

    for (const plat of platforms) {
      if (!["windows", "macos", "linux"].includes(plat)) {
        continue
      }

      // Get latest N versions for selected platform
      const versions = versionsByOs[plat as "windows" | "macos" | "linux"].slice(0, limit).map((v, index) => ({
        version: v,
        releaseDate: new Date(2026, 3, Math.max(1, 20 - index)).toISOString().split("T")[0],
        downloadUrl: `/api/agent/installers/download?platform=${plat}&version=${v}`,
        notes: index === 0 ? "Latest version" : "Previous release",
      }))

      versionMap[plat] = {
        platform: plat,
        versions,
      }
    }

    // Return single platform or all platforms
    if (platform && platform in versionMap) {
      return NextResponse.json({
        ...versionMap[platform],
        common_versions: commonVersions,
        max_selectable: Math.max(1, Math.min(limit, 3)),
      })
    }

    return NextResponse.json({
      ...versionMap,
      common_versions: commonVersions,
      max_selectable: Math.max(1, Math.min(limit, 3)),
    })
  } catch (error) {
    console.error("Error fetching versions:", error)
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 })
  }
}
