import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { createWriteStream } from "fs";
import { ZipArchive } from "archiver";
import AdmZip from "adm-zip";
import {
  buildLinuxInstallScript,
  buildLinuxUninstallScript,
  buildMacInstallCommand,
  buildMacUninstallCommand,
  buildReadme,
  buildWindowsInstallCommand,
  buildWindowsUninstallCommand,
} from "./agent-package.scripts";

export type AgentPlatform = "windows" | "macos" | "linux";

interface AgentPackageOptions {
  platform: AgentPlatform;
  downloadUrl: string;
  version: string;
  installationToken: string;
  accountId: string;
  accountName?: string | null;
}

export interface AgentPackageResult {
  packagePath: string;
  packageName: string;
  cleanup: () => Promise<void>;
}

const API_BASE_URL =
  process.env.AGENT_API_BASE_URL ||
  "https://kuaminisystems.com/api/securityagent/agent";

const CONSOLE_URL =
  process.env.AGENT_CONSOLE_URL ||
  "https://kuaminisystems.com/securityAgent";

/*
 * The install / uninstall scripts are published next to the agent
 * artifacts. They are not part of the artifact itself, therefore they
 * have to be added to every account specific package.
 */
const DEFAULT_ASSET_BASE_URL =
  "https://raw.githubusercontent.com/vikneeswaran/threat-protection-agent/main/public/tray";

const COMPANION_SCRIPTS: Record<AgentPlatform, string[]> = {
  windows: [
    "install-helper.ps1",
    "uninstall-kuamini-windows.ps1",
  ],
  macos: [
    "install-kuamini-macos.sh",
    "uninstall-kuamini-macos.sh",
  ],
  linux: ["uninstall-kuamini-linux.sh"],
};

const EXECUTABLE_MODE = 0o755;

function createZip(
  sourceDirectory: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);

    const archive = new ZipArchive({
      zlib: {
        level: 9,
      },
    });

    output.on("close", () => {
      resolve();
    });

    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    archive.directory(sourceDirectory, false);

    archive.finalize().catch(reject);
  });
}

async function copyDirectory(
  source: string,
  destination: string
): Promise<void> {
  await fs.mkdir(destination, {
    recursive: true,
  });

  const entries = await fs.readdir(source, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: HTTP ${response.status}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error(`Download returned an empty file: ${url}`);
  }

  return buffer;
}

/*
 * Companion scripts are looked up next to the installer artifact first
 * so a self hosted mirror keeps working, and fall back to the published
 * agent repository.
 */
export function getAssetBaseUrls(downloadUrl: string): string[] {
  const bases: string[] = [];

  const configuredBase = process.env.AGENT_ASSET_BASE_URL;

  if (configuredBase) {
    bases.push(configuredBase.replace(/\/+$/, ""));
  }

  try {
    const parsed = new URL(downloadUrl);

    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/[^/]*$/, "");

    bases.push(parsed.toString().replace(/\/+$/, ""));
  } catch {
    // A malformed download URL only disables this lookup location.
  }

  bases.push(DEFAULT_ASSET_BASE_URL);

  return [...new Set(bases)];
}

