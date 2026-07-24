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

// Number of threats displayed per page
const pageSize = 50;

 // Fetch threats once when the component loads
  useEffect(() => {
    fetchThreats();
  }, []);

    // Apply filters whenever search, severity, status, or data changes
  useEffect(() => {
    filterThreats();
  }, [search, severity, status, threats]);

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
    (item) =>
      item.severity.toLowerCase() === severity.toLowerCase()
  );
}
 // Filter by status
   if (status) {
  filtered = filtered.filter(
    (item) =>
      item.status.toLowerCase() === status.toLowerCase()
  );
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
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center">
        Loading threats...
      </div>
    );
  }
 // Display error message if API fails
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

      <div className="overflow-x-auto">
         {/* Threat data table */}
        <table className="w-full border-collapse text-left">
 {/* Table headers */}
          <thead className="border-b border-slate-700 text-slate-400">
  <tr>
    <th className="w-[120px] py-4 px-3">Threat ID</th>
    <th className="w-[260px] px-3">Threat Name</th>
    <th className="w-[180px] px-3">Endpoint</th>
    <th className="w-[150px] px-3">Threat Type</th>
    <th className="w-[180px] px-3">Detected By</th>
    <th className="w-[120px] px-3">Severity</th>
    <th className="w-[180px] px-3">Detected</th>
    <th className="w-[140px] px-3">Status</th>
  </tr>
</thead>
          <tbody>
             {/* Display each threat record */}
            {paginatedThreats.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-800 hover:bg-slate-800/30"
              >
               <td className="py-4 px-3">
                {/* Navigate to threat details page */}
  <Link
    href={`/securityAgent/threats/${t.id}`}
    className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
  >
    {t.id}
  </Link>
  {/* Display threat information */}
</td>

                <td className="py-4 px-3">{t.name}</td>

                <td className="py-4 px-3">{t.endpoint}</td>

                <td className="py-4 px-3">
                  <span className="inline-flex min-w-[90px] items-center justify-center rounded-full bg-slate-700 px-3 py-1 text-xs">
                    {t.threatType}
                  </span>
                </td>

                <td className="py-4 px-3">
                  {t.detectedBy}
                </td>

                <td>
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

                <td className="py-4 px-3">{t.detected}</td>

                <td className="py-4 px-3">
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
              </tr>
            ))}
{/* Show message when no records match filters */}
            {paginatedThreats.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-10 text-center text-slate-400"
                >
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
      className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-50"
    >
      Previous
    </button>

    <span className="flex items-center px-3 text-sm">
      Page {currentPage} of {totalPages || 1}
    </span>

    <button
      onClick={() =>
        setCurrentPage((p) => Math.min(p + 1, totalPages))
      }
      disabled={currentPage === totalPages || totalPages === 0}
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