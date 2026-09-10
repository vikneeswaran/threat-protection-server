import EndpointCard from "./EndpointCard";
import { EndpointSummary as EndpointSummaryType } from "@/lib/endpoints/endpoints.service";

type EndpointSummaryProps = {
  summary: EndpointSummaryType;
};

export default function EndpointSummary({ summary }: EndpointSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-8">
      <EndpointCard
        title="Total Endpoints"
        value={summary.total}
        color="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"
        border="border-cyan-400/60"
        glow="shadow-[0_0_16px_rgba(34,211,238,0.16),inset_0_0_30px_rgba(34,211,238,0.06)] hover:shadow-[0_0_26px_rgba(34,211,238,0.32)]"
        bg="linear-gradient(135deg, rgba(0,180,210,0.22), rgba(5,36,62,0.88) 55%, rgba(5,20,35,0.96))"
        blob="bg-cyan-400/20"
      />

      <EndpointCard
        title="Windows"
        value={summary.windows}
        color="text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]"
        border="border-blue-400/60"
        glow="shadow-[0_0_16px_rgba(59,130,246,0.16),inset_0_0_30px_rgba(59,130,246,0.06)] hover:shadow-[0_0_26px_rgba(59,130,246,0.32)]"
        bg="linear-gradient(135deg, rgba(20,80,190,0.22), rgba(8,25,60,0.88) 55%, rgba(4,12,30,0.96))"
        blob="bg-blue-400/20"
      />

      <EndpointCard
        title="Linux"
        value={summary.linux}
        color="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]"
        border="border-emerald-400/60"
        glow="shadow-[0_0_16px_rgba(16,185,129,0.16),inset_0_0_30px_rgba(16,185,129,0.06)] hover:shadow-[0_0_26px_rgba(16,185,129,0.32)]"
        bg="linear-gradient(135deg, rgba(0,150,100,0.22), rgba(5,45,35,0.88) 55%, rgba(5,20,16,0.96))"
        blob="bg-emerald-400/20"
      />

      <EndpointCard
        title="macOS"
        value={summary.macos}
        color="text-violet-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.4)]"
        border="border-purple-400/60"
        glow="shadow-[0_0_16px_rgba(168,85,247,0.16),inset_0_0_30px_rgba(168,85,247,0.06)] hover:shadow-[0_0_26px_rgba(168,85,247,0.32)]"
        bg="linear-gradient(135deg, rgba(100,30,190,0.24), rgba(43,16,85,0.88) 55%, rgba(25,10,48,0.96))"
        blob="bg-purple-500/20"
      />

      <EndpointCard
        title="Online"
        value={summary.online}
        color="text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]"
        border="border-green-400/60"
        glow="shadow-[0_0_16px_rgba(34,197,94,0.16),inset_0_0_30px_rgba(34,197,94,0.06)] hover:shadow-[0_0_26px_rgba(34,197,94,0.32)]"
        bg="linear-gradient(135deg, rgba(20,140,60,0.22), rgba(6,45,25,0.88) 55%, rgba(4,20,12,0.96))"
        blob="bg-green-400/20"
      />

      <EndpointCard
        title="Offline"
        value={summary.offline}
        color="text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.45)]"
        border="border-orange-400/70"
        glow="shadow-[0_0_16px_rgba(251,146,60,0.18),inset_0_0_30px_rgba(251,146,60,0.06)] hover:shadow-[0_0_26px_rgba(251,146,60,0.34)]"
        bg="linear-gradient(135deg, rgba(180,105,10,0.28), rgba(72,43,12,0.88) 55%, rgba(35,20,7,0.96))"
        blob="bg-orange-400/20"
      />

      <EndpointCard
        title="Infected"
        value={summary.infected}
        color="text-rose-500 drop-shadow-[0_0_10px_rgba(251,113,133,0.45)]"
        border="border-rose-400/70"
        glow="shadow-[0_0_18px_rgba(244,63,94,0.2),inset_0_0_35px_rgba(244,63,94,0.08)] hover:shadow-[0_0_28px_rgba(244,63,94,0.36)]"
        bg="linear-gradient(135deg, rgba(220,30,75,0.25), rgba(58,13,38,0.88) 55%, rgba(25,10,27,0.96))"
        blob="bg-pink-500/20"
      />

      <EndpointCard
        title="Secured by Kuamini"
        value={summary.securedByKuamini}
        color="text-teal-400 drop-shadow-[0_0_10px_rgba(45,212,191,0.4)]"
        border="border-teal-400/60"
        glow="shadow-[0_0_16px_rgba(45,212,191,0.16),inset_0_0_30px_rgba(45,212,191,0.06)] hover:shadow-[0_0_26px_rgba(45,212,191,0.32)]"
        bg="linear-gradient(135deg, rgba(0,160,150,0.22), rgba(5,45,45,0.88) 55%, rgba(4,20,20,0.96))"
        blob="bg-teal-400/20"
      />
    </div>
  );
}