import Link from "next/link";
import { Endpoint } from "@/lib/endpoints/endpoints.service";

type EndpointTableProps = {
  endpoints: Endpoint[];
};

export default function EndpointTable({
  endpoints,
}: EndpointTableProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h3 className="mb-6 text-3xl font-semibold">
        Endpoint Inventory
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="pb-3 text-left text-slate-400">Name</th>
              <th className="pb-3 text-left text-slate-400">Local IP</th>
              <th className="pb-3 text-left text-slate-400">Public IP</th>
              <th className="pb-3 text-left text-slate-400">OS</th>
              <th className="pb-3 text-left text-slate-400">Version</th>
              <th className="pb-3 text-left text-slate-400">Agent Version</th>
              <th className="pb-3 text-left text-slate-400">Status</th>
              <th className="pb-3 text-left text-slate-400">Infected</th>
              <th className="pb-3 text-left text-slate-400">
                Secured by Kuamini
              </th>
            </tr>
          </thead>

          <tbody>
            {endpoints.map((endpoint) => (
              <tr
                key={endpoint.id}
                className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
              >
                <td className="py-4">
                  <Link
                    href={`/securityAgent/endpoints/${endpoint.id}`}
                    className="font-medium text-cyan-400 hover:underline"
                  >
                    {endpoint.hostname}
                  </Link>
                </td>

                <td>{endpoint.ip_address}</td>

                <td>{endpoint.public_ip}</td>

                <td>{endpoint.os}</td>

                <td>{endpoint.os_version}</td>

                <td>{endpoint.agent_version}</td>

                <td>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      endpoint.status === "online"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {endpoint.status}
                  </span>
                </td>

                <td>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      endpoint.infected
                        ? "bg-red-500/20 text-red-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {endpoint.infected ? "Yes" : "No"}
                  </span>
                </td>

                <td>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      endpoint.secured_by_kuamini
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {endpoint.secured_by_kuamini ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}