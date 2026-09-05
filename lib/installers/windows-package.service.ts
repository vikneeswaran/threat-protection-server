import { promises as fs } from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";

interface WindowsPackageOptions {
  downloadUrl: string;
  version: string;
  installationToken: string;
}

function toCrlf(s: string): string {
  return s.replace(/\r?\n/g, "\r\n");
}

async function createZip(
  sourceDirectory: string,
  outputPath: string
): Promise<void> {
  const zip = new AdmZip();

  async function addDir(baseDir: string, zipPath = ""): Promise<void> {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      const inZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await addDir(fullPath, inZipPath);
      } else {
        const data = await fs.readFile(fullPath);
        zip.addFile(inZipPath.replace(/\\/g, "/"), data);
      }
    }
  }

  await addDir(sourceDirectory);
  zip.writeZip(outputPath);
}
function applyTemplateVars(
  content: string,
  vars: Record<string, string>
): string {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`__${k}__`, v ?? "");
  }
  return out;
}

async function readTemplate(name: string): Promise<string> {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "tray",
    "templates",
    name
  );

  const content = await fs.readFile(templatePath, "utf8");

  if (!content || content.trim().length < 200) {
    throw new Error(
      `[Windows Package] Template ${name} appears empty/corrupt`
    );
  }

  return content;
}

async function verifyRequiredFiles(packageDirectory: string): Promise<void> {
  const expectedFiles = [
    "install-helper.ps1",
    "uninstall-kuamini-windows.ps1",
    "registration.token",
  ];

  for (const fileName of expectedFiles) {
    const fullPath = path.join(packageDirectory, fileName);
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(
        `[Windows Package] Missing required file in package directory: ${fileName}`
      );
    }
  }
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

    console.info("[Windows Package] Downloading installer from agent repo...");

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

    const installerBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (installerBuffer.length === 0) {
      throw new Error(
        "Installer download returned an empty file."
      );
    }

    console.info(
      `[Windows Package] Downloaded installer (${installerBuffer.length} bytes)`
    );

    await fs.writeFile(
      sourceZipPath,
      installerBuffer
    );

    // --------------------------------------------------
    // 2. Extract original installer ZIP
    // --------------------------------------------------

    console.info("[Windows Package] Extracting installer contents...");

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

    console.info("[Windows Package] Creating account-specific config...");

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

      endpoint_id: "",

      installation_instance_id: "",

      agent_version: version,

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
    // 4b. Create registration token files
    // --------------------------------------------------

    console.info("[Windows Package] Writing registration token files...");

    await fs.writeFile(
      path.join(
        packageDirectory,
        "registration.token"
      ),
      installationToken,
      "utf8"
    );

    await fs.writeFile(
      path.join(
        packageDirectory,
        "registration_token.txt"
      ),
      installationToken,
      "utf8"
    );

    // --------------------------------------------------
    // 5. Create install-helper.ps1 from template
    // --------------------------------------------------

    console.info("[Windows Package] Creating built-in installation helper...");

    const helperScriptPath = path.join(
      packageDirectory,
      "install-helper.ps1"
    );

    const helperTemplate = await readTemplate("install-helper.ps1");
    const helperScript = applyTemplateVars(helperTemplate, {
      VERSION: version,
    });
    const helperScriptCrlf = toCrlf(helperScript);
    const helperBytes = Buffer.byteLength(helperScriptCrlf, "utf8");

    if (helperBytes < 4000) {
      throw new Error(
        `[Windows Package] install-helper.ps1 too small (${helperBytes} bytes), aborting package`
      );
    }

    await fs.writeFile(
      helperScriptPath,
      helperScriptCrlf,
      "utf8"
    );

    console.info(
      `[Windows Package] Created install-helper.ps1 (${helperBytes} bytes)`
    );

    // --------------------------------------------------
    // 5b. Create uninstall-kuamini-windows.ps1 from template
    // --------------------------------------------------

    console.info("[Windows Package] Creating built-in uninstallation helper...");

    const uninstallScriptPath = path.join(
      packageDirectory,
      "uninstall-kuamini-windows.ps1"
    );

    const uninstallTemplate = await readTemplate("uninstall-kuamini-windows.ps1");
    const uninstallScript = applyTemplateVars(uninstallTemplate, {
      VERSION: version,
    });
    const uninstallScriptCrlf = toCrlf(uninstallScript);
    const uninstallBytes = Buffer.byteLength(uninstallScriptCrlf, "utf8");

    if (uninstallBytes < 3000) {
      throw new Error(
        `[Windows Package] uninstall-kuamini-windows.ps1 too small (${uninstallBytes} bytes), aborting package`
      );
    }

    await fs.writeFile(
      uninstallScriptPath,
      uninstallScriptCrlf,
      "utf8"
    );

    console.info(
      `[Windows Package] Created uninstall-kuamini-windows.ps1 (${uninstallBytes} bytes)`
    );

    // --------------------------------------------------
    // 6. Create install-windows.cmd batch file
    // --------------------------------------------------

    console.info("[Windows Package] Creating batch file launcher...");

    const installCmdPath = path.join(
      packageDirectory,
      "install-windows.cmd"
    );

    const installCmdContent = `@echo off
REM Kuamini Security Client Installer v${version}
REM This script runs the PowerShell helper with administrator privileges

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0

if not exist "%SCRIPT_DIR%install-helper.ps1" (
    echo.
    echo ERROR: install-helper.ps1 not found!
    echo Expected: %SCRIPT_DIR%install-helper.ps1
    echo.
    pause
    exit /b 1
)

echo Running Kuamini Security Client Installer v${version}...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install-helper.ps1"

exit /b %ERRORLEVEL%
`;

    await fs.writeFile(
      installCmdPath,
      toCrlf(installCmdContent),
      "utf8"
    );

    // --------------------------------------------------
    // 6b. Create uninstall-windows.cmd batch file
    // --------------------------------------------------

    console.info("[Windows Package] Creating uninstall batch file launcher...");

    const uninstallCmdPath = path.join(
      packageDirectory,
      "uninstall-windows.cmd"
    );

    const uninstallCmdContent = `@echo off
REM Kuamini Security Client Uninstaller v${version}
REM This script runs the PowerShell helper with administrator privileges

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0

if not exist "%SCRIPT_DIR%uninstall-kuamini-windows.ps1" (
    echo.
    echo ERROR: uninstall-kuamini-windows.ps1 not found!
    echo Expected: %SCRIPT_DIR%uninstall-kuamini-windows.ps1
    echo.
    pause
    exit /b 1
)

echo Running Kuamini Security Client Uninstaller v${version}...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%uninstall-kuamini-windows.ps1"

exit /b %ERRORLEVEL%
`;

    await fs.writeFile(
      uninstallCmdPath,
      toCrlf(uninstallCmdContent),
      "utf8"
    );

    // --------------------------------------------------
    // 7. Create README.txt
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
  2. Right-click "install-windows.cmd" → "Run as administrator"
  3. Follow the installer
  4. Agent starts automatically

