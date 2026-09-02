// @vitest-environment node
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { promises as fs } from "fs";
import { writeFileSync, unlinkSync } from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { ZipArchive } from "archiver";
import { createWriteStream } from "fs";
import AdmZip from "adm-zip";
import { createWindowsInstallerPackage } from "@/lib/installers/windows-package.service";

const VERSION = "1.0.30";
const INSTALLATION_TOKEN = "test-installation-token-1234567890";

let pwshAvailable = false;

beforeAll(() => {
  try {
    execFileSync("pwsh", ["-NoLogo", "-NoProfile", "-Command", "$PSVersionTable.PSVersion"], {
      stdio: "ignore",
    });
    pwshAvailable = true;
  } catch {
    pwshAvailable = false;
  }
});

async function createFakeSourceZip(): Promise<{ zipPath: string; cleanup: () => Promise<void> }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kuamini-source-zip-"));
  const zipPath = path.join(tempRoot, "source.zip");

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.append("fake msi contents", { name: "KuaminiSecurityClient-1.0.30.msi" });
    void archive.finalize();
  });

  return {
    zipPath,
    cleanup: async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

function parsePowerShellForSyntaxErrors(scriptContent: string): string[] {
  const tempFile = path.join(
    os.tmpdir(),
    `kuamini-ps-check-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`
  );

  writeFileSync(tempFile, scriptContent, "utf8");

  try {
    const output = execFileSync(
      "pwsh",
      [
        "-NoLogo",
        "-NoProfile",
        "-Command",
        `$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${tempFile.replace(/'/g, "''")}', [ref]$null, [ref]$errors) | Out-Null; $errors | ForEach-Object { $_.Message }`,
      ],
      { encoding: "utf8" }
    );

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } finally {
    unlinkSync(tempFile);
  }
}

function readZipEntryText(zip: AdmZip, entryName: string): string {
  const entry = zip.getEntry(entryName);
  if (!entry) {
    throw new Error(`Expected zip entry "${entryName}" to exist.`);
  }
  return zip.readAsText(entry);
}

describe("createWindowsInstallerPackage", () => {
  const originalFetch = globalThis.fetch;
  let cleanupFns: Array<() => Promise<void>> = [];

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await Promise.all(cleanupFns.map((fn) => fn()));
    cleanupFns = [];
  });

  it("produces a package with all required Windows files and the current version", async () => {
    const { zipPath, cleanup } = await createFakeSourceZip();
    cleanupFns.push(cleanup);

    const zipBuffer = await fs.readFile(zipPath);

    globalThis.fetch = (async () =>
      new Response(zipBuffer, { status: 200 })) as unknown as typeof fetch;

    const result = await createWindowsInstallerPackage({
      downloadUrl: "https://example.com/agent.zip",
      version: VERSION,
      installationToken: INSTALLATION_TOKEN,
    });

    cleanupFns.push(result.cleanup);

    expect(result.packageName).toBe(
      `KuaminiSecurityClient-${VERSION}-windows-account.zip`
    );

    const zip = new AdmZip(result.packagePath);
    const entries = zip.getEntries().map((entry) => entry.entryName);

    const requiredFiles = [
      "install-helper.ps1",
      "install-windows.cmd",
      "uninstall-kuamini-windows.ps1",
      "uninstall-windows.cmd",
      "registration.token",
      "registration_token.txt",
      "config.json",
      "README.txt",
    ];

    for (const file of requiredFiles) {
      expect(entries).toContain(file);
    }

    const configEntry = zip.getEntry("config.json");
    expect(configEntry).not.toBeNull();

    const config = JSON.parse(readZipEntryText(zip, "config.json"));
    expect(config.agent_version).toBe(VERSION);
    expect(config.registration_token).toBe(INSTALLATION_TOKEN);

    const registrationToken = readZipEntryText(zip, "registration.token");
    expect(registrationToken).toBe(INSTALLATION_TOKEN);

    const registrationTokenTxt = readZipEntryText(zip, "registration_token.txt");
    expect(registrationTokenTxt).toBe(INSTALLATION_TOKEN);

    const readme = readZipEntryText(zip, "README.txt");
    expect(readme).toContain(VERSION);
    expect(readme).toContain("uninstall-windows.cmd");
    expect(readme).toContain("uninstall-kuamini-windows.ps1");

    const installCmd = readZipEntryText(zip, "install-windows.cmd");
    expect(installCmd).toContain(VERSION);

    const uninstallCmd = readZipEntryText(zip, "uninstall-windows.cmd");
    expect(uninstallCmd).toContain(VERSION);
    expect(uninstallCmd).toContain("uninstall-kuamini-windows.ps1");
  });

  it("generates syntactically valid PowerShell install and uninstall scripts", async () => {
    if (!pwshAvailable) {
      // Skip if pwsh is not available in this environment.
      return;
    }

    const { zipPath, cleanup } = await createFakeSourceZip();
    cleanupFns.push(cleanup);

    const zipBuffer = await fs.readFile(zipPath);

    globalThis.fetch = (async () =>
      new Response(zipBuffer, { status: 200 })) as unknown as typeof fetch;

    const result = await createWindowsInstallerPackage({
      downloadUrl: "https://example.com/agent.zip",
      version: VERSION,
      installationToken: INSTALLATION_TOKEN,
    });

    cleanupFns.push(result.cleanup);

    const zip = new AdmZip(result.packagePath);

    const installScript = readZipEntryText(zip, "install-helper.ps1");
    const uninstallScript = readZipEntryText(zip, "uninstall-kuamini-windows.ps1");

    expect(parsePowerShellForSyntaxErrors(installScript)).toEqual([]);
    expect(parsePowerShellForSyntaxErrors(uninstallScript)).toEqual([]);
  });
});
