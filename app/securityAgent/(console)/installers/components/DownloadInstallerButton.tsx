"use client";

import { useState } from "react";

type Platform = "windows" | "macos" | "linux";

const PLATFORMS: {
  id: Platform;
  label: string;
}[] = [
  { id: "windows", label: "🪟 Windows" },
  { id: "macos", label: "🍎 macOS" },
  { id: "linux", label: "🐧 Linux" },
];

export default function DownloadInstallerButton() {
  const [downloading, setDownloading] = useState<Platform | null>(
    null
  );

  async function handleDownload(platform: Platform) {
    try {
      setDownloading(platform);

      const response = await fetch(
        `/api/securityagent/installers/${platform}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to generate installer. HTTP ${response.status}`
        );
      }

      // The API returns the generated ZIP directly.
      const blob = await response.blob();

      // Create a temporary browser URL for the ZIP.
      const url = window.URL.createObjectURL(blob);

      // Create a temporary download link.
      const link = document.createElement("a");
      link.href = url;

      // The server already provides Content-Disposition,
      // but setting a filename here gives the browser a safe fallback.
      link.download = `KuaminiSecurityClient-${platform}-account.zip`;

      document.body.appendChild(link);
      link.click();

      // Cleanup.
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Unable to generate and download installer.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mt-8 flex flex-wrap gap-4">
      {PLATFORMS.map((platform) => (
        <button
          key={platform.id}
          onClick={() => handleDownload(platform.id)}
          disabled={downloading !== null}
          className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading === platform.id
            ? "Preparing Installer..."
            : `Download ${platform.label}`}
        </button>
      ))}
    </div>
  );
}
