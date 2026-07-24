import EndpointCard from "./EndpointCard";
import { EndpointSummary as EndpointSummaryType } from "@/lib/endpoints/endpoints.service";

type EndpointSummaryProps = {
  summary: EndpointSummaryType;
};

export default function EndpointSummary({
  summary,
}: EndpointSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-8">
      <EndpointCard
        title="Total Endpoints"
        value={summary.total}
        color="text-cyan-400"
      />

      <EndpointCard
        title="Windows"
        value={summary.windows}
        color="text-blue-400"
      />

      <EndpointCard
        title="Linux"
        value={summary.linux}
        color="text-emerald-400"
      />

      <EndpointCard
        title="macOS"
        value={summary.macos}
        color="text-violet-400"
      />

      <EndpointCard
        title="Online"
        value={summary.online}
        color="text-green-400"
      />

      <EndpointCard
        title="Offline"
        value={summary.offline}
        color="text-orange-400"
      />

      <EndpointCard
        title="Infected"
        value={summary.infected}
        color="text-red-500"
      />

      <EndpointCard
        title="Secured by Kuamini"
        value={summary.securedByKuamini}
        color="text-teal-400"
      />
    </div>
  );
}