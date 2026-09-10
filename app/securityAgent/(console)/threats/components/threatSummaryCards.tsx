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
      console.info(data);
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  const cards = [
    {
      title: "Detected",
      value: summary.detected,
      valueColor: "text-cyan-400",
      valueGlow: "drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]",
      border: "border-cyan-400/60",
      shadow:
        "shadow-[0_0_18px_rgba(34,211,238,0.18),inset_0_0_35px_rgba(34,211,238,0.07)] hover:shadow-[0_0_30px_rgba(34,211,238,0.35)]",
      bg: "linear-gradient(135deg, rgba(0,180,210,0.24), rgba(5,36,62,0.88) 55%, rgba(5,20,35,0.96))",
      blob: "bg-cyan-400/20",
      labelColor: "text-cyan-100/80",
    },
    {
      title: "Critical",
      value: summary.critical,
      valueColor: "text-rose-400",
      valueGlow: "drop-shadow-[0_0_12px_rgba(251,113,133,0.45)]",
      border: "border-rose-400/70",
      shadow:
        "shadow-[0_0_20px_rgba(244,63,94,0.2),inset_0_0_40px_rgba(244,63,94,0.08)] hover:shadow-[0_0_32px_rgba(244,63,94,0.38)]",
      bg: "linear-gradient(135deg, rgba(220,30,75,0.25), rgba(58,13,38,0.88) 55%, rgba(25,10,27,0.96))",
      blob: "bg-pink-500/20",
      labelColor: "text-pink-100/85",
    },
    {
      title: "Open Incidents",
      value: summary.open_incidents,
      valueColor: "text-amber-400",
      valueGlow: "drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]",
      border: "border-amber-400/80",
      shadow:
        "shadow-[0_0_22px_rgba(245,158,11,0.22),inset_0_0_45px_rgba(245,158,11,0.08)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)]",
      bg: "linear-gradient(135deg, rgba(180,105,10,0.30), rgba(72,43,12,0.88) 55%, rgba(35,20,7,0.96))",
      blob: "bg-orange-400/20",
      labelColor: "text-amber-100/90",
    },
    {
      title: "Resolved",
      value: summary.resolved,
      valueColor: "text-emerald-400",
      valueGlow: "drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]",
      border: "border-emerald-400/60",
      shadow:
        "shadow-[0_0_18px_rgba(16,185,129,0.18),inset_0_0_35px_rgba(16,185,129,0.07)] hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]",
      bg: "linear-gradient(135deg, rgba(0,150,100,0.24), rgba(5,45,35,0.88) 55%, rgba(5,20,16,0.96))",
      blob: "bg-emerald-400/20",
      labelColor: "text-emerald-100/85",
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`group relative min-h-[140px] overflow-hidden rounded-2xl border ${card.border} p-5 transition-all duration-300 hover:-translate-y-1 ${card.shadow}`}
          style={{ background: card.bg }}
        >
          <div
            className={`pointer-events-none absolute -right-16 -bottom-16 h-44 w-44 rounded-full ${card.blob} blur-3xl`}
          />

          <div className="relative z-10">
            <p className={`text-xs font-medium uppercase tracking-wide ${card.labelColor}`}>
              {card.title}
            </p>

            <h2
              className={`mt-3 text-4xl font-bold ${card.valueColor} ${card.valueGlow}`}
            >
              {card.value}
            </h2>
          </div>
        </div>
      ))}
    </div>
  );
}