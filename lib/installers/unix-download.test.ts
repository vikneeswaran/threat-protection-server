// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireSessionUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ query: vi.fn() }));
vi.mock("@/lib/installation-token", () => ({ getInstallationToken: vi.fn() }));
vi.mock("@/lib/installers/installer.service", () => ({ getInstallerData: vi.fn() }));
vi.mock("@/lib/installers/unix-package.service", () => ({ createUnixInstallerPackage: vi.fn() }));

import { requireSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getInstallationToken } from "@/lib/installation-token";
import { getInstallerData } from "@/lib/installers/installer.service";
import { createUnixInstallerPackage } from "@/lib/installers/unix-package.service";
import { downloadUnixInstaller } from "./unix-download";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const session = vi.mocked(requireSessionUser);
const database = vi.mocked(query);
const token = vi.mocked(getInstallationToken);
const installer = vi.mocked(getInstallerData);
const packageBuilder = vi.mocked(createUnixInstallerPackage);

beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue(null);
  installer.mockResolvedValue({
    license: { total: 1, allocated: 0, used: 0, available: 1 },
    installer: {
      version: "1.2.3",
      platform: "Linux",
      fileName: "KuaminiSecurityClient-1.2.3.zip",
      fileSize: "123",
      downloadUrl: "https://example.com/agent.zip",
    },
  });
});

describe("downloadUnixInstaller", () => {
  it("rejects unauthenticated requests before looking up installer metadata", async () => {
    const response = await downloadUnixInstaller(new Request("https://example.com/download"), "linux");
    expect(response.status).toBe(401);
    expect(installer).not.toHaveBeenCalled();
  });

  it("rejects an expired or unknown installation token", async () => {
    database.mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const response = await downloadUnixInstaller(new Request("https://example.com/download?token=expired"), "macos");
    expect(response.status).toBe(401);
    expect(installer).not.toHaveBeenCalled();
  });

  for (const platform of ["macos", "linux"] as const) {
    it(`downloads the ${platform} installer for the session account and cleans up`, async () => {
      session.mockResolvedValue({ account_id: "session-account" } as Awaited<ReturnType<typeof requireSessionUser>>);
      token.mockResolvedValue("session-token");
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "unix-route-test-"));
      const packagePath = path.join(directory, "package.zip");
      await fs.writeFile(packagePath, "zip bytes");
      const cleanup = vi.fn(async () => fs.rm(directory, { recursive: true, force: true }));
      packageBuilder.mockResolvedValue({ packagePath, packageName: "package.zip", cleanup });

      const response = await downloadUnixInstaller(new Request("https://example.com/download?token=ignored"), platform);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await response.text()).toBe("zip bytes");
      expect(installer).toHaveBeenCalledWith("session-account", platform === "macos" ? "macOS" : "Linux");
      expect(packageBuilder).toHaveBeenCalledWith(expect.objectContaining({
        platform,
        installationToken: "session-token",
      }));
      expect(database).not.toHaveBeenCalled();
      expect(cleanup).toHaveBeenCalledOnce();
    });
  }

  it("accepts only a valid unexpired token when there is no session", async () => {
    database.mockResolvedValueOnce({ rows: [{ account_id: "token-account" }] } as unknown as Awaited<ReturnType<typeof query>>);
    packageBuilder.mockRejectedValueOnce(new Error("download failed"));
    const response = await downloadUnixInstaller(new Request("https://example.com/download?token=valid"), "linux");
    expect(database).toHaveBeenCalledWith(expect.stringContaining("expires_at > NOW()"), ["valid"]);
    expect(installer).toHaveBeenCalledWith("token-account", "Linux");
    expect(packageBuilder).toHaveBeenCalledWith(expect.objectContaining({ installationToken: "valid" }));
    expect(response.status).toBe(500);
  });
});
