// @vitest-environment node

import AdmZip from "adm-zip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlatformInstallerPackage } from "./platform-package.service";
import { createWindowsInstallerPackage } from "./windows-package.service";

const TOKEN = "t".repeat(128);
const createdPackages: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(createdPackages.splice(0).map((cleanup) => cleanup()));
});

function response(content: string | Buffer): Response {
  const body =
    typeof content === "string"
      ? content
      : Uint8Array.from(content).buffer;
  return new Response(body, { status: 200 });
}

function readEntry(archive: AdmZip, name: string): string {
  return (
    archive
      .getEntries()
      .find((entry) => entry.entryName === name)
      ?.getData()
      .toString("utf8") ?? ""
  );
}

describe("account installer packages", () => {
  it("adds required Windows scripts and both registration token files", async () => {
    const source = new AdmZip();
    source.addFile(
      "release/KuaminiSecurityClient-1.0.29.msi",
      Buffer.from("msi")
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.endsWith("KuaminiSecurityClient-1.0.29-windows.zip")) {
          return response(source.toBuffer());
        }
        return response(`contents of ${new URL(url).pathname}`);
      })
    );

    const result = await createWindowsInstallerPackage({
      downloadUrl:
        "https://downloads.example/tray/KuaminiSecurityClient-1.0.29-windows.zip",
      version: "1.0.29",
      installationToken: TOKEN,
    });
    createdPackages.push(result.cleanup);

    const archive = new AdmZip(result.packagePath);
    const entries = archive.getEntries().map((entry) => entry.entryName);

    expect(entries).toEqual(
      expect.arrayContaining([
        "KuaminiSecurityClient-1.0.29.msi",
        "install-helper.ps1",
        "install-windows.cmd",
        "uninstall-kuamini-windows.ps1",
        "uninstall-windows.cmd",
        "registration.token",
        "registration_token.txt",
        "config.json",
      ])
    );
    expect(readEntry(archive, "registration.token")).toBe(TOKEN);
    expect(readEntry(archive, "registration_token.txt")).toBe(TOKEN);
    expect(JSON.parse(readEntry(archive, "config.json"))).toMatchObject({
      registration_token: TOKEN,
      api_base: "https://kuaminisystems.com/api/securityagent/agent",
    });
  });

  it.each([
    {
      platform: "macos" as const,
      fileName: "KuaminiSecurityClient-1.0.29.pkg",
      scripts: [
        "install-kuamini-macos.sh",
        "uninstall-kuamini-macos.sh",
      ],
    },
    {
      platform: "linux" as const,
      fileName: "KuaminiSecurityClient-1.0.29-linux.tar.gz",
      scripts: ["uninstall-kuamini-linux.sh"],
    },
  ])("creates a populated $platform account package", async ({
    platform,
    fileName,
    scripts,
  }) => {
    vi.stubGlobal("fetch", vi.fn(async () => response("artifact")));

    const result = await createPlatformInstallerPackage({
      downloadUrl: `https://downloads.example/tray/${fileName}`,
      fileName,
      version: "1.0.29",
      installationToken: TOKEN,
      platform,
    });
    createdPackages.push(result.cleanup);

    const archive = new AdmZip(result.packagePath);
    const entries = archive.getEntries().map((entry) => entry.entryName);

    expect(entries).toEqual(
      expect.arrayContaining([
        fileName,
        ...scripts,
        "registration.token",
        "registration_token.txt",
        "config.json",
      ])
    );
    expect(readEntry(archive, "registration.token")).toBe(TOKEN);
  });
});