CONTENTS:
  - install-windows.cmd             : Install launcher (requires admin)
  - install-helper.ps1              : Built-in install helper script
  - uninstall-windows.cmd           : Uninstall launcher (requires admin)
  - uninstall-kuamini-windows.ps1   : Built-in uninstall helper script
  - KuaminiSecurityClient-*.msi     : Windows installer
  - config.json                     : Account-specific configuration
  - registration.token              : Account registration token
  - registration_token.txt          : Account registration token (text copy)
  - README.txt                      : This file

SYSTEM REQUIREMENTS:
  - Windows 10 or later
  - Administrator privileges
  - .NET Framework 4.6+

INSTALLATION:
  1. Right-click install-windows.cmd
  2. Select "Run as administrator"
  3. Accept prompts
  4. Completes in 2-5 minutes
  5. Look for Kuamini icon in system tray

UNINSTALLATION:
  1. Right-click uninstall-windows.cmd
  2. Select "Run as administrator"

VERIFICATION:
  - Check: %LOCALAPPDATA%\\KuaminiSecurityClient\\agent.log
  - Dashboard: https://kuaminisystems.com/securityAgent
  - Task Manager: Look for KuaminiSecurityClient process

SUPPORT:
  - Email: support@kuaminisystems.com
  - Dashboard: https://kuaminisystems.com/securityAgent

================================================================================
`;

    await fs.writeFile(
      readmePath,
      toCrlf(readmeContent),
      "utf8"
    );

    // --------------------------------------------------
    // 8. Integrity checks before ZIP creation
    // --------------------------------------------------

    await verifyRequiredFiles(packageDirectory);

    // --------------------------------------------------
    // 9. Create final ZIP
    // --------------------------------------------------

    console.info("[Windows Package] Creating final package...");

    await createZip(
      packageDirectory,
      packagePath
    );

    console.info("[Windows Package] Package created successfully");

    // --------------------------------------------------
    // 10. Return package
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
    console.error("[Windows Package] Error creating package:", error);

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