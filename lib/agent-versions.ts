import fs from "fs/promises"
import path from "path"

export type InstallerTargetOs = "windows" | "macos" | "linux"

const VERSION_PATTERNS: Record<InstallerTargetOs, RegExp> = {
  windows: /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.msi$/u,
  macos: /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.pkg$/u,
  linux: /^KuaminiSecurityClient-(\d+\.\d+\.\d+(?:\.\d+)?)\.tar\.gz$/u,
}

export function parseVersionParts(value: string | null | undefined): number[] {
  if (!value) {
    return []
  }

  const match = String(value).match(/(\d+(?:\.\d+)+)/)
  if (!match) {
    return []
  }

  return match[1].split(".").map((part) => Number(part) || 0)
}

export function compareVersions(left: number[], right: number[]): number {
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i += 1) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    if (l !== r) {
      return l - r
    }
  }
  return 0
}

async function readTrayEntries() {
  const trayDir = path.join(process.cwd(), "public", "tray")
  try {
    return await fs.readdir(trayDir)
  } catch {
    return [] as string[]
  }
}

export async function getInstallerVersionsByOs(): Promise<Record<InstallerTargetOs, string[]>> {
  const entries = await readTrayEntries()
  const grouped: Record<InstallerTargetOs, string[]> = {
    windows: [],
    macos: [],
    linux: [],
  }

  for (const os of Object.keys(VERSION_PATTERNS) as InstallerTargetOs[]) {
    const pattern = VERSION_PATTERNS[os]
    const versions: string[] = []

    for (const entry of entries) {
      const matched = pattern.exec(entry)
      if (matched?.[1]) {
        versions.push(matched[1])
      }
    }

    const unique = Array.from(new Set(versions))
    unique.sort((a, b) => compareVersions(parseVersionParts(a), parseVersionParts(b)))
    grouped[os] = unique.reverse()
  }

  return grouped
}

export async function getCommonInstallerVersions(limit = 3): Promise<string[]> {
  const byOs = await getInstallerVersionsByOs()

  const [macos, linux] = [
    new Set(byOs.macos),
    new Set(byOs.linux),
  ]

  const common = byOs.windows.filter((version) => macos.has(version) && linux.has(version))
  common.sort((a, b) => compareVersions(parseVersionParts(a), parseVersionParts(b)))

  const picked = common.reverse().slice(0, Math.max(1, limit))
  if (picked.length > 0) {
    return picked
  }

  const fallback = process.env.AGENT_VERSION?.trim()
  return fallback ? [fallback] : []
}

export async function findInstallerForOsVersion(targetOs: InstallerTargetOs, version: string) {
  const entries = await readTrayEntries()
  const pattern = VERSION_PATTERNS[targetOs]

  for (const file of entries) {
    const matched = pattern.exec(file)
    if (matched?.[1] === version) {
      return { file, versionText: matched[1], target_os: targetOs }
    }
  }

  return null
}

export async function findLatestInstallerForOs(targetOs: InstallerTargetOs) {
  const versionsByOs = await getInstallerVersionsByOs()
  const latestVersion = versionsByOs[targetOs][0]
  if (!latestVersion) {
    return null
  }

  const file = await findInstallerForOsVersion(targetOs, latestVersion)
  if (!file) {
    return null
  }

  return file
}
