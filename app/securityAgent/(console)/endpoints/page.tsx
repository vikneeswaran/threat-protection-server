import { requireSessionUser } from "@/lib/auth/session";
import { getEndpointsData } from "@/lib/endpoints/endpoints.service";

import EndpointSummary from "../components/EndpointSummary";
import EndpointTable from "../components/EndpointTable";

export const metadata = {
  title: "Endpoints | Kuamini Security Agent",
};

export default async function SecurityAgentEndpointsPage() {
  const user = await requireSessionUser();

  if (!user) {
    return (
      <div className="text-white p-8">
        User session not found
      </div>
    );
  }

  const endpointData = await getEndpointsData(user.account_id);

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-4xl font-bold text-white">
          Endpoints
        </h2>

        <p className="mt-2 text-slate-400">
          Manage registered devices and monitor endpoint protection status.
        </p>
      </div>

      {/* Summary Cards */}
      <EndpointSummary summary={endpointData.summary} />

      {/* Endpoint Inventory */}
      <EndpointTable endpoints={endpointData.endpoints} />
    </section>
  );
}