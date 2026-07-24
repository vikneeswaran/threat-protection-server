import { notFound } from "next/navigation";
import { endpoints } from "../data";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EndpointDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const endpoint = endpoints.find((e) => e.id === id);

  if (!endpoint) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold text-white">
          Endpoint Details
        </h2>

        <p className="mt-2 text-slate-400">
          View endpoint information.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-slate-400">Name</p>
            <p>{endpoint.name}</p>
          </div>

          <div>
            <p className="text-slate-400">User</p>
            <p>{endpoint.user}</p>
          </div>

          <div>
            <p className="text-slate-400">Local IP</p>
            <p>{endpoint.localIp}</p>
          </div>

          <div>
            <p className="text-slate-400">Public IP</p>
            <p>{endpoint.publicIp}</p>
          </div>

          <div>
            <p className="text-slate-400">OS</p>
            <p>{endpoint.os}</p>
          </div>

          <div>
            <p className="text-slate-400">Version</p>
            <p>{endpoint.version}</p>
          </div>

          <div>
            <p className="text-slate-400">Status</p>
            <p>{endpoint.status}</p>
          </div>
        </div>
      </div>
    </section>
  );
}