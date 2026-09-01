import { promises as fs } from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";

interface WindowsPackageOptions {
  downloadUrl: string;
  version: string;
  installationToken: string;
}

const REQUIRED_WINDOWS_FILES = [
  "install-helper.ps1",
  "install-windows.cmd",
  "uninstall-kuamini-windows.ps1",
  "uninstall-windows.cmd",
] as const;

function createZip(
  sourceDirectory: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const archive = new AdmZip();
    archive.addLocalFolder(sourceDirectory);
    archive.writeZip(outputPath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function createWindowsInstallerPackage({
  downloadUrl,
  version,
  installationToken,
}: WindowsPackageOptions): Promise<{
  packagePath: string;
  packageName: string;
  cleanup: () => Promise<void>;
}> {
  const tempRoot = await fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "kuamini-windows-package-"
    )
  );

  const sourceZipPath = path.join(
    tempRoot,
    "source.zip"
  );

  const extractedDirectory = path.join(
    tempRoot,
    "extracted"
  );

  const packageDirectory = path.join(
    tempRoot,
    "package"
  );

  const packageName =
    `KuaminiSecurityClient-${version}-windows-account.zip`;

  const packagePath = path.join(
    tempRoot,
    packageName
  );

  try {
    await fs.mkdir(
      extractedDirectory,
      {
        recursive: true,
      }
    );

    await fs.mkdir(
      packageDirectory,
      {
        recursive: true,
      }
    );

    // --------------------------------------------------
    // 1. Download original installer ZIP
    // --------------------------------------------------

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download installer archive: HTTP ${response.status}`
      );
    }

    if (!response.body) {
      throw new Error(
        "Installer download returned an empty response."
      );
    }

    /*
     * Use arrayBuffer() instead of Readable.fromWeb().
     *
     * This avoids the Node.js Web ReadableStream type
     * incompatibility between different TypeScript typings.
     */

    const installerBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (installerBuffer.length === 0) {
      throw new Error(
        "Installer download returned an empty file."
      );
    }

    await fs.writeFile(
      sourceZipPath,
      installerBuffer
    );

    // --------------------------------------------------
    // 2. Extract original installer ZIP
    // --------------------------------------------------

    const zip = new AdmZip(sourceZipPath);

    zip.extractAllTo(
      extractedDirectory,
      true
    );

    // --------------------------------------------------
    // 3. Copy installer files
    // --------------------------------------------------

    async function copyDirectory(
      source: string,
      destination: string
    ): Promise<void> {
      await fs.mkdir(
        destination,
        {
          recursive: true,
        }
      );

      const entries = await fs.readdir(
        source,
        {
          withFileTypes: true,
        }
      );

      for (const entry of entries) {
        const sourcePath = path.join(
          source,
          entry.name
        );

        const destinationPath = path.join(
          destination,
          entry.name
        );

        if (entry.isDirectory()) {
          await copyDirectory(
            sourcePath,
            destinationPath
          );
        } else {
          await fs.copyFile(
            sourcePath,
            destinationPath
          );
        }
      }
    }

    const extractedItems =
      await fs.readdir(
        extractedDirectory,
        {
          withFileTypes: true,
        }
      );

    if (extractedItems.length === 0) {
      throw new Error(
        "Installer archive is empty."
      );
    }

    /*
     * The GitHub ZIP may contain a single
     * top-level directory.
     */

    const rootDirectories =
      extractedItems.filter(
        (entry) => entry.isDirectory()
      );

    const rootFiles =
      extractedItems.filter(
        (entry) => entry.isFile()
      );

    if (
      rootDirectories.length === 1 &&
      rootFiles.length === 0
    ) {
      await copyDirectory(
        path.join(
          extractedDirectory,
          rootDirectories[0].name
        ),
        packageDirectory
      );
    } else {
      await copyDirectory(
        extractedDirectory,
        packageDirectory
      );
    }

    // --------------------------------------------------
    // 4. Add required installer scripts when the source
    //    archive does not already contain them
    // --------------------------------------------------

    for (const requiredFile of REQUIRED_WINDOWS_FILES) {
      const destinationPath = path.join(
        packageDirectory,
        requiredFile
      );

      try {
        await fs.access(destinationPath);
        continue;
      } catch {
        // Download from the same published artifact directory.
      }

      const requiredFileUrl = new URL(
        requiredFile,
        downloadUrl
      );
      const requiredFileResponse = await fetch(requiredFileUrl);

      if (!requiredFileResponse.ok) {
        throw new Error(
          `Required installer file ${requiredFile} is unavailable: HTTP ${requiredFileResponse.status}`
        );
      }

      await fs.writeFile(
        destinationPath,
        Buffer.from(await requiredFileResponse.arrayBuffer())
      );
    }

    // --------------------------------------------------
    // 5. Create account-specific token and config files
    // --------------------------------------------------

    await Promise.all([
      fs.writeFile(
        path.join(packageDirectory, "registration.token"),
        installationToken,
        "utf8"
      ),
      fs.writeFile(
        path.join(packageDirectory, "registration_token.txt"),
        installationToken,
        "utf8"
      ),
    ]);

    const configPath = path.join(
      packageDirectory,
      "config.json"
    );

    const config = {
      api_base:
        "https://kuaminisystems.com/api/securityagent/agent",

      registration_token:
        installationToken,

      agent_id: "",

      account_id: "",

      console_url:
        "https://kuaminisystems.com/securityAgent",

      heartbeat_interval: 60,

      auto_register: true,

      threat_scan_interval: 3600,

      threat_scan_mode: "quick",

      threat_realtime_monitor: false,

      threat_realtime_interval: 300,
    };

    await fs.writeFile(
      configPath,
      JSON.stringify(
        config,
        null,
        2
      ),
      "utf8"
    );

    // --------------------------------------------------
    // 6. Create final account-specific ZIP
    // --------------------------------------------------

    await createZip(
      packageDirectory,
      packagePath
    );

    // --------------------------------------------------
    // 7. Return package
    // --------------------------------------------------

    return {
      packagePath,
      packageName,

      cleanup: async () => {
        await fs.rm(
          tempRoot,
          {
            recursive: true,
            force: true,
          }
        );
      },
    };
  } catch (error) {
    await fs.rm(
      tempRoot,
      {
        recursive: true,
        force: true,
      }
    );

    throw error;
  }
}