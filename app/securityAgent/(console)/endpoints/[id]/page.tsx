import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/auth/session";
import { getEndpointById } from "@/lib/endpoints/endpoints.service";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

function DetailCard({
  title,
  value,
}: {
  title: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <div className="mt-2 text-lg font-semibold text-white break-all">
        {value}
      </div>
    </div>
  );
}

export default async function EndpointDetailsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const user = await requireSessionUser();

  if (!user) {
    notFound();
  }

  const endpoint = await getEndpointById(
    id,
    user.account_id
  );

  if (!endpoint) {
    notFound();
  }

  return (
    <section className="space-y-8">

      <div>

        <Link
          href="/securityAgent/endpoints"
          className="text-cyan-400 hover:underline"
        >
          ← Back to Endpoints
        </Link>

        <h2 className="mt-4 text-4xl font-bold text-white">
          Endpoint Details
        </h2>

        <p className="mt-2 text-slate-400">
          View detailed endpoint information.
        </p>

      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">


       <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>

            <h3 className="text-3xl font-bold text-white">
              {endpoint.hostname}
            </h3>

            <p className="mt-2 text-slate-400">
              Agent ID: {endpoint.agent_id}
            </p>

          </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                endpoint.status === "online"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-orange-500/20 text-orange-400"
              }`}
            >
              {endpoint.status}
            </span>

            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                endpoint.infected
                  ? "bg-red-500/20 text-red-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              Infected: {endpoint.infected ? "Yes" : "No"}
            </span>

            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                endpoint.secured_by_kuamini
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {endpoint.secured_by_kuamini
                ? "Secured"
                : "Action Required"}
            </span>

          </div>

        </div>

      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        <DetailCard title="Hostname" value={endpoint.hostname} />
        <DetailCard title="Agent ID" value={endpoint.agent_id} />
        <DetailCard title="Operating System" value={endpoint.os} />
        <DetailCard title="OS Version" value={endpoint.os_version} />
        <DetailCard title="Agent Version" value={endpoint.agent_version} />
        <DetailCard title="Local IP" value={endpoint.ip_address} />
        <DetailCard title="Public IP" value={endpoint.public_ip} />
        <DetailCard title="MAC Address" value={endpoint.mac_address} />

        <DetailCard
          title="Registered At"
          value={new Date(
            endpoint.registered_at
          ).toLocaleString()}
        />

        <DetailCard
          title="Last Seen"
          value={new Date(
            endpoint.last_seen_at
          ).toLocaleString()}
        />

        <DetailCard
          title="Created At"
          value={new Date(
            endpoint.created_at
          ).toLocaleString()}
        />

      </div>

    </section>
  );
}