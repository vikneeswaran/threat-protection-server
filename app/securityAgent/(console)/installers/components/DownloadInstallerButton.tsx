"use client";

export default function DownloadInstallerButton() {
  async function handleDownload() {
  try {
    const response = await fetch("/api/securityagent/installers/windows");

    if (!response.ok) {
      throw new Error("Failed to fetch installer.");
    }

    const data = await response.json();

    console.log("Installer data:", data);

    // Start download
    window.location.href = data.installer.downloadUrl;

  } catch (error) {
    console.error("Download error:", error);
    alert("Unable to download installer.");
  }
}

  return (
    <button
      onClick={handleDownload}
      className="mt-8 rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
    >
      Download Installer
    </button>
  );
}