async function fetchCompanionScript(
  fileName: string,
  baseUrls: string[]
): Promise<Buffer> {
  const failures: string[] = [];

  for (const baseUrl of baseUrls) {
    try {
      return await downloadFile(`${baseUrl}/${fileName}`);
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  throw new Error(
    `Failed to add required installer script "${fileName}" to the package. ${failures.join(
      " | "
    )}`
  );
}

function getArtifactFileName(
  downloadUrl: string,
  platform: AgentPlatform,
  version: string
): string {
  const fallback =
    platform === "windows"
      ? `KuaminiSecurityClient-${version}.msi`
      : platform === "macos"
        ? `KuaminiSecurityClient-${version}.pkg`
        : `KuaminiSecurityClient-${version}-linux.tar.gz`;

  try {
    const name = path.posix.basename(
      new URL(downloadUrl).pathname
    );

    return name && !name.includes("..") ? name : fallback;
  } catch {
    return fallback;
  }
}

async function writePackageFile(
  packageDirectory: string,
  fileName: string,
  contents: string | Buffer,
  executable = false
): Promise<void> {
  const filePath = path.join(packageDirectory, fileName);

  await fs.writeFile(filePath, contents);

  if (executable) {
    await fs.chmod(filePath, EXECUTABLE_MODE);
  }
}

export async function createAgentInstallerPackage({
  platform,
  downloadUrl,
  version,
  installationToken,
  accountId,
  accountName,
}: AgentPackageOptions): Promise<AgentPackageResult> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `kuamini-${platform}-package-`)
  );

  const extractedDirectory = path.join(tempRoot, "extracted");
  const packageDirectory = path.join(tempRoot, "package");

  const packageName = `KuaminiSecurityClient-${version}-${platform}-account.zip`;

  const packagePath = path.join(tempRoot, packageName);

  const artifactFileName = getArtifactFileName(
    downloadUrl,
    platform,
    version
  );

  try {
    await fs.mkdir(extractedDirectory, {
      recursive: true,
    });

    await fs.mkdir(packageDirectory, {
      recursive: true,
    });

    // --------------------------------------------------
    // 1. Download the platform artifact
    // --------------------------------------------------

    const artifactBuffer = await downloadFile(downloadUrl);

    if (platform === "windows") {
      /*
       * The Windows artifact is a ZIP that contains the MSI, so it is
       * unpacked into the account package.
       */

      const sourceZipPath = path.join(tempRoot, "source.zip");

      await fs.writeFile(sourceZipPath, artifactBuffer);

      new AdmZip(sourceZipPath).extractAllTo(
        extractedDirectory,
        true
      );

      const extractedItems = await fs.readdir(
        extractedDirectory,
        {
          withFileTypes: true,
        }
      );

      if (extractedItems.length === 0) {
        throw new Error("Installer archive is empty.");
      }

      const rootDirectories = extractedItems.filter((entry) =>
        entry.isDirectory()
      );

      const rootFiles = extractedItems.filter((entry) =>
        entry.isFile()
      );

      if (rootDirectories.length === 1 && rootFiles.length === 0) {
        await copyDirectory(
          path.join(extractedDirectory, rootDirectories[0].name),
          packageDirectory
        );
      } else {
        await copyDirectory(extractedDirectory, packageDirectory);
      }
    } else {
      /*
       * macOS (.pkg) and Linux (.tar.gz) artifacts are shipped as is.
       */

      await writePackageFile(
        packageDirectory,
        artifactFileName,
        artifactBuffer
      );
    }

    // --------------------------------------------------
    // 2. Add the published install / uninstall scripts
    // --------------------------------------------------

    const assetBaseUrls = getAssetBaseUrls(downloadUrl);

    for (const scriptName of COMPANION_SCRIPTS[platform]) {
      const scriptBuffer = await fetchCompanionScript(
        scriptName,
        assetBaseUrls
      );

      await writePackageFile(
        packageDirectory,
        scriptName,
        scriptBuffer,
        scriptName.endsWith(".sh")
      );
    }

    // --------------------------------------------------
    // 3. Add the generated launchers
    // --------------------------------------------------

    const scriptContext = {
      version,
      artifactFileName,
    };

    if (platform === "windows") {
      await writePackageFile(
        packageDirectory,
        "install-windows.cmd",
        buildWindowsInstallCommand(scriptContext)
      );

      await writePackageFile(
        packageDirectory,
        "uninstall-windows.cmd",
        buildWindowsUninstallCommand()
      );
    } else if (platform === "macos") {
      await writePackageFile(
        packageDirectory,
        "install-macos.command",
        buildMacInstallCommand(scriptContext),
        true
      );

      await writePackageFile(
        packageDirectory,
        "uninstall-macos.command",
        buildMacUninstallCommand(),
        true
      );
    } else {
      await writePackageFile(
        packageDirectory,
        "install-kuamini-linux.sh",
        buildLinuxInstallScript(scriptContext),
        true
      );

      await writePackageFile(
        packageDirectory,
        "uninstall-linux.sh",
        buildLinuxUninstallScript(),
        true
      );
    }

    // --------------------------------------------------
    // 4. Add the account registration token
    // --------------------------------------------------

    for (const tokenFileName of [
      "registration.token",
      "registration_token.txt",
    ]) {
      await writePackageFile(
        packageDirectory,
        tokenFileName,
        installationToken
      );
    }

    // --------------------------------------------------
    // 5. Add the account specific configuration
    // --------------------------------------------------

    const config = {
      api_base: API_BASE_URL,

      registration_token: installationToken,

      agent_id: "",

      account_id: accountId,

      account_name: accountName || "",

      agent_version: version,

      console_url: CONSOLE_URL,

      heartbeat_interval: 60,

      auto_register: true,

      threat_scan_interval: 3600,

      threat_scan_mode: "quick",

      threat_realtime_monitor: false,

      threat_realtime_interval: 300,
    };

    await writePackageFile(
      packageDirectory,
      "config.json",
      JSON.stringify(config, null, 2)
    );

    await writePackageFile(
      packageDirectory,
      "README.txt",
      buildReadme({
        platform,
        version,
        accountName: accountName || accountId,
      })
    );

    // --------------------------------------------------
    // 6. Create the final account specific ZIP
    // --------------------------------------------------

    await createZip(packageDirectory, packagePath);

    return {
      packagePath,
      packageName,

      cleanup: async () => {
        await fs.rm(tempRoot, {
          recursive: true,
          force: true,
        });
      },
    };
  } catch (error) {
    await fs.rm(tempRoot, {
      recursive: true,
      force: true,
    });

    throw error;
  }
}
