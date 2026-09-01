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
      await fs.writeFile(
        scriptPath,
        await download(scriptUrl, scriptName)
      );
      await fs.chmod(scriptPath, 0o755);
    }

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
