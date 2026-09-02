"use client";

import { useState } from "react";

export default function DownloadInstallerButton() {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    try {
      setDownloading(true);

      const response = await fetch(
        "/api/securityagent/installers/windows"
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
      link.download =
        "KuaminiSecurityClient-windows-account.zip";

      document.body.appendChild(link);
      link.click();

      // Cleanup.
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Unable to generate and download installer.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="mt-8 rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {downloading
        ? "Preparing Installer..."
        : "Download Installer"}
    </button>
  );
}