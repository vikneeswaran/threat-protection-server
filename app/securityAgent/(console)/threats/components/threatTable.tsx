"use client";

// React hooks for state management and lifecycle methods
import { useEffect, useState } from "react";

// Threat filter component for search and filtering
import ThreatFilter from "./threatFilters";

// Service function to fetch threats from the backend API
import { getThreats } from "@/app/services/threatService";

// Next.js component for client-side navigation
import Link from "next/link";

// Defines the structure of each threat record
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

// Main component that displays and manages the threat table
export default function ThreatTable() {
  // Stores all threats received from the API
  const [threats, setThreats] = useState<Threat[]>([]);

  // Stores threats after applying search and filters
  const [filteredThreats, setFilteredThreats] = useState<Threat[]>([]);

  // Stores the search keyword
  const [search, setSearch] = useState("");

  // Stores selected severity filter
  const [severity, setSeverity] = useState("");

  // Stores selected status filter
  const [status, setStatus] = useState("");

  // Controls loading spinner while fetching data
  const [loading, setLoading] = useState(true);

  // Stores API error messages
  const [error, setError] = useState("");
  // Tracks the currently displayed page
  const [currentPage, setCurrentPage] = useState(1);

  const [sortColumn, setSortColumn] = useState<keyof Threat | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Number of threats displayed per page
  const pageSize = 50;

  // Fetch threats once when the component loads
  useEffect(() => {
    fetchThreats();
  }, []);

  // Apply filters whenever search, severity, status, or data changes
  useEffect(() => {
    filterThreats();
  }, [search, severity, status, threats, sortColumn, sortDirection]);
  // Fetch threat data from the backend API
  const fetchThreats = async () => {
    try {
      setLoading(true);

      // Request threat data
      const response = await getThreats();

      const threatsData = (response.threats ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        endpoint: item.hostname,
        threatType: item.type,
        detectedBy: item.detection_engine,

        // Format severity for display
        severity:
          item.severity?.charAt(0).toUpperCase() +
          item.severity?.slice(1).toLowerCase(),

        // Convert timestamp into readable format
        detected: new Date(item.detected_at).toLocaleString(),
        // Format status for display
        status:
          item.status?.charAt(0).toUpperCase() +
          item.status?.slice(1).toLowerCase(),
      }));

      // Store original threat list
      setThreats(threatsData);
      // Initially display all threats
      setFilteredThreats(threatsData);
    } catch (err) {
      // Handle API failure
      console.error(err);
      setThreats([]);
      setFilteredThreats([]);
      setError("Failed to load threats");
    } finally {
      // Hide loading spinner
      setLoading(false);
    }
  };

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
  const handleSort = (column: keyof Threat) => {
    let direction: "asc" | "desc" = "asc";

    if (sortColumn === column && sortDirection === "asc") {
      direction = "desc";
    }

    setSortColumn(column);
    setSortDirection(direction);
  };
  const getSortIcon = (column: keyof Threat) => {
    if (sortColumn !== column) {
      return "↕";
    }
    return sortDirection === "asc" ? "▲" : "▼";
  };
  // Filters threats based on search text, severity, and status
  const filterThreats = () => {
    // Create a copy to avoid modifying original data
    let filtered = [...threats];
    // Filter by search keyword
    if (search) {
      const searchText = search.toLowerCase();

      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchText) ||
          item.endpoint.toLowerCase().includes(searchText) ||
          item.detectedBy.toLowerCase().includes(searchText)
      );
    }
    // Filter by severity
    if (severity) {
      filtered = filtered.filter(
        (item) => item.severity.toLowerCase() === severity.toLowerCase()
      );
    }
    // Filter by status
    if (status) {
      filtered = filtered.filter(
        (item) => item.status.toLowerCase() === status.toLowerCase()
      );
    }
    if (sortColumn) {
      filtered = sortThreats(filtered, sortColumn, sortDirection);
    }
    // Update filtered results
    setFilteredThreats(filtered);
    // Reset to first page after filtering
    setCurrentPage(1);
  };
  // Calculate total number of pages
  const totalPages = Math.ceil(filteredThreats.length / pageSize);
  // Display only records for the current page
  const paginatedThreats = filteredThreats.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  // Placeholder for export functionality
  const handleExport = () => {
    console.log("Export Incidents");
  };

  // Display loading message while fetching threats
  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-purple-400/30 p-10 text-center text-sky-200/80 shadow-[0_0_30px_rgba(120,70,255,0.12)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(30,45,85,0.82), rgba(11,19,46,0.96) 65%, rgba(6,12,30,0.98))",
        }}
      >
        Loading threats...
      </div>
    );
  }
  // Display error message if API fails
  if (error) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-rose-500/40 p-10 text-center text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.15)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(60,15,25,0.82), rgba(30,8,15,0.96) 65%, rgba(15,5,8,0.98))",
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-purple-400/30 p-5 shadow-[0_0_30px_rgba(120,70,255,0.12),inset_0_0_45px_rgba(100,50,255,0.05)] sm:p-6"
      style={{
        background:
          "linear-gradient(145deg, rgba(30,45,85,0.82), rgba(11,19,46,0.96) 65%, rgba(6,12,30,0.98))",
      }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 rounded-bl-full bg-purple-500/10 blur-2xl" />

      {/* Search and filter controls */}
      <div className="relative z-10">
        <ThreatFilter
          search={search}
          severity={severity}
          status={status}
          onSearchChange={setSearch}
          onSeverityChange={setSeverity}
          onStatusChange={setStatus}
          onExport={handleExport}
        />
      </div>

      <div className="relative z-10 overflow-x-auto">
        {/* Threat data table */}
        <table className="w-full border-collapse text-left">
          {/* Table headers */}
          <thead className="border-b border-white/10 text-sky-200/70">
            <tr>
              <th
                onClick={() => handleSort("id")}
                className="w-[260px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Threat id {getSortIcon("id")}
              </th>
              <th
                onClick={() => handleSort("name")}
                className="w-[260px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Threat Name {getSortIcon("name")}
              </th>
              <th
                onClick={() => handleSort("endpoint")}
                className="w-[120px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Endpoint {getSortIcon("endpoint")}
              </th>
              <th
                onClick={() => handleSort("threatType")}
                className="w-[120px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Threat Type {getSortIcon("threatType")}
              </th>
              <th
                onClick={() => handleSort("detectedBy")}
                className="w-[120px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Detected By {getSortIcon("detectedBy")}
              </th>
              <th
                onClick={() => handleSort("severity")}
                className="w-[120px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Severity {getSortIcon("severity")}
              </th>
              <th
                onClick={() => handleSort("detected")}
                className="w-[120px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Detected {getSortIcon("detected")}
              </th>
              <th
                onClick={() => handleSort("status")}
                className="w-[120px] cursor-pointer select-none px-3 py-4 transition hover:text-white"
              >
                Status {getSortIcon("status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Display each threat record */}
            {paginatedThreats.map((t) => (
              <tr
                key={t.id}
                className="border-b border-white/5 transition hover:bg-white/5"
              >
                <td className="px-3 py-4">
                  {/* Navigate to threat details page */}
                  <Link
                    href={`/securityAgent/threats/${t.id}`}
                    className="font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline"
                  >
                    {t.id}
                  </Link>
                  {/* Display threat information */}
                </td>

                <td className="px-3 py-4 text-slate-200">{t.name}</td>

                <td className="px-3 py-4 text-slate-200">{t.endpoint}</td>

                <td className="px-3 py-4">
                  <span className="inline-flex min-w-[90px] items-center justify-center rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                    {t.threatType}
                  </span>
                </td>

                <td className="px-3 py-4 text-slate-200">{t.detectedBy}</td>

                <td className="px-3 py-4">
                  <span
                    className={`inline-flex min-w-[90px] justify-center rounded-full px-3 py-1 text-xs font-medium ${
                      t.severity === "Critical"
                        ? "bg-rose-500/15 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
                        : t.severity === "High"
                          ? "bg-orange-500/15 text-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.35)]"
                          : t.severity === "Medium"
                            ? "bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                            : "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                    }`}
                  >
                    {t.severity}
                  </span>
                </td>

                <td className="px-3 py-4 text-slate-200">{t.detected}</td>

                <td className="px-3 py-4">
                  <span
                    className={`inline-flex min-w-[90px] justify-center rounded-full px-3 py-1 text-xs font-medium ${
                      t.status === "Resolved"
                        ? "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                        : t.status === "Contained"
                          ? "bg-blue-500/15 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.35)]"
                          : "bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {/* Show message when no records match filters */}
            {paginatedThreats.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  No threats found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Pagination controls */}
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing{" "}
            {filteredThreats.length === 0
              ? 0
              : (currentPage - 1) * pageSize + 1}
            {" - "}
            {Math.min(currentPage * pageSize, filteredThreats.length)}
            {" of "}
            {filteredThreats.length} threats
          </p>

          {/* Previous / Next page buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-white/10 px-4 py-2 text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="flex items-center px-3 text-sm text-slate-300">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className="rounded-lg border border-white/10 px-4 py-2 text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}