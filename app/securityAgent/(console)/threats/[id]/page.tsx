"use client";

import { useEffect, useState } from "react";
import { getThreatById } from "@/app/services/threatService";

export default function ThreatDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [threat, setThreat] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { id } = await params;
      const data = await getThreatById(id);
      setThreat(data);
    };

    load();
  }, [params]);

  if (!threat) {
    return (
      <div className="p-10 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] p-8 text-white">
      <h1 className="mb-6 text-3xl font-bold">
        Threat Details
      </h1>

      <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
        <p><strong>ID:</strong> {threat.id}</p>
        <p><strong>Name:</strong> {threat.name}</p>
        <p><strong>Severity:</strong> {threat.severity}</p>
        <p><strong>Status:</strong> {threat.status}</p>
        <p><strong>Endpoint:</strong> {threat.hostname}</p>
        <p><strong>IP Address:</strong> {threat.ip_address}</p>
        <p><strong>Detection Engine:</strong> {threat.detection_engine}</p>
        <p><strong>Process:</strong> {threat.process_name}</p>
        <p><strong>Detected At:</strong> {threat.detected_at}</p>
      </div>
    </div>
  );
}