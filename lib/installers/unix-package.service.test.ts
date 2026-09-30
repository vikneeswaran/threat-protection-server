// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import AdmZip from "adm-zip";
import { createUnixInstallerPackage } from "./unix-package.service";

const originalFetch = globalThis.fetch;
const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});

describe("createUnixInstallerPackage", () => {
  for (const platform of ["macos", "linux"] as const) {
    it(`packages a ${platform} ZIP artifact with account-specific registration`, async () => {
      const source = new AdmZip();
      source.addFile("release/KuaminiSecurityClient-1.2.3.bin", Buffer.from("agent"));
      const fetchMock = vi.fn(async () => new Response(source.toBuffer()));
      globalThis.fetch = fetchMock as typeof fetch;

      const result = await createUnixInstallerPackage({
        platform,
        downloadUrl: "https://example.com/release.zip",
        fileName: "KuaminiSecurityClient-1.2.3.zip",
        version: "1.2.3",
        installationToken: `token-${platform}`,
      });
      cleanup.push(result.cleanup);

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/release.zip");
      expect(result.packageName).toBe(`KuaminiSecurityClient-1.2.3-${platform}-account.zip`);
      const zip = new AdmZip(await fs.readFile(result.packagePath));
      expect(zip.readAsText("KuaminiSecurityClient-1.2.3.bin")).toBe("agent");
      expect(zip.readAsText("registration.token")).toBe(`token-${platform}`);
      expect(zip.readAsText("registration_token.txt")).toBe(`token-${platform}`);
      expect(JSON.parse(zip.readAsText("config.json"))).toMatchObject({
        agent_version: "1.2.3",
        registration_token: `token-${platform}`,
        auto_register: true,
      });
      await result.cleanup();
      cleanup.pop();
      await expect(fs.access(result.packagePath)).rejects.toThrow();
    });
  }

  it("preserves a native installer as an artifact alongside the configuration", async () => {
    globalThis.fetch = (async () => new Response("native-pkg")) as typeof fetch;
    const result = await createUnixInstallerPackage({
      platform: "macos",
      downloadUrl: "https://example.com/agent.pkg",
      fileName: "KuaminiSecurityClient-1.2.3.pkg",
      version: "1.2.3",
      installationToken: "token",
    });
    cleanup.push(result.cleanup);
    expect(new AdmZip(result.packagePath).readAsText("KuaminiSecurityClient-1.2.3.pkg")).toBe("native-pkg");
  });

  it.each(["../outside", "config.json", "registration.token", "sub/../../outside"])(
    "rejects unsafe or conflicting source entry %s",
    async (name) => {
      const source = new AdmZip();
      const placeholder = "x".repeat(name.length);
      source.addFile(placeholder, Buffer.from("agent"));
      const archive = source.toBuffer();
      const oldName = Buffer.from(placeholder);
      for (let index = archive.indexOf(oldName); index !== -1; index = archive.indexOf(oldName, index + name.length)) {
        archive.write(name, index, "utf8");
      }
      globalThis.fetch = (async () => new Response(archive)) as typeof fetch;
      await expect(createUnixInstallerPackage({
        platform: "linux",
        downloadUrl: "https://example.com/release.zip",
        fileName: "KuaminiSecurityClient-1.2.3.zip",
        version: "1.2.3",
        installationToken: "token",
      })).rejects.toThrow("Unsafe installer archive entry");
    }
  );

  it("rejects empty downloads and unsafe metadata", async () => {
    globalThis.fetch = (async () => new Response("")) as typeof fetch;
    const options = {
      platform: "linux" as const,
      downloadUrl: "https://example.com/release.zip",
      fileName: "KuaminiSecurityClient-1.2.3.zip",
      version: "1.2.3",
      installationToken: "token",
    };
    await expect(createUnixInstallerPackage(options)).rejects.toThrow("empty file");
    await expect(createUnixInstallerPackage({ ...options, version: '1.2.3"\r\n' }))
      .rejects.toThrow("Invalid installer metadata");
  });
});
