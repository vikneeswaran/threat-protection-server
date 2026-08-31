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

function createEmbeddedInstallHelperScript(): string {
  // Built-in PowerShell script - no external fetch needed
  return `#Requires -RunAsAdministrator
<#
.SYNOPSIS
Kuamini Security Client Installer v1.0.28 - Installation Helper
This is a built-in helper script with no external dependencies.

.DESCRIPTION
Installs Kuamini Security Client by running the MSI with proper configuration.
#>

param(
    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "======================================" -ForegroundColor Green
Write-Host "Kuamini Security Client Installer" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# STEP 1: FIND MSI FILE
Write-Host "[1/4] Locating MSI installer..." -ForegroundColor Yellow

$msiFiles = @(Get-ChildItem -Path $scriptPath -Filter "KuaminiSecurityClient-*.msi" -File -ErrorAction SilentlyContinue)

if ($msiFiles.Count -eq 0) {
    Write-Host "ERROR: No MSI file found in $scriptPath" -ForegroundColor Red
    exit 1
}

$msiPath = $msiFiles[0].FullName
Write-Host "  ✓ Found: $(Split-Path -Leaf $msiPath)" -ForegroundColor Green

# STEP 2: CREATE CONFIG DIRECTORY
Write-Host "[2/4] Creating configuration directory..." -ForegroundColor Yellow

$configDir = Join-Path $env:LOCALAPPDATA "KuaminiSecurityClient"

try {
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    Write-Host "  ✓ Config directory ready: $configDir" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Warning: Could not create config directory" -ForegroundColor Yellow
}

# STEP 3: INSTALL MSI
Write-Host "[3/4] Running MSI installation..." -ForegroundColor Yellow

$logFile = Join-Path $env:TEMP ("kuamini-install-" + (Get-Random) + ".log")

try {
    $msiArgs = @(
        "/i", $msiPath,
        "/L*V", $logFile,
        "/passive",
        "/norestart"
    )

    Write-Host "  Installing package..." -ForegroundColor Cyan
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -PassThru -Wait -NoNewWindow
    $exitCode = $process.ExitCode

    if ($exitCode -eq 0 -or $exitCode -eq 3010) {
        Write-Host "  ✓ MSI installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ MSI installation failed with exit code: $exitCode" -ForegroundColor Red
        if (Test-Path $logFile) {
            Write-Host ""
            Write-Host "MSI Log (last 20 lines):" -ForegroundColor Yellow
            Get-Content $logFile -Tail 20 | Write-Host
        }
        exit $exitCode
    }

    # Cleanup temp log
    if (Test-Path $logFile) {
        Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    }

} catch {
    Write-Host "  ✗ Installation error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# STEP 4: VERIFY AND START AGENT
Write-Host "[4/4] Verifying installation and starting agent..." -ForegroundColor Yellow

$installDir = "C:\Program Files\Kuamini Security Client"
$exePath = Join-Path $installDir "KuaminiSecurityClient.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "  ✗ Error: Agent executable not found at $exePath" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Installation verified" -ForegroundColor Green

# Start the agent
try {
    Write-Host "  Starting agent..." -ForegroundColor Cyan
    Start-Process $exePath -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    if (Get-Process KuaminiSecurityClient -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ Agent started successfully" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Agent process not immediately visible (may start shortly)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ Could not start agent: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  Agent will start automatically on next login" -ForegroundColor Cyan
}

# SUMMARY
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "✓ INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open Kuamini Console: https://kuaminisystems.com/securityAgent" -ForegroundColor Gray
Write-Host "  2. Login to your account" -ForegroundColor Gray
Write-Host "  3. Verify the new endpoint appears in your dashboard" -ForegroundColor Gray
Write-Host "  4. Check System Tray for the Kuamini icon" -ForegroundColor Gray
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "  Agent log: $configDir\agent.log" -ForegroundColor Gray
Write-Host "  Config: $configDir\config.json" -ForegroundColor Gray
Write-Host ""

exit 0
`;
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
    // 5. Create built-in install-helper.ps1 (no external fetch)
    // --------------------------------------------------

    console.info("[Windows Package] Creating built-in installation helper...");

    const helperScriptPath = path.join(
      packageDirectory,
      "install-helper.ps1"
    );

    const helperScript = createEmbeddedInstallHelperScript();

    await fs.writeFile(
      helperScriptPath,
      helperScript,
      "utf8"
    );

    console.info(
      `[Windows Package] Created install-helper.ps1 (${helperScript.length} bytes)`
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
      installCmdContent,
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
  - install-windows.cmd        : Launcher (requires admin)
  - install-helper.ps1         : Built-in helper script
  - KuaminiSecurityClient-*.msi : Windows installer
  - config.json                : Account-specific configuration
  - README.txt                 : This file

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
      readmeContent,
      "utf8"
    );

    // --------------------------------------------------
    // 8. Create final ZIP
    // --------------------------------------------------

    console.info("[Windows Package] Creating final package...");

    await createZip(
      packageDirectory,
      packagePath
    );

    console.info("[Windows Package] Package created successfully");

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
