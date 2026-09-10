"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Endpoint } from "@/lib/endpoints/endpoints.service";

type EndpointTableProps = {
  endpoints: Endpoint[];
};

export default function EndpointTable({ endpoints }: EndpointTableProps) {
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [infectedFilter, setInfectedFilter] = useState("");
  const [securedFilter, setSecuredFilter] = useState("");
  const [sortField, setSortField] = useState<keyof Endpoint>("hostname");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: keyof Endpoint) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredEndpoints = useMemo(() => {
    const filtered = endpoints.filter((endpoint) => {
      const matchesSearch =
        endpoint.hostname.toLowerCase().includes(search.toLowerCase()) ||
        (endpoint.ip_address ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (endpoint.public_ip ?? "").toLowerCase().includes(search.toLowerCase()) ||
        endpoint.os.toLowerCase().includes(search.toLowerCase()) ||
        endpoint.os_version.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "" ||
        statusFilter === "all" ||
        endpoint.status === statusFilter;

      const matchesInfected =
        infectedFilter === "" ||
        infectedFilter === "all" ||
        String(endpoint.infected) === infectedFilter;

      const matchesSecured =
        securedFilter === "" ||
        securedFilter === "all" ||
        String(endpoint.secured_by_kuamini) === securedFilter;

      return matchesSearch && matchesStatus && matchesInfected && matchesSecured;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return sortDirection === "asc"
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      return sortDirection === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return filtered;
  }, [
    endpoints,
    search,
    statusFilter,
    infectedFilter,
    securedFilter,
    sortField,
    sortDirection,
  ]);

  const renderSortArrow = (field: keyof Endpoint) => {
    if (sortField !== field) {
      return <span className="text-slate-500">⇅</span>;
    }

    return <span>{sortDirection === "asc" ? "▲" : "▼"}</span>;
  };

  return (
    <div
      className="relative overflow-visible rounded-2xl border border-cyan-400/35 shadow-[0_0_28px_rgba(34,211,238,0.12),inset_0_0_45px_rgba(34,211,238,0.05)]"
      style={{
        background:
          "linear-gradient(145deg, rgba(20,58,105,0.7), rgba(7,26,58,0.94) 65%, rgba(4,15,35,0.98))",
      }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-80 rounded-bl-full bg-cyan-400/15 blur-2xl" />

      {/* Header */}
      <div className="relative z-10 p-6">
        <h2 className="text-2xl font-bold text-white">Endpoint Inventory</h2>

        <p className="mt-1 text-sm text-sky-200/70">
          Registered devices in your organization.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search endpoints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#06152c]/85 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 sm:w-72 lg:w-80"
          />

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#06152c]/85 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="" disabled hidden>
              Status
            </option>
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>

          {/* Infected */}
          <select
            value={infectedFilter}
            onChange={(e) => setInfectedFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#06152c]/85 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="" disabled hidden>
              Infected
            </option>
            <option value="all">All</option>
            <option value="true">Infected</option>
            <option value="false">Clean</option>
          </select>

          {/* Secured */}
          <select
            value={securedFilter}
            onChange={(e) => setSecuredFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#06152c]/85 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="" disabled hidden>
              Secured
            </option>
            <option value="all">All </option>
            <option value="true">Secured</option>
            <option value="false">Not Secured</option>
          </select>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10" />

      <div className="relative z-10 overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th
                onClick={() => handleSort("hostname")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Name
                  {renderSortArrow("hostname")}
                </div>
              </th>

              <th
                onClick={() => handleSort("ip_address")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Local IP
                  {renderSortArrow("ip_address")}
                </div>
              </th>

              <th
                onClick={() => handleSort("public_ip")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Public IP
                  {renderSortArrow("public_ip")}
                </div>
              </th>

              <th
                onClick={() => handleSort("os")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  OS
                  {renderSortArrow("os")}
                </div>
              </th>

              <th
                onClick={() => handleSort("os_version")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Version
                  {renderSortArrow("os_version")}
                </div>
              </th>

              <th
                onClick={() => handleSort("agent_version")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Agent Version
                  {renderSortArrow("agent_version")}
                </div>
              </th>

              <th
                onClick={() => handleSort("status")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Status
                  {renderSortArrow("status")}
                </div>
              </th>

              <th
                onClick={() => handleSort("infected")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Infected
                  {renderSortArrow("infected")}
                </div>
              </th>

              <th
                onClick={() => handleSort("secured_by_kuamini")}
                className="cursor-pointer select-none px-6 py-4 text-center text-sky-200/70 transition hover:text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  Secured by Kuamini
                  {renderSortArrow("secured_by_kuamini")}
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredEndpoints.length > 0 ? (
              filteredEndpoints.map((endpoint) => (
                <tr
                  key={endpoint.id}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="px-6 py-4 text-center">
                    <Link
                      href={`/securityAgent/endpoints/${endpoint.id}`}
                      className="font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline"
                    >
                      {endpoint.hostname}
                    </Link>
                  </td>

                  <td className="px-6 py-4 text-center text-slate-200">
                    {endpoint.ip_address || "-"}
                  </td>

                  <td className="px-6 py-4 text-center text-slate-200">
                    {endpoint.public_ip || "-"}
                  </td>

                  <td className="px-6 py-4 text-center text-slate-200">
                    {endpoint.os}
                  </td>

                  <td className="px-6 py-4 text-center text-slate-200">
                    {endpoint.os_version}
                  </td>

                  <td className="px-6 py-4 text-center text-slate-200">
                    {endpoint.agent_version}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        endpoint.status === "online"
                          ? "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                          : "bg-orange-500/15 text-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.35)]"
                      }`}
                    >
                      {endpoint.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        endpoint.infected
                          ? "bg-rose-500/15 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
                          : "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                      }`}
                    >
                      {endpoint.infected ? "Yes" : "No"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        endpoint.secured_by_kuamini
                          ? "bg-cyan-500/15 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                          : "bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                      }`}
                    >
                      {endpoint.secured_by_kuamini ? "Yes" : "Action Required"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  No endpoints found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}