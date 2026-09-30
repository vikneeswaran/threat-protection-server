import { promises as fs } from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";

export type UnixPlatform = "macos" | "linux";

interface PackageOptions {
  platform: UnixPlatform;
  downloadUrl: string;
  fileName: string;
  version: string;
  installationToken: string;
}

export async function createUnixInstallerPackage({
  platform,
  downloadUrl,
  fileName,
  version,
  installationToken,
}: PackageOptions) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileName) ||
      !fileName.startsWith("KuaminiSecurityClient-") ||
      !fileName.includes(version)) {
    throw new Error("Invalid installer metadata.");
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `kuamini-${platform}-package-`));
  const packageName = `KuaminiSecurityClient-${version}-${platform}-account.zip`;
  const packagePath = path.join(tempRoot, packageName);

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download installer: HTTP ${response.status}`);
    }
    const artifact = Buffer.from(await response.arrayBuffer());
    if (!artifact.length) {
      throw new Error("Installer download returned an empty file.");
    }

    const output = new AdmZip();
    const reserved = new Set(["config.json", "registration.token", "registration_token.txt"]);
    if (fileName.toLowerCase().endsWith(".zip")) {
      const source = new AdmZip(artifact);
      const entries = source.getEntries();
      if (!entries.some((entry) => !entry.isDirectory)) {
        throw new Error("Installer archive is empty.");
      }
      for (const entry of entries) {
        const name = entry.entryName;
        if (name.startsWith("/") || name.includes("\\") ||
            name.split("/").some((segment) => segment === "." || segment === "..") ||
            ((entry.header.attr >>> 16) & 0xf000) === 0xa000) {
          throw new Error("Unsafe installer archive entry.");
        }
      }
      const names = entries.map((entry) => entry.entryName);
      const root = names.every((name) => name.includes("/") && name.split("/")[0] === names[0].split("/")[0])
        ? `${names[0].split("/")[0]}/`
        : "";
      const seen = new Set<string>();
      for (const entry of entries) {
        const name = entry.entryName.slice(root.length);
        if (!name || entry.isDirectory) {
          continue;
        }
        if (name.startsWith("/") || name.includes("\\") ||
            name.split("/").some((segment) => segment === "." || segment === ".." || !segment) ||
            reserved.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
          throw new Error("Unsafe installer archive entry.");
        }
        seen.add(name.toLowerCase());
        output.addFile(name, entry.getData(), undefined, entry.header.attr);
      }
    } else {
      output.addFile(fileName, artifact);
    }

    const config = {
      api_base: "https://kuaminisystems.com/api/securityagent/agent",
      registration_token: installationToken,
      agent_id: "",
      account_id: "",
      endpoint_id: "",
      installation_instance_id: "",
      agent_version: version,
      console_url: "https://kuaminisystems.com/securityAgent",
      heartbeat_interval: 60,
      auto_register: true,
      threat_scan_interval: 3600,
      threat_scan_mode: "quick",
      threat_realtime_monitor: false,
      threat_realtime_interval: 300,
    };
    output.addFile("config.json", Buffer.from(JSON.stringify(config, null, 2)));
    output.addFile("registration.token", Buffer.from(installationToken));
    output.addFile("registration_token.txt", Buffer.from(installationToken));
    output.writeZip(packagePath);

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
