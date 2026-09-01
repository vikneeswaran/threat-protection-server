import { promises as fs } from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";

type Platform = "macos" | "linux";

interface PlatformPackageOptions {
  downloadUrl: string;
  fileName: string;
  version: string;
  installationToken: string;
  platform: Platform;
}

const PLATFORM_SCRIPTS: Record<Platform, readonly string[]> = {
  macos: [
    "install-kuamini-macos.sh",
    "uninstall-kuamini-macos.sh",
  ],
  linux: ["uninstall-kuamini-linux.sh"],
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function createMacosLauncher(fileName: string): string {
  return `#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN="$(tr -d '\\r\\n' < "$SCRIPT_DIR/registration.token")"
exec "$SCRIPT_DIR/install-kuamini-macos.sh" "$TOKEN" "$SCRIPT_DIR"/${shellQuote(fileName)}
`;
}

function createLinuxInstaller(fileName: string): string {
  return `#!/bin/bash
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONSOLE_USER="\${SUDO_USER:-$(id -un)}"
USER_HOME="$(getent passwd "$CONSOLE_USER" | cut -d: -f6)"
INSTALL_DIR="/opt/kuamini-security-client"
CONFIG_DIR="$USER_HOME/.kuamini"
AUTOSTART_DIR="$USER_HOME/.config/autostart"

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$AUTOSTART_DIR"
tar -xzf "$SCRIPT_DIR"/${shellQuote(fileName)} -C "$INSTALL_DIR"
cp "$SCRIPT_DIR/config.json" "$SCRIPT_DIR/registration.token" "$CONFIG_DIR/"

EXECUTABLE="$(find "$INSTALL_DIR" -type f -name KuaminiSecurityClient -perm -u+x -print -quit)"
if [ -z "$EXECUTABLE" ]; then
  echo "Kuamini Security Client executable was not found in the archive." >&2
  exit 1
fi

cat > "$AUTOSTART_DIR/kuamini-security-client.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Kuamini Security Client
Exec=$EXECUTABLE
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

chown -R "$CONSOLE_USER":"$CONSOLE_USER" "$CONFIG_DIR" "$AUTOSTART_DIR"
sudo -u "$CONSOLE_USER" env HOME="$USER_HOME" DISPLAY="\${DISPLAY:-:0}" "$EXECUTABLE" >/dev/null 2>&1 &
echo "Kuamini Security Client installed and started."
`;
}

function createZip(sourceDirectory: string, outputPath: string): Promise<void> {
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

async function download(url: URL | string, description: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${description}: HTTP ${response.status}`
    );
  }

  const content = Buffer.from(await response.arrayBuffer());
  if (content.length === 0) {
    throw new Error(`${description} download returned an empty file.`);
  }

  return content;
}

export async function createPlatformInstallerPackage({
  downloadUrl,
  fileName,
  version,
  installationToken,
  platform,
}: PlatformPackageOptions): Promise<{
  packagePath: string;
  packageName: string;
  cleanup: () => Promise<void>;
}> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `kuamini-${platform}-package-`)
  );
  const packageDirectory = path.join(tempRoot, "package");
  const packageName =
    `KuaminiSecurityClient-${version}-${platform}-account.zip`;
  const packagePath = path.join(tempRoot, packageName);

  try {
    await fs.mkdir(packageDirectory, { recursive: true });

    const safeFileName = path.basename(fileName);
    if (!safeFileName || safeFileName === "." || safeFileName === path.sep) {
      throw new Error("Installer file name is invalid.");
    }

    await fs.writeFile(
      path.join(packageDirectory, safeFileName),
      await download(downloadUrl, `${platform} installer`)
    );

    for (const scriptName of PLATFORM_SCRIPTS[platform]) {
      const scriptUrl = new URL(scriptName, downloadUrl);
      const scriptPath = path.join(packageDirectory, scriptName);
      const script = (
        await download(scriptUrl, scriptName)
      ).toString("utf8").replaceAll(
        "https://kuaminisystems.com/api/agent",
        "https://kuaminisystems.com/api/securityagent/agent"
      );
      await fs.writeFile(
        scriptPath,
        script,
        "utf8"
      );
      await fs.chmod(scriptPath, 0o755);
    }

    const launcherName =
      platform === "macos" ? "install-macos.command" : "install-linux.sh";
    const launcher =
      platform === "macos"
        ? createMacosLauncher(safeFileName)
        : createLinuxInstaller(safeFileName);
    const launcherPath = path.join(packageDirectory, launcherName);
    await fs.writeFile(launcherPath, launcher, "utf8");
    await fs.chmod(launcherPath, 0o755);

    const config = {
      api_base: "https://kuaminisystems.com/api/securityagent/agent",
      registration_token: installationToken,
      agent_id: "",
      account_id: "",
      console_url: "https://kuaminisystems.com/securityAgent",
      heartbeat_interval: 60,
      auto_register: true,
      threat_scan_interval: 3600,
      threat_scan_mode: "quick",
      threat_realtime_monitor: false,
      threat_realtime_interval: 300,
    };

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
      fs.writeFile(
        path.join(packageDirectory, "config.json"),
        JSON.stringify(config, null, 2),
        "utf8"
      ),
    ]);

    await createZip(packageDirectory, packagePath);

    return {
      packagePath,
      packageName,
      cleanup: () => fs.rm(tempRoot, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}
