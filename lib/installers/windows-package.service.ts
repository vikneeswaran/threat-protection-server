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

async function fetchInstallHelperScript(): Promise<string> {
  try {
    console.info(
      "[Windows Package] Fetching install-helper.ps1 from agent repo..."
    );

    const response = await fetch(
      "https://raw.githubusercontent.com/vikneeswaran/threat-protection-agent/main/public/tray/install-helper.ps1",
      {
        method: "GET",
        timeout: 30000,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch install-helper.ps1: HTTP ${response.status} ${response.statusText}`
      );
    }

    const helperScript = await response.text();

    if (!helperScript || helperScript.length < 500) {
      throw new Error(
        `Fetched install-helper.ps1 is too small (${helperScript.length} bytes). Expected > 500 bytes.`
      );
    }

    // Validate script has expected content
    if (
      !helperScript.includes("Kuamini Security Client") ||
      !helperScript.includes("install-helper.ps1")
    ) {
      throw new Error(
        "Fetched script doesn't contain expected Kuamini content"
      );
    }

    console.info(
      `[Windows Package] Successfully fetched install-helper.ps1 (${helperScript.length} bytes)`
    );

    return helperScript;
  } catch (error) {
    console.error(
      "[Windows Package] Failed to fetch install-helper.ps1:",
      error
    );

    // Return a fallback inline helper script
    console.warn(
      "[Windows Package] Using fallback inline installation helper"
    );

    // eslint-disable-next-line no-useless-escape
    return `#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client Installer - Installation Helper (Fallback)

.DESCRIPTION
This is a fallback helper script when fetch fails.
#>

param([Parameter(Mandatory = $false)][switch]$Quiet)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Kuamini Security Client Installer" -ForegroundColor Green
Write-Host ""

# STEP 1: FIND MSI FILE
Write-Host "[1/3] Locating MSI installer..." -ForegroundColor Yellow

$msiPath = Get-ChildItem -Path $scriptPath -Filter "KuaminiSecurityClient-*.msi" -File -ErrorAction SilentlyContinue | 
    Select-Object -First 1 -ExpandProperty FullName

if (-not $msiPath -or -not (Test-Path $msiPath)) {
    Write-Host "  X ERROR: MSI file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "  + Found MSI: $(Split-Path -Leaf $msiPath)" -ForegroundColor Green

# STEP 2: PREPARE CONFIG DIRECTORY
Write-Host "[2/3] Preparing installation configuration..." -ForegroundColor Yellow

$configDir = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"
New-Item -ItemType Directory -Path $configDir -Force -ErrorAction Stop | Out-Null
Write-Host "  + Config directory created" -ForegroundColor Green

# STEP 3: INSTALL MSI
Write-Host "[3/3] Installing MSI package..." -ForegroundColor Yellow

$tempLogFile = Join-Path $env:TEMP "kuamini-install-$(Get-Random).log"

try {
    $msiArgs = @(
        "/i", $msiPath,
        "/L*V", $tempLogFile,
        "/passive"
    )

    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -PassThru -Wait -NoNewWindow
    $exitCode = $process.ExitCode

    if ($exitCode -ne 0 -and $exitCode -ne 3010) {
        Write-Host "  X MSI installation failed with exit code: $exitCode" -ForegroundColor Red
        if (Test-Path $tempLogFile) {
            Write-Host "  Last 30 lines of log:" -ForegroundColor Yellow
            Get-Content $tempLogFile -Tail 30 | Write-Host
        }
        exit $exitCode
    }

    Write-Host "  + MSI installation completed" -ForegroundColor Green
    Remove-Item $tempLogFile -Force -ErrorAction SilentlyContinue

} catch {
    Write-Host "  X ERROR: MSI installation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "+ INSTALLATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host ""

exit 0
`;
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
    // 5. Fetch and add install-helper.ps1
    // --------------------------------------------------

    const helperScript = await fetchInstallHelperScript();

    const helperScriptPath = path.join(
      packageDirectory,
      "install-helper.ps1"
    );

    await fs.writeFile(
      helperScriptPath,
      helperScript,
      "utf8"
    );

    // --------------------------------------------------
    // 6. Create install-windows.cmd batch file
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
    // 7. Create README.txt for user guidance
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
    // 8. Create final account-specific ZIP
    // --------------------------------------------------

    await createZip(
      packageDirectory,
      packagePath
    );

    // --------------------------------------------------
    // 9. Return package
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
