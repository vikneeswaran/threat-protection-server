// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AGENT_RELEASE_VERSION,
  DEFAULT_AGENT_ASSET_BASE_URL,
  getPackagedArtifactFileName,
  getPublishedArtifactFileName,
  getPublishedArtifactUrl,
} from "@/lib/installers/agent-release";

describe("agent release metadata", () => {
  it("matches the version built by the agent workflow", () => {
    expect(AGENT_RELEASE_VERSION).toBe("1.0.30");
  });

  it("builds the published artifact names", () => {
    expect(getPublishedArtifactFileName("windows")).toBe(
      "KuaminiSecurityClient-1.0.30-windows.zip"
    );

    expect(getPublishedArtifactFileName("macos")).toBe(
      "KuaminiSecurityClient-1.0.30.pkg"
    );

    expect(getPublishedArtifactFileName("linux")).toBe(
      "KuaminiSecurityClient-1.0.30-linux.tar.gz"
    );
  });

  it("packages the MSI extracted from the Windows archive", () => {
    expect(getPackagedArtifactFileName("windows", "1.0.31")).toBe(
      "KuaminiSecurityClient-1.0.31.msi"
    );

    expect(getPackagedArtifactFileName("macos", "1.0.31")).toBe(
      "KuaminiSecurityClient-1.0.31.pkg"
    );
  });

  it("builds the published artifact url", () => {
    expect(getPublishedArtifactUrl("linux", "1.0.30")).toBe(
      `${DEFAULT_AGENT_ASSET_BASE_URL}/KuaminiSecurityClient-1.0.30-linux.tar.gz`
    );

    expect(
      getPublishedArtifactUrl("macos", "1.0.30", "https://cdn.example.com/tray/")
    ).toBe("https://cdn.example.com/tray/KuaminiSecurityClient-1.0.30.pkg");
  });
});
