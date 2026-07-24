"use client";

import { useEffect, useState } from "react";
import { getThreatSummary } from "@/app/services/threatService";

interface Summary {
  detected: number;
  critical: number;
  open_incidents: number;
  resolved: number;
}

export default function ThreatSummaryCards() {
  const [summary, setSummary] = useState<Summary>({
    detected: 0,
    critical: 0,
    open_incidents: 0,
    resolved: 0,
  });

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const data = await getThreatSummary();
      console.log(data);
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  const cards = [
    {
      title: "Detected",
      value: summary.detected,
      color: "text-white",
    },
    {
      title: "Critical",
      value: summary.critical,
      color: "text-red-400",
    },
    {
      title: "Open Incidents",
      value: summary.open_incidents,
      color: "text-yellow-400",
    },
    {
      title: "Resolved",
      value: summary.resolved,
      color: "text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-5 mt-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-slate-800 bg-[#111827] p-4"
        >
          <p className="text-xs uppercase text-slate-400">
            {card.title}
          </p>

          <h2 className={`mt-3 text-3xl font-bold ${card.color}`}>
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}