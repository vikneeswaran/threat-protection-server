import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { createWriteStream } from "fs";
import { ZipArchive } from "archiver";
import AdmZip from "adm-zip";

interface WindowsPackageOptions {
  downloadUrl: string;
  version: string;
  installationToken: string;
}

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
    // 4. Create account-specific config.json
    // --------------------------------------------------

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
    // 5. Create install-windows.cmd batch file
    // --------------------------------------------------

    const installCmdPath = path.join(
      packageDirectory,
      "install-windows.cmd"
    );

    const installCmdContent = `@echo off
REM Kuamini Security Client Installer v${version}
REM This script runs the PowerShell helper script with administrative privileges

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Check if PowerShell helper exists
if not exist "%SCRIPT_DIR%install-helper.ps1" (
    echo.
    echo ERROR: install-helper.ps1 not found!
    echo Expected location: %SCRIPT_DIR%install-helper.ps1
    echo.
    pause
    exit /b 1
)

REM Run PowerShell script with administrator privileges
echo Running Kuamini Security Client Installer...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install-helper.ps1"

exit /b %ERRORLEVEL%
`;

    await fs.writeFile(
      installCmdPath,
      installCmdContent,
      "utf8"
    );

    // --------------------------------------------------
    // 6. Create README.txt for user guidance
    // --------------------------------------------------

    const readmePath = path.join(
      packageDirectory,
      "README.txt"
    );

    const readmeContent = `================================================================================
  KUAMINI SECURITY CLIENT v${version} - WINDOWS INSTALLATION
================================================================================

QUICK START:
  1. Extract this ZIP to a folder
  2. Right-click "install-windows.cmd" and select "Run as administrator"
  3. Follow the installation wizard
  4. Agent will start automatically and appear in your dashboard

CONTENTS:
  - install-windows.cmd        : Run this to install (requires admin)
  - install-helper.ps1         : PowerShell helper script (auto-executed)
  - KuaminiSecurityClient-*.msi : Windows installer package
  - config.json                : Account-specific configuration (auto-generated)
  - README.txt                 : This file

SYSTEM REQUIREMENTS:
  - Windows 10 or later
  - Administrator privileges required for installation
  - .NET Framework 4.6+ (usually pre-installed)

INSTALLATION STEPS:
  1. Right-click "install-windows.cmd"
  2. Select "Run as administrator"
  3. Accept any security prompts
  4. Installation will complete in 2-5 minutes
  5. Tray icon will appear in system tray (bottom-right corner)

VERIFICATION:
  - Open Windows Task Manager (Ctrl+Shift+Esc)
  - Look for "KuaminiSecurityClient" in Processes tab
  - Check logs: %LOCALAPPDATA%\\KuaminiSecurityClient\\agent.log
  - Visit dashboard: https://kuaminisystems.com/securityAgent

TROUBLESHOOTING:
  - If installation fails, check the MSI log file for details
  - Ensure you have administrator privileges
  - Try running as administrator again
  - Check firewall settings to allow Kuamini application

FOR SUPPORT:
  - Email: support@kuaminisystems.com
  - Dashboard: https://kuaminisystems.com/securityAgent

================================================================================
`;

    await fs.writeFile(
      readmePath,
      readmeContent,
      "utf8"
    );

    // --------------------------------------------------
    // 7. Create final account-specific ZIP
    // --------------------------------------------------

    await createZip(
      packageDirectory,
      packagePath
    );

    // --------------------------------------------------
    // 8. Return package
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
