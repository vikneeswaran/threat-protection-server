"use client";

import { useEffect, useState } from "react";
import ThreatFilter from "./threatFilters";
import { getThreats } from "@/app/services/threatService";
import Link from "next/link";

interface Threat {
  id: string;
  name: string;
  endpoint: string;
  threatType: string;
  detectedBy: string;
  severity: string;
  detected: string;
  status: string;
}

export default function ThreatTable() {
  // Stores all threats received from the API
  const [threats, setThreats] = useState<Threat[]>([]);

  // Stores threats after applying filters
  const [filteredThreats, setFilteredThreats] = useState<Threat[]>([]);

  // Search/filter states
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  // Loading/error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting
  const [sortColumn, setSortColumn] = useState<keyof Threat | "">("");
  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  // Selected threats
  const [selectedThreatIds, setSelectedThreatIds] = useState<string[]>(
    []
  );

  // Currently opened gear menu
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(
    null
  );

  // Number of threats displayed per page
  const pageSize = 50;

  // Fetch threats once when component loads
  useEffect(() => {
    fetchThreats();
  }, []);

  // Apply filters whenever data/filter/sort changes
  useEffect(() => {
    filterThreats();
  }, [
    search,
    severity,
    status,
    threats,
    sortColumn,
    sortDirection,
  ]);

  // Fetch threat data
  const fetchThreats = async () => {
    try {
      setLoading(true);

      const response = await getThreats();

      const threatsData = (response.threats ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        endpoint: item.hostname,
        threatType: item.type,
        detectedBy: item.detection_engine,

        severity:
          item.severity?.charAt(0).toUpperCase() +
          item.severity?.slice(1).toLowerCase(),

        detected: new Date(item.detected_at).toLocaleString(),

        status:
          item.status?.charAt(0).toUpperCase() +
          item.status?.slice(1).toLowerCase(),
      }));

      setThreats(threatsData);
      setFilteredThreats(threatsData);
    } catch (err) {
      console.error(err);

      setThreats([]);
      setFilteredThreats([]);
      setError("Failed to load threats");
    } finally {
      setLoading(false);
    }
  };

  // Sort threats
  const sortThreats = (
    data: Threat[],
    column: keyof Threat,
    direction: "asc" | "desc"
  ) => {
    return [...data].sort((a, b) => {
      const valueA = String(a[column]).toLowerCase();
      const valueB = String(b[column]).toLowerCase();

      if (valueA < valueB) {
        return direction === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return direction === "asc" ? 1 : -1;
      }

      return 0;
    });
  };

  // Handle column sorting
  const handleSort = (column: keyof Threat) => {
    let direction: "asc" | "desc" = "asc";

    if (sortColumn === column && sortDirection === "asc") {
      direction = "desc";
    }

    setSortColumn(column);
    setSortDirection(direction);
  };

  // Sort icon
  const getSortIcon = (column: keyof Threat) => {
    if (sortColumn !== column) {
      return "↕";
    }

    return sortDirection === "asc" ? "▲" : "▼";
  };

  // Filter threats
  const filterThreats = () => {
    let filtered = [...threats];

    // Search
    if (search) {
      const searchText = search.toLowerCase();

      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchText) ||
          item.endpoint.toLowerCase().includes(searchText) ||
          item.detectedBy.toLowerCase().includes(searchText)
      );
    }

    // Severity
    if (severity) {
      filtered = filtered.filter(
        (item) =>
          item.severity.toLowerCase() === severity.toLowerCase()
      );
    }

    // Status
    if (status) {
      filtered = filtered.filter(
        (item) =>
          item.status.toLowerCase() === status.toLowerCase()
      );
    }

    // Sorting
    if (sortColumn) {
      filtered = sortThreats(
        filtered,
        sortColumn,
        sortDirection
      );
    }

    setFilteredThreats(filtered);
    setCurrentPage(1);
  };

  // Current page data
  const totalPages = Math.ceil(
    filteredThreats.length / pageSize
  );

  const paginatedThreats = filteredThreats.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // --------------------------------------------------
  // CHECKBOX FUNCTIONS
  // --------------------------------------------------

  // Check/uncheck individual threat
  const handleThreatSelection = (threatId: string) => {
    setSelectedThreatIds((previous) => {
      if (previous.includes(threatId)) {
        return previous.filter((id) => id !== threatId);
      }

      return [...previous, threatId];
    });
  };

  // Check/uncheck all threats on current page
  const handleSelectAll = () => {
    const currentPageIds = paginatedThreats.map(
      (threat) => threat.id
    );

    const allSelected = currentPageIds.every((id) =>
      selectedThreatIds.includes(id)
    );

    if (allSelected) {
      setSelectedThreatIds((previous) =>
        previous.filter(
          (id) => !currentPageIds.includes(id)
        )
      );
    } else {
      setSelectedThreatIds((previous) => [
        ...new Set([...previous, ...currentPageIds]),
      ]);
    }
  };

  const allCurrentPageSelected =
    paginatedThreats.length > 0 &&
    paginatedThreats.every((threat) =>
      selectedThreatIds.includes(threat.id)
    );

  // --------------------------------------------------
  // GEAR ACTION FUNCTIONS
  // --------------------------------------------------

  const handleThreatAction = (
    action: string,
    threat: Threat
  ) => {
    setOpenActionMenu(null);

    console.log("Threat Action:", {
      action,
      threatId: threat.id,
    });

    // API calls can be added here later.
    //
    // Example:
    //
    // if (action === "quarantine") {
    //   await quarantineThreat(threat.id);
    // }
  };

  // Export
  const handleExport = () => {
    console.log("Export Incidents");
  };

  // Loading
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center">
        Loading threats...
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">

      {/* Search and filter controls */}
      <ThreatFilter
        search={search}
        severity={severity}
        status={status}
        onSearchChange={setSearch}
        onSeverityChange={setSeverity}
        onStatusChange={setStatus}
        onExport={handleExport}
      />

      {/* Selected count */}
      {selectedThreatIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
          <span className="text-sm text-slate-300">
            {selectedThreatIds.length} threat
            {selectedThreatIds.length !== 1 ? "s" : ""} selected
          </span>

          <div className="flex gap-2">
            <button
              onClick={() =>
                console.log(
                  "Bulk Quarantine:",
                  selectedThreatIds
                )
              }
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Quarantine
            </button>

            <button
              onClick={() =>
                console.log(
                  "Bulk Resolve:",
                  selectedThreatIds
                )
              }
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Resolve
            </button>

            <button
              onClick={() => setSelectedThreatIds([])}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">

        {/* Threat data table */}
        <table className="w-full border-collapse text-left">

          {/* Table headers */}
          <thead className="border-b border-slate-700 text-slate-400">
            <tr>

              {/* SELECT ALL CHECKBOX */}
              <th className="w-[50px] px-3 py-4">
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                  aria-label="Select all threats"
                />
              </th>

              <th
                onClick={() => handleSort("id")}
                className="w-[180px] cursor-pointer select-none px-3"
              >
                Threat ID {getSortIcon("id")}
              </th>

              <th
                onClick={() => handleSort("name")}
                className="w-[220px] cursor-pointer select-none px-3"
              >
                Threat Name {getSortIcon("name")}
              </th>

              <th
                onClick={() => handleSort("endpoint")}
                className="w-[150px] cursor-pointer px-3 py-4"
              >
                Endpoint {getSortIcon("endpoint")}
              </th>

              <th
                onClick={() => handleSort("threatType")}
                className="w-[150px] cursor-pointer px-3 py-4"
              >
                Threat Type {getSortIcon("threatType")}
              </th>

              <th
                onClick={() => handleSort("detectedBy")}
                className="w-[150px] cursor-pointer px-3 py-4"
              >
                Detected By {getSortIcon("detectedBy")}
              </th>

              <th
                onClick={() => handleSort("severity")}
                className="w-[120px] cursor-pointer px-3 py-4"
              >
                Severity {getSortIcon("severity")}
              </th>

              <th
                onClick={() => handleSort("detected")}
                className="w-[180px] cursor-pointer px-3 py-4"
              >
                Detected {getSortIcon("detected")}
              </th>

              <th
                onClick={() => handleSort("status")}
                className="w-[120px] cursor-pointer px-3 py-4"
              >
                Status {getSortIcon("status")}
              </th>

              {/* ACTION HEADER */}
              <th className="w-[70px] px-3 py-4 text-center">
                Action
              </th>

            </tr>
          </thead>

          <tbody>

            {paginatedThreats.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-800 hover:bg-slate-800/30"
              >

                {/* ROW CHECKBOX */}
                <td className="px-3 py-4">
                  <input
                    type="checkbox"
                    checked={selectedThreatIds.includes(t.id)}
                    onChange={() =>
                      handleThreatSelection(t.id)
                    }
                    className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                    aria-label={`Select ${t.name}`}
                  />
                </td>

                {/* THREAT ID */}
                <td className="px-3 py-4">
                  <Link
                    href={`/securityAgent/threats/${t.id}`}
                    className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    {t.id}
                  </Link>
                </td>

                {/* THREAT NAME */}
                <td className="px-3 py-4">
                  {t.name}
                </td>

                {/* ENDPOINT */}
                <td className="px-3 py-4">
                  {t.endpoint}
                </td>

                {/* THREAT TYPE */}
                <td className="px-3 py-4">
                  <span className="inline-flex min-w-[90px] items-center justify-center rounded-full bg-slate-700 px-3 py-1 text-xs">
                    {t.threatType}
                  </span>
                </td>

                {/* DETECTED BY */}
                <td className="px-3 py-4">
                  {t.detectedBy}
                </td>

                {/* SEVERITY */}
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex min-w-[90px] justify-center rounded-full px-3 py-1 text-xs ${
                      t.severity === "Critical"
                        ? "bg-red-900/40 text-red-300"
                        : t.severity === "High"
                        ? "bg-orange-900/40 text-orange-300"
                        : t.severity === "Medium"
                        ? "bg-yellow-900/40 text-yellow-300"
                        : "bg-green-900/40 text-green-300"
                    }`}
                  >
                    {t.severity}
                  </span>
                </td>

                {/* DETECTED */}
                <td className="px-3 py-4">
                  {t.detected}
                </td>

                {/* STATUS */}
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex min-w-[90px] justify-center rounded-full px-3 py-1 text-xs ${
                      t.status === "Resolved"
                        ? "bg-green-900/40 text-green-300"
                        : t.status === "Contained"
                        ? "bg-blue-900/40 text-blue-300"
                        : "bg-yellow-900/40 text-yellow-300"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>

                {/* GEAR ACTION */}
                <td className="relative px-3 py-4 text-center">

                  <button
                    type="button"
                    onClick={() =>
                      setOpenActionMenu(
                        openActionMenu === t.id
                          ? null
                          : t.id
                      )
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white"
                    aria-label={`Actions for ${t.name}`}
                    title="Threat actions"
                  >
                    {/* Gear icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.5 3h3l.6 2.1a7.9 7.9 0 0 1 1.8.75l2-1.05 2.1 2.1-1.05 2a7.9 7.9 0 0 1 .75 1.8L21 11.5v3l-2.1.6a7.9 7.9 0 0 1-.75 1.8l1.05 2-2.1 2.1-2-1.05a7.9 7.9 0 0 1-1.8.75L13.5 21h-3l-.6-2.1a7.9 7.9 0 0 1-1.8-.75l-2 1.05-2.1-2.1 1.05-2a7.9 7.9 0 0 1-.75-1.8L2 14.5v-3l2.1-.6a7.9 7.9 0 0 1 .75-1.8l-1.05-2L5.9 5l2 1.05a7.9 7.9 0 0 1 1.8-.75L10.5 3Z"
                      />

                      <circle
                        cx="12"
                        cy="13"
                        r="2.5"
                      />
                    </svg>
                  </button>

                  {/* ACTION DROPDOWN */}
                  {openActionMenu === t.id && (
                    <div className="absolute right-3 top-14 z-50 w-44 overflow-hidden rounded-lg border border-slate-700 bg-[#111827] shadow-xl">

                      {/* View */}
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenu(null);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <span>👁</span>
                        View Details
                      </button>

                      {/* Quarantine */}
                      <button
                        type="button"
                        onClick={() =>
                          handleThreatAction(
                            "quarantine",
                            t
                          )
                        }
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-orange-300 hover:bg-slate-800"
                      >
                        <span>🛡</span>
                        Quarantine
                      </button>

                      {/* Resolve */}
                      <button
                        type="button"
                        onClick={() =>
                          handleThreatAction(
                            "resolve",
                            t
                          )
                        }
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-green-300 hover:bg-slate-800"
                      >
                        <span>✓</span>
                        Resolve
                      </button>

                      {/* Ignore */}
                      <button
                        type="button"
                        onClick={() =>
                          handleThreatAction(
                            "ignore",
                            t
                          )
                        }
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
                      >
                        <span>⊘</span>
                        Ignore
                      </button>

                    </div>
                  )}

                </td>

              </tr>
            ))}

            {/* No records */}
            {paginatedThreats.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="py-10 text-center text-slate-400"
                >
                  No threats found.
                </td>
              </tr>
            )}

          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-between">

          <p className="text-sm text-slate-400">
            Showing{" "}
            {filteredThreats.length === 0
              ? 0
              : (currentPage - 1) * pageSize + 1}
            {" - "}
            {Math.min(
              currentPage * pageSize,
              filteredThreats.length
            )}
            {" of "}
            {filteredThreats.length} threats
          </p>

          <div className="flex gap-2">

            <button
              onClick={() =>
                setCurrentPage((p) =>
                  Math.max(p - 1, 1)
                )
              }
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-50"
            >
              Previous
            </button>

            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              onClick={() =>
                setCurrentPage((p) =>
                  Math.min(p + 1, totalPages)
                )
              }
              disabled={
                currentPage === totalPages ||
                totalPages === 0
              }
              className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-50"
            >
              Next
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}