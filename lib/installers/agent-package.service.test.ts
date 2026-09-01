// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import AdmZip from "adm-zip";
import {
  createAgentInstallerPackage,
  getAssetBaseUrls,
} from "@/lib/installers/agent-package.service";

const ARTIFACT_BASE =
  "https://example.com/tray/KuaminiSecurityClient-1.0.30";

function createWindowsArtifact(): Buffer {
  const zip = new AdmZip();

  zip.addFile(
    "KuaminiSecurityClient-1.0.30.msi",
    Buffer.from("msi-content")
  );

  return zip.toBuffer();
}

function mockFetch(artifact: Buffer) {
  return vi.fn(async (input: unknown) => {
    const url = String(input);

    const body = url.endsWith(".sh") || url.endsWith(".ps1")
      ? Buffer.from(`# ${url}`)
      : artifact;

    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        body.buffer.slice(
          body.byteOffset,
          body.byteOffset + body.byteLength
        ),
    } as unknown as Response;
  });
}

async function readPackageEntries(
  platform: "windows" | "macos" | "linux",
  downloadUrl: string
) {
  const result = await createAgentInstallerPackage({
    platform,
    downloadUrl,
    version: "1.0.30",
    installationToken: "t".repeat(128),
    accountId: "11111111-1111-1111-1111-111111111111",
    accountName: "Kuamini QA",
  });

  const zip = new AdmZip(result.packagePath);

  const entries = zip
    .getEntries()
    .map((entry) => entry.entryName)
    .sort();

  const contents = new Map(
    zip.getEntries().map((entry) => [
      entry.entryName,
      entry.getData().toString("utf8"),
    ])
  );

  await result.cleanup();

  const readEntry = (name: string) => contents.get(name) ?? "";

  return {
    entries,
    packageName: result.packageName,
    readEntry,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAgentInstallerPackage", () => {
  it("adds every required file to the Windows package", async () => {
    const artifact = createWindowsArtifact();

    vi.stubGlobal("fetch", mockFetch(artifact));

    const { entries, packageName, readEntry } =
      await readPackageEntries(
        "windows",
        `${ARTIFACT_BASE}-windows.zip`
      );

    expect(packageName).toBe(
      "KuaminiSecurityClient-1.0.30-windows-account.zip"
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        "KuaminiSecurityClient-1.0.30.msi",
        "README.txt",
        "config.json",
        "install-helper.ps1",
        "install-windows.cmd",
        "registration.token",
        "registration_token.txt",
        "uninstall-kuamini-windows.ps1",
        "uninstall-windows.cmd",
      ])
    );

    expect(readEntry("registration.token")).toBe("t".repeat(128));

    const config = JSON.parse(readEntry("config.json"));

    expect(config).toMatchObject({
      account_id: "11111111-1111-1111-1111-111111111111",
      account_name: "Kuamini QA",
      agent_version: "1.0.30",
      registration_token: "t".repeat(128),
    });

    // The installed version has to be visible to the tray application.
    expect(readEntry("install-windows.cmd")).toContain(
      "AGENT_VERSION"
    );

    // The tray application has to start without a manual launch.
    expect(readEntry("install-windows.cmd")).toContain(
      "CurrentVersion\\Run"
    );
  });

  it("adds every required file to the macOS package", async () => {
    const artifact = Buffer.from("pkg-content");

    vi.stubGlobal("fetch", mockFetch(artifact));

    const { entries, packageName } = await readPackageEntries(
      "macos",
      `${ARTIFACT_BASE}.pkg`
    );

    expect(packageName).toBe(
      "KuaminiSecurityClient-1.0.30-macos-account.zip"
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        "KuaminiSecurityClient-1.0.30.pkg",
        "README.txt",
        "config.json",
        "install-kuamini-macos.sh",
        "install-macos.command",
        "registration.token",
        "registration_token.txt",
        "uninstall-kuamini-macos.sh",
        "uninstall-macos.command",
      ])
    );
  });

  it("adds every required file to the Linux package", async () => {
    const artifact = Buffer.from("tarball-content");

    vi.stubGlobal("fetch", mockFetch(artifact));

    const { entries, packageName } = await readPackageEntries(
      "linux",
      `${ARTIFACT_BASE}-linux.tar.gz`
    );

    expect(packageName).toBe(
      "KuaminiSecurityClient-1.0.30-linux-account.zip"
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        "KuaminiSecurityClient-1.0.30-linux.tar.gz",
        "README.txt",
        "config.json",
        "install-kuamini-linux.sh",
        "registration.token",
        "registration_token.txt",
        "uninstall-kuamini-linux.sh",
        "uninstall-linux.sh",
      ])
    );
  });

  it("fails when a required installer script cannot be added", async () => {
    const artifact = createWindowsArtifact();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);

        if (url.endsWith(".ps1")) {
          return { ok: false, status: 404 } as unknown as Response;
        }

        return {
          ok: true,
          status: 200,
          arrayBuffer: async () =>
            artifact.buffer.slice(
              artifact.byteOffset,
              artifact.byteOffset + artifact.byteLength
            ),
        } as unknown as Response;
      })
    );

    await expect(
      createAgentInstallerPackage({
        platform: "windows",
        downloadUrl: `${ARTIFACT_BASE}-windows.zip`,
        version: "1.0.30",
        installationToken: "t".repeat(128),
        accountId: "11111111-1111-1111-1111-111111111111",
        accountName: "Kuamini QA",
      })
    ).rejects.toThrow(/install-helper\.ps1/);
  });
});

describe("getAssetBaseUrls", () => {
  it("looks next to the artifact before the published fallback", () => {
    const bases = getAssetBaseUrls(
      "https://example.com/tray/KuaminiSecurityClient-1.0.30-windows.zip"
    );

    expect(bases[0]).toBe("https://example.com/tray");

    expect(bases).toContain(
      "https://raw.githubusercontent.com/vikneeswaran/threat-protection-agent/main/public/tray"
    );
  });
});
