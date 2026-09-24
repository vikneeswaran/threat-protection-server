"use client";

import { useEffect, useState } from "react";
import { getThreatById } from "@/app/services/threatService";

export default function ThreatDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [threat, setThreat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadThreat = async () => {
      try {
        setLoading(true);

        const { id } = await params;

        const data = await getThreatById(id);

        console.log("Threat API Response:", data);

        setThreat(data);
      } catch (err) {
        console.error("Failed to load threat:", err);
        setError("Failed to load threat details.");
      } finally {
        setLoading(false);
      }
    };

    loadThreat();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] p-10 text-white">
        <p className="text-lg text-slate-300">
          Loading threat details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] p-10 text-white">
        <div className="rounded-xl border border-red-500/30 bg-[#111827] p-6">
          <h1 className="mb-2 text-xl font-semibold text-red-400">
            Error
          </h1>

          <p className="text-slate-300">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="min-h-screen bg-[#020617] p-10 text-white">
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-6">
          <p className="text-slate-300">
            Threat details not found.
          </p>
        </div>
      </div>
    );
  }

  /*
   * Get the file path
   */
  const filePath =
    threat.file_path ||
    threat.filePath ||
    "";

  /*
   * Get process name from API if available.
   * If API does not provide it, extract it from file path.
   *
   * Example:
   * C:\Windows\System32\wuapihost.exe
   *
   * becomes:
   * wuapihost.exe
   */
  const processName =
    threat.process_name ||
    threat.processName ||
    threat.process ||
    (filePath
      ? filePath.split("\\").pop()
      : null) ||
    "Not available";

  return (
    <div className="min-h-screen bg-[#020617] p-8 text-white">

      {/* Page Title */}
      <h1 className="mb-6 text-3xl font-bold">
        Threat Details
      </h1>

      {/* Details Card */}
      <div className="space-y-5 rounded-xl border border-slate-800 bg-[#111827] p-6">

        {/* ID */}
        <p>
          <strong>ID:</strong>{" "}
          {threat.id || "Not available"}
        </p>

        {/* Name */}
        <p>
          <strong>Name:</strong>{" "}
          {threat.name || "Not available"}
        </p>

        {/* Severity */}
        <p>
          <strong>Severity:</strong>{" "}
          {threat.severity || "Not available"}
        </p>

        {/* Status */}
        <p>
          <strong>Status:</strong>{" "}
          {threat.status || "Not available"}
        </p>

        {/* Endpoint */}
        <p>
          <strong>Endpoint:</strong>{" "}
          {threat.hostname || "Not available"}
        </p>

        {/* IP Address */}
        <p>
          <strong>IP Address:</strong>{" "}
          {threat.ip_address || "Not available"}
        </p>

        {/* Detection Engine */}
        <p>
          <strong>Detection Engine:</strong>{" "}
          {threat.detection_engine || "Not available"}
        </p>

        {/* File Path */}
        <p>
          <strong>File Path:</strong>{" "}
          {filePath || "Not available"}
        </p>

        {/* Process */}
        <p>
          <strong>Process:</strong>{" "}
          {processName}
        </p>

        {/* Detected At */}
        <p>
          <strong>Detected At:</strong>{" "}
          {threat.detected_at || "Not available"}
        </p>

      </div>
    </div>
  );
}