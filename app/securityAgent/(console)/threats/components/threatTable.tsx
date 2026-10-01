// "use client";

// import { useEffect, useState } from "react";
// import ThreatFilter from "./threatFilters";
// import { getThreats } from "@/app/services/threatService";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// interface Threat {
//   id: string;
//   name: string;
//   endpoint: string;
//   threatType: string;
//   detectedBy: string;
//   severity: string;
//   detected: string;
//   detectedAt: string; // raw ISO timestamp, used for CSV export
//   status: string;

//   latestAction?: string | null;
//   latestActionStatus?: string | null;
//   latestActionError?: string | null;
// }

// // Shared classes so every header cell has identical padding/alignment
// const thBase = "cursor-pointer select-none whitespace-nowrap px-2 py-3";

// // Shared classes for text cells: one line, cut off with "..." if too long
// const tdText = "truncate px-2 py-2.5";

// // Show only the first part of a long UUID (full ID is shown on hover)
// const shortId = (id: string) =>
//   id.length > 8 ? `${id.slice(0, 8)}…` : id;

// /*
//  * The actual database threat status remains unchanged.
//  *
//  * Example:
//  *   threat.status = detected
//  *   latest action = quarantine
//  *   latest action status = failed
//  *
//  * The UI displays "Quarantine Failed".
//  */
// const getDisplayStatus = (t: Threat) => {
//   const latestAction = (t.latestAction || "").toLowerCase();
//   const latestActionStatus = (
//     t.latestActionStatus || ""
//   ).toLowerCase();

//   return latestActionStatus === "failed" && latestAction
//     ? `${latestAction.charAt(0).toUpperCase()}${latestAction.slice(1)} Failed`
//     : t.status;
// };

// // Escape one value for CSV
// const csvCell = (value: unknown) => {
//   let text = value === null || value === undefined ? "" : String(value);

//   // Prevent spreadsheet formula injection (=, +, -, @, tab, CR)
//   if (/^[=+\-@\t\r]/.test(text)) {
//     text = `'${text}`;
//   }

//   return `"${text.replace(/"/g, '""')}"`;
// };

// export default function ThreatTable() {
//   const router = useRouter();

//   // Stores all threats received from the API
//   const [threats, setThreats] = useState<Threat[]>([]);

//   // Stores threats after applying filters
//   const [filteredThreats, setFilteredThreats] = useState<Threat[]>([]);

//   // Search/filter states
//   const [search, setSearch] = useState("");
//   const [severity, setSeverity] = useState("");
//   const [status, setStatus] = useState("");

//   // Loading/error states
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // Pagination
//   const [currentPage, setCurrentPage] = useState(1);

//   // Sorting
//   const [sortColumn, setSortColumn] =
//     useState<keyof Threat | "">("");
//   const [sortDirection, setSortDirection] =
//     useState<"asc" | "desc">("asc");

//   // Selected threats
//   const [selectedThreatIds, setSelectedThreatIds] =
//     useState<string[]>([]);

//   // Currently opened gear menu
//   const [openActionMenu, setOpenActionMenu] =
//     useState<string | null>(null);

//   // Number of threats displayed per page
//   const pageSize = 10;

//   // Fetch threats once when component loads
//   useEffect(() => {
//     fetchThreats();
//   }, []);

//   // Apply filters whenever data/filter/sort changes
//   useEffect(() => {
//     filterThreats();
//   }, [
//     search,
//     severity,
//     status,
//     threats,
//     sortColumn,
//     sortDirection,
//   ]);

//   // Fetch threat data
//   const fetchThreats = async () => {
//     try {
//       setLoading(true);

//       const response = await getThreats();

//       const threatsData = (response.threats ?? []).map(
//         (item: any) => ({
//           id: item.id,
//           name: item.name,
//           endpoint: item.hostname,
//           threatType: item.type,
//           detectedBy: item.detection_engine,

//           severity:
//             item.severity?.charAt(0).toUpperCase() +
//             item.severity?.slice(1).toLowerCase(),

//           detected: new Date(
//             item.detected_at
//           ).toLocaleString(),

//           // Raw timestamp for CSV export
//           detectedAt: item.detected_at ?? "",

//           status:
//             item.status?.charAt(0).toUpperCase() +
//             item.status?.slice(1).toLowerCase(),

//           // Latest threat-action information
//           latestAction: item.latest_action,
//           latestActionStatus:
//             item.latest_action_status,
//           latestActionError:
//             item.latest_action_error,
//         })
//       );

//       setThreats(threatsData);
//       setFilteredThreats(threatsData);
//     } catch (err) {
//       console.error(err);

//       setThreats([]);
//       setFilteredThreats([]);
//       setError("Failed to load threats");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Sort threats
//   const sortThreats = (
//     data: Threat[],
//     column: keyof Threat,
//     direction: "asc" | "desc"
//   ) => {
//     return [...data].sort((a, b) => {
//       const valueA = String(a[column]).toLowerCase();
//       const valueB = String(b[column]).toLowerCase();

//       if (valueA < valueB) {
//         return direction === "asc" ? -1 : 1;
//       }

//       if (valueA > valueB) {
//         return direction === "asc" ? 1 : -1;
//       }

//       return 0;
//     });
//   };

//   // Handle column sorting
//   const handleSort = (column: keyof Threat) => {
//     let direction: "asc" | "desc" = "asc";

//     if (
//       sortColumn === column &&
//       sortDirection === "asc"
//     ) {
//       direction = "desc";
//     }

//     setSortColumn(column);
//     setSortDirection(direction);
//   };

//   // Sort icon
//   const getSortIcon = (column: keyof Threat) => {
//     if (sortColumn !== column) {
//       return "↕";
//     }

//     return sortDirection === "asc" ? "▲" : "▼";
//   };

//   // Filter threats
//   const filterThreats = () => {
//     let filtered = [...threats];

//     // Search
//     if (search) {
//       const searchText = search.toLowerCase();

//       filtered = filtered.filter(
//         (item) =>
//           (item.name || "")
//             .toLowerCase()
//             .includes(searchText) ||
//           (item.endpoint || "")
//             .toLowerCase()
//             .includes(searchText) ||
//           (item.threatType || "")
//             .toLowerCase()
//             .includes(searchText) ||
//           (item.detectedBy || "")
//             .toLowerCase()
//             .includes(searchText)
//       );
//     }

//     // Severity
//     if (severity) {
//       filtered = filtered.filter(
//         (item) =>
//           (item.severity || "").toLowerCase() ===
//           severity.toLowerCase()
//       );
//     }

//     // Status (matches what the user sees, e.g. "quarantine failed")
//     if (status) {
//       filtered = filtered.filter(
//         (item) =>
//           getDisplayStatus(item).toLowerCase() ===
//           status.toLowerCase()
//       );
//     }

//     // Sorting
//     if (sortColumn) {
//       filtered = sortThreats(
//         filtered,
//         sortColumn,
//         sortDirection
//       );
//     }

//     setFilteredThreats(filtered);
//     setCurrentPage(1);
//   };

//   // Current page data
//   const totalPages = Math.ceil(
//     filteredThreats.length / pageSize
//   );

//   const paginatedThreats =
//     filteredThreats.slice(
//       (currentPage - 1) * pageSize,
//       currentPage * pageSize
//     );

//   // --------------------------------------------------
//   // CHECKBOX FUNCTIONS
//   // --------------------------------------------------

//   // Check/uncheck individual threat
//   const handleThreatSelection = (
//     threatId: string
//   ) => {
//     setSelectedThreatIds((previous) => {
//       if (previous.includes(threatId)) {
//         return previous.filter(
//           (id) => id !== threatId
//         );
//       }

//       return [...previous, threatId];
//     });
//   };

//   // --------------------------------------------------
//   // GEAR ACTION FUNCTIONS
//   // --------------------------------------------------

//   const handleThreatAction = async (
//     action: string,
//     threat: Threat
//   ) => {
//     setOpenActionMenu(null);

//     console.log("Threat Action:", {
//       action,
//       threatId: threat.id,
//     });

//     const supportedActions = [
//       "quarantine",
//       "kill",
//       "block",
//       "allow",
//       "delete",
//     ];

//     if (!supportedActions.includes(action)) {
//       return;
//     }

//     try {
//       const response = await fetch(
//         "/api/securityagent/agent/threat-action-commands",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           credentials: "include",
//           body: JSON.stringify({
//             threat_id: threat.id,
//             action,
//           }),
//         }
//       );

//       const responseText = await response.text();

//       let data: any = {};

//       if (responseText.trim()) {
//         try {
//           data = JSON.parse(responseText);
//         } catch (parseError) {
//           console.error(
//             `${action} command returned invalid JSON:`,
//             parseError,
//             responseText
//           );

//           data = {
//             error: `Server returned an invalid response (${response.status}).`,
//           };
//         }
//       }

//       if (!response.ok) {
//         console.error(`${action} command failed:`, {
//           status: response.status,
//           statusText: response.statusText,
//           data,
//         });

//         alert(
//           data.error ||
//             data.message ||
//             `Failed to create ${action} command.`
//         );

//         return;
//       }

//       console.log(`${action} command created:`, data);

//       const actionLabel =
//         action.charAt(0).toUpperCase() +
//         action.slice(1);

//       alert(
//         `${actionLabel} command sent to the endpoint.`
//       );
//     } catch (error) {
//       console.error(`${action} request failed:`, error);

//       alert(`Failed to send ${action} command.`);
//     }
//   };

//   // --------------------------------------------------
//   // CSV EXPORT
//   // --------------------------------------------------

//   // Export selected threats, or all filtered threats if none selected
//   const handleExport = () => {
//     const rowsToExport =
//       selectedThreatIds.length > 0
//         ? filteredThreats.filter((t) =>
//             selectedThreatIds.includes(t.id)
//           )
//         : filteredThreats;

//     if (rowsToExport.length === 0) {
//       alert("There are no threats to export.");
//       return;
//     }

//     const headers = [
//       "Threat ID",
//       "Threat Name",
//       "Endpoint",
//       "Threat Type",
//       "Detected By",
//       "Severity",
//       "Detected At",
//       "Status",
//       "Last Action Error",
//     ];

//     const rows = rowsToExport.map((t) => [
//       t.id,
//       t.name,
//       t.endpoint,
//       t.threatType,
//       t.detectedBy,
//       t.severity,
//       t.detectedAt,
//       getDisplayStatus(t),
//       t.latestActionError ?? "",
//     ]);

//     const csv = [headers, ...rows]
//       .map((row) => row.map(csvCell).join(","))
//       .join("\r\n");

//     // BOM makes Excel read the file as UTF-8
//     const blob = new Blob(["\uFEFF" + csv], {
//       type: "text/csv;charset=utf-8;",
//     });

//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");

//     link.href = url;
//     link.download = `threats-${new Date()
//       .toISOString()
//       .slice(0, 10)}.csv`;

//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);

//     URL.revokeObjectURL(url);
//   };

//   // Loading
//   if (loading) {
//     return (
//       <div
//         className="relative overflow-hidden rounded-2xl border border-purple-400/30 p-10 text-center text-sky-200/80 shadow-[0_0_30px_rgba(120,70,255,0.12)]"
//         style={{
//           background:
//             "linear-gradient(145deg, rgba(30,45,85,0.82), rgba(11,19,46,0.96) 65%, rgba(6,12,30,0.98))",
//         }}
//       >
//         Loading threats...
//       </div>
//     );
//   }

//   // Error
//   if (error) {
//     return (
//       <div
//         className="relative overflow-hidden rounded-2xl border border-rose-500/40 p-10 text-center text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.15)]"
//         style={{
//           background:
//             "linear-gradient(145deg, rgba(60,15,25,0.82), rgba(30,8,15,0.96) 65%, rgba(15,5,8,0.98))",
//         }}
//       >
//         {error}
//       </div>
//     );
//   }

//   return (
//     <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">

//       {/* Search and filter controls */}
//       <ThreatFilter
//         search={search}
//         severity={severity}
//         status={status}
//         onSearchChange={setSearch}
//         onSeverityChange={setSeverity}
//         onStatusChange={setStatus}
//         onExport={handleExport}
//       />

//       {/* Selected count */}
//       {selectedThreatIds.length > 0 && (
//         <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
//           <span className="text-sm text-slate-300">
//             {selectedThreatIds.length} threat
//             {selectedThreatIds.length !== 1 ? "s" : ""}{" "}
//             selected
//           </span>

//           <div className="flex gap-2">
//             <button
//               onClick={() =>
//                 console.log(
//                   "Bulk Quarantine:",
//                   selectedThreatIds
//                 )
//               }
//               className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
//             >
//               Quarantine
//             </button>

//             <button
//               onClick={() =>
//                 console.log(
//                   "Bulk Resolve:",
//                   selectedThreatIds
//                 )
//               }
//               className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
//             >
//               Resolve
//             </button>

//             <button
//               onClick={() => setSelectedThreatIds([])}
//               className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700"
//             >
//               Clear
//             </button>
//           </div>
//         </div>
//       )}

//       <div>

//         {/* Threat data table */}
//         <table className="w-full table-fixed border-collapse text-left text-sm">

//           {/* Table headers */}
//           <thead className="border-b border-slate-700 text-slate-400">
//             <tr>

//               {/* Empty header cell above the row checkboxes */}
//               <th className="w-[4%] px-2 py-3" />

//               <th
//                 onClick={() => handleSort("id")}
//                 className={`${thBase} w-[10%]`}
//               >
//                 Threat ID {getSortIcon("id")}
//               </th>

//               <th
//                 onClick={() => handleSort("name")}
//                 className={`${thBase} w-[12%]`}
//               >
//                 Threat Name {getSortIcon("name")}
//               </th>

//               <th
//                 onClick={() => handleSort("endpoint")}
//                 className={`${thBase} w-[11%]`}
//               >
//                 Endpoint {getSortIcon("endpoint")}
//               </th>

//               <th
//                 onClick={() => handleSort("threatType")}
//                 className={`${thBase} w-[14%]`}
//               >
//                 Threat Type {getSortIcon("threatType")}
//               </th>

//               <th
//                 onClick={() => handleSort("detectedBy")}
//                 className={`${thBase} w-[11%]`}
//               >
//                 Detected By {getSortIcon("detectedBy")}
//               </th>

//               <th
//                 onClick={() => handleSort("severity")}
//                 className={`${thBase} w-[9%]`}
//               >
//                 Severity {getSortIcon("severity")}
//               </th>

//               <th
//                 onClick={() => handleSort("detected")}
//                 className={`${thBase} w-[16%]`}
//               >
//                 Detected {getSortIcon("detected")}
//               </th>

//               <th
//                 onClick={() => handleSort("status")}
//                 className={`${thBase} w-[9%]`}
//               >
//                 Status {getSortIcon("status")}
//               </th>

//               {/* ACTION HEADER */}
//               <th className="w-[4%] whitespace-nowrap px-2 py-3 text-center">
//                 Action
//               </th>

//             </tr>
//           </thead>

//           <tbody>
//             {paginatedThreats.map((t) => {
//               const displayStatus = getDisplayStatus(t);

//               return (
//                 <tr
//                   key={t.id}
//                   className="border-b border-white/5 transition hover:bg-white/5"
//                 >

//                   {/* ROW CHECKBOX */}
//                   <td className="px-2 py-2.5">
//                     <input
//                       type="checkbox"
//                       checked={selectedThreatIds.includes(
//                         t.id
//                       )}
//                       onChange={() =>
//                         handleThreatSelection(t.id)
//                       }
//                       className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
//                       aria-label={`Select ${t.name}`}
//                     />
//                   </td>

//                   {/* THREAT ID */}
//                   <td className="px-2 py-2.5">
//                     <Link
//                       href={`/securityAgent/threats/${t.id}`}
//                       title={t.id}
//                       className="block whitespace-nowrap font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
//                     >
//                       {shortId(t.id)}
//                     </Link>
//                   </td>

//                   {/* THREAT NAME */}
//                   <td className={tdText} title={t.name}>
//                     {t.name}
//                   </td>

//                   {/* ENDPOINT */}
//                   <td className={tdText} title={t.endpoint}>
//                     {t.endpoint}
//                   </td>

//                   {/* THREAT TYPE */}
//                   <td className="px-2 py-2.5">
//                     <span className="inline-flex min-w-[80px] items-center justify-center whitespace-nowrap rounded-full bg-slate-700 px-3 py-1 text-xs">
//                       {t.threatType}
//                     </span>
//                   </td>

//                   {/* DETECTED BY */}
//                   <td className={tdText} title={t.detectedBy}>
//                     {t.detectedBy}
//                   </td>

//                   {/* SEVERITY */}
//                   <td className="px-2 py-2.5">
//                     <span
//                       className={`inline-flex min-w-[80px] justify-center rounded-full px-3 py-1 text-xs font-medium ${
//                         t.severity === "Critical"
//                           ? "bg-rose-500/15 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
//                           : t.severity === "High"
//                             ? "bg-orange-500/15 text-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.35)]"
//                             : t.severity === "Medium"
//                               ? "bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
//                               : "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
//                       }`}
//                     >
//                       {t.severity}
//                     </span>
//                   </td>

//                   {/* DETECTED */}
//                   <td className="whitespace-nowrap px-2 py-2.5">
//                     {t.detected}
//                   </td>

//                   {/* STATUS */}
//                   <td className="px-2 py-2.5">
//                     <span
//                       className={`inline-flex min-w-[80px] justify-center rounded-full px-3 py-1 text-xs font-medium ${
//                         displayStatus.endsWith("Failed")
//                           ? "bg-red-500/15 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.35)]"
//                           : displayStatus === "Resolved"
//                             ? "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
//                             : displayStatus === "Contained"
//                               ? "bg-blue-500/15 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.35)]"
//                               : "bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
//                       }`}
//                       title={
//                         displayStatus.endsWith("Failed")
//                           ? t.latestActionError ||
//                             displayStatus
//                           : undefined
//                       }
//                     >
//                       {displayStatus}
//                     </span>
//                   </td>

//                   {/* GEAR ACTION */}
//                   <td className="relative px-2 py-2.5 text-center">

//                     <button
//                       type="button"
//                       onClick={() =>
//                         setOpenActionMenu(
//                           openActionMenu === t.id
//                             ? null
//                             : t.id
//                         )
//                       }
//                       className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white"
//                       aria-label={`Actions for ${t.name}`}
//                       title="Threat actions"
//                     >
//                       {/* Gear icon */}
//                       <svg
//                         xmlns="http://www.w3.org/2000/svg"
//                         viewBox="0 0 24 24"
//                         fill="none"
//                         stroke="currentColor"
//                         strokeWidth="1.8"
//                         className="h-5 w-5"
//                       >
//                         <path
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                           d="M10.5 3h3l.6 2.1a7.9 7.9 0 0 1 1.8.75l2-1.05 2.1 2.1-1.05 2a7.9 7.9 0 0 1 .75 1.8L21 11.5v3l-2.1.6a7.9 7.9 0 0 1-.75 1.8l1.05 2-2.1 2.1-2-1.05a7.9 7.9 0 0 1-1.8.75L13.5 21h-3l-.6-2.1a7.9 7.9 0 0 1-1.8-.75l-2 1.05-2.1-2.1 1.05-2a7.9 7.9 0 0 1-.75-1.8L2 14.5v-3l2.1-.6a7.9 7.9 0 0 1 .75-1.8l-1.05-2L5.9 5l2 1.05a7.9 7.9 0 0 1 1.8-.75L10.5 3Z"
//                         />

//                         <circle cx="12" cy="13" r="2.5" />
//                       </svg>
//                     </button>

//                     {/* ACTION DROPDOWN */}
//                     {openActionMenu === t.id && (
//                       <div className="absolute right-3 top-14 z-50 w-44 overflow-hidden rounded-lg border border-slate-700 bg-[#111827] shadow-xl">

//                         {/* View */}
//                         <button
//                           type="button"
//                           onClick={() => {
//                             setOpenActionMenu(null);
//                             router.push(
//                               `/securityAgent/threats/${t.id}`
//                             );
//                           }}
//                           className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
//                         >
//                           <span>👁</span>
//                           View Details
//                         </button>

//                         {/* Quarantine */}
//                         <button
//                           type="button"
//                           onClick={() =>
//                             handleThreatAction("quarantine", t)
//                           }
//                           className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-orange-300 hover:bg-slate-800"
//                         >
//                           <span>🛡</span>
//                           Quarantine
//                         </button>

//                         {/* Kill */}
//                         <button
//                           type="button"
//                           onClick={() =>
//                             handleThreatAction("kill", t)
//                           }
//                           className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-slate-800"
//                         >
//                           <span>⚡</span>
//                           Kill
//                         </button>

//                         {/* Delete */}
//                         <button
//                           type="button"
//                           onClick={() =>
//                             handleThreatAction("delete", t)
//                           }
//                           className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-800"
//                         >
//                           <span>🗑</span>
//                           Delete
//                         </button>

//                         {/* Block */}
//                         <button
//                           type="button"
//                           onClick={() =>
//                             handleThreatAction("block", t)
//                           }
//                           className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-slate-800"
//                         >
//                           <span>🚫</span>
//                           Block
//                         </button>

//                         {/* Allow */}
//                         <button
//                           type="button"
//                           onClick={() =>
//                             handleThreatAction("allow", t)
//                           }
//                           className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-green-300 hover:bg-slate-800"
//                         >
//                           <span>✓</span>
//                           Allow
//                         </button>

//                       </div>
//                     )}

//                   </td>

//                 </tr>
//               );
//             })}

//             {/* No records */}
//             {paginatedThreats.length === 0 && (
//               <tr>
//                 <td
//                   colSpan={10}
//                   className="py-10 text-center text-slate-400"
//                 >
//                   No threats found.
//                 </td>
//               </tr>
//             )}

//           </tbody>
//         </table>

//         {/* Pagination */}
//         <div className="mt-4 flex items-center justify-between">

//           <p className="text-sm text-slate-400">
//             Showing{" "}
//             {filteredThreats.length === 0
//               ? 0
//               : (currentPage - 1) * pageSize + 1}
//             {" - "}
//             {Math.min(
//               currentPage * pageSize,
//               filteredThreats.length
//             )}
//             {" of "}
//             {filteredThreats.length} threats
//           </p>

//           <div className="flex gap-2">

//             <button
//               onClick={() =>
//                 setCurrentPage((p) => Math.max(p - 1, 1))
//               }
//               disabled={currentPage === 1}
//               className="rounded-lg border border-slate-700 px-4 py-1.5 disabled:opacity-50"
//             >
//               Previous
//             </button>

//             <span className="flex items-center px-3 text-sm">
//               Page {currentPage} of {totalPages || 1}
//             </span>

//             <button
//               onClick={() =>
//                 setCurrentPage((p) =>
//                   Math.min(p + 1, totalPages)
//                 )
//               }
//               disabled={
//                 currentPage === totalPages ||
//                 totalPages === 0
//               }
//               className="rounded-lg border border-slate-700 px-4 py-1.5 disabled:opacity-50"
//             >
//               Next
//             </button>

//           </div>
//         </div>

//       </div>
//     </div>
//   );
// }






"use client";

import { useEffect, useState } from "react";
import ThreatFilter from "./threatFilters";
import { getThreats } from "@/app/services/threatService";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Threat {
  id: string;
  name: string;
  endpoint: string;
  threatType: string;
  detectedBy: string;
  severity: string;
  detected: string;
  detectedAt: string;
  status: string;

  latestAction?: string | null;
  latestActionStatus?: string | null;
  latestActionError?: string | null;
}

const thBase =
  "cursor-pointer select-none whitespace-nowrap px-2 py-3";

const tdText = "truncate px-2 py-2.5";

const shortId = (id: string) =>
  id.length > 8 ? `${id.slice(0, 8)}…` : id;

/*
 * Display the latest action failure without changing
 * the actual threat.status value.
 */
const getDisplayStatus = (t: Threat) => {
  const latestAction = (t.latestAction || "").toLowerCase();

  const latestActionStatus = (
    t.latestActionStatus || ""
  ).toLowerCase();

  return latestActionStatus === "failed" && latestAction
    ? `${latestAction.charAt(0).toUpperCase()}${latestAction.slice(
        1
      )} Failed`
    : t.status;
};

// Escape one value for CSV
const csvCell = (value: unknown) => {
  let text =
    value === null || value === undefined
      ? ""
      : String(value);

  // Prevent spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

export default function ThreatTable() {
  const router = useRouter();

  // --------------------------------------------------
  // THREATS
  // --------------------------------------------------

  const [threats, setThreats] = useState<Threat[]>([]);
  const [filteredThreats, setFilteredThreats] =
    useState<Threat[]>([]);

  // --------------------------------------------------
  // FILTERS
  // --------------------------------------------------

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  // --------------------------------------------------
  // LOADING / ERROR
  // --------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  const [currentPage, setCurrentPage] = useState(1);

  // --------------------------------------------------
  // SORTING
  // --------------------------------------------------

  const [sortColumn, setSortColumn] =
    useState<keyof Threat | "">("");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  // --------------------------------------------------
  // SELECTION
  // --------------------------------------------------

  const [selectedThreatIds, setSelectedThreatIds] =
    useState<string[]>([]);

  // --------------------------------------------------
  // ACTION MENU
  // --------------------------------------------------

  const [openActionMenu, setOpenActionMenu] =
    useState<string | null>(null);

  // --------------------------------------------------
  // BULK ACTION STATE
  // --------------------------------------------------

  const [bulkActionLoading, setBulkActionLoading] =
    useState(false);

  const [bulkActionError, setBulkActionError] =
    useState("");

  // Number of threats displayed per page
  const pageSize = 10;

  // --------------------------------------------------
  // INITIAL FETCH
  // --------------------------------------------------

  useEffect(() => {
    fetchThreats();
  }, []);

  // --------------------------------------------------
  // FILTER / SORT
  // --------------------------------------------------

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

  // --------------------------------------------------
  // FETCH THREATS
  // --------------------------------------------------

  const fetchThreats = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getThreats();

      const threatsData = (response.threats ?? []).map(
        (item: any) => ({
          id: item.id,
          name: item.name,
          endpoint: item.hostname,
          threatType: item.type,
          detectedBy: item.detection_engine,

          severity:
            item.severity?.charAt(0).toUpperCase() +
            item.severity?.slice(1).toLowerCase(),

          detected: new Date(
            item.detected_at
          ).toLocaleString(),

          detectedAt: item.detected_at ?? "",

          status:
            item.status?.charAt(0).toUpperCase() +
            item.status?.slice(1).toLowerCase(),

          latestAction: item.latest_action,

          latestActionStatus:
            item.latest_action_status,

          latestActionError:
            item.latest_action_error,
        })
      );

      setThreats(threatsData);
      setFilteredThreats(threatsData);
    } catch (err) {
      console.error(
        "[ThreatTable] Failed to load threats:",
        err
      );

      setThreats([]);
      setFilteredThreats([]);
      setError("Failed to load threats");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // SORT
  // --------------------------------------------------

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

  // --------------------------------------------------
  // SORT HANDLER
  // --------------------------------------------------

  const handleSort = (column: keyof Threat) => {
    let direction: "asc" | "desc" = "asc";

    if (
      sortColumn === column &&
      sortDirection === "asc"
    ) {
      direction = "desc";
    }

    setSortColumn(column);
    setSortDirection(direction);
  };

  // --------------------------------------------------
  // SORT ICON
  // --------------------------------------------------

  const getSortIcon = (column: keyof Threat) => {
    if (sortColumn !== column) {
      return "↕";
    }

    return sortDirection === "asc" ? "▲" : "▼";
  };

  // --------------------------------------------------
  // FILTER
  // --------------------------------------------------

  const filterThreats = () => {
    let filtered = [...threats];

    // Search
    if (search) {
      const searchText = search.toLowerCase();

      filtered = filtered.filter(
        (item) =>
          (item.name || "")
            .toLowerCase()
            .includes(searchText) ||
          (item.endpoint || "")
            .toLowerCase()
            .includes(searchText) ||
          (item.threatType || "")
            .toLowerCase()
            .includes(searchText) ||
          (item.detectedBy || "")
            .toLowerCase()
            .includes(searchText)
      );
    }

    // Severity
    if (severity) {
      filtered = filtered.filter(
        (item) =>
          (item.severity || "").toLowerCase() ===
          severity.toLowerCase()
      );
    }

    // Status
    if (status) {
      filtered = filtered.filter(
        (item) =>
          getDisplayStatus(item).toLowerCase() ===
          status.toLowerCase()
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
  };

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  const totalPages = Math.ceil(
    filteredThreats.length / pageSize
  );

  const paginatedThreats =
    filteredThreats.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  // --------------------------------------------------
  // CHECKBOX
  // --------------------------------------------------

  const handleThreatSelection = (
    threatId: string
  ) => {
    setSelectedThreatIds((previous) => {
      if (previous.includes(threatId)) {
        return previous.filter(
          (id) => id !== threatId
        );
      }

      return [...previous, threatId];
    });

    setBulkActionError("");
  };

  // --------------------------------------------------
  // INDIVIDUAL THREAT ACTION
  // --------------------------------------------------

  const handleThreatAction = async (
    action: string,
    threat: Threat
  ) => {
    setOpenActionMenu(null);

    console.log("[Threat Action] clicked:", {
      action,
      threatId: threat.id,
    });

    const supportedActions = [
      "quarantine",
      "kill",
      "block",
      "allow",
      "delete",
    ];

    if (!supportedActions.includes(action)) {
      console.error(
        "[Threat Action] Unsupported action:",
        action
      );
      return;
    }

    try {
      const response = await fetch(
        "/api/securityagent/agent/threat-action-commands",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            threat_id: threat.id,
            action,
          }),
        }
      );

      const responseText = await response.text();

      let data: any = {};

      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(
            `[Threat Action] ${action} returned invalid JSON:`,
            parseError,
            responseText
          );

          data = {
            error: `Server returned an invalid response (${response.status}).`,
          };
        }
      }

      if (!response.ok) {
        console.error(
          `[Threat Action] ${action} failed:`,
          {
            status: response.status,
            statusText: response.statusText,
            data,
          }
        );

        alert(
          data.error ||
            data.message ||
            `Failed to create ${action} command.`
        );

        return;
      }

      console.log(
        `[Threat Action] ${action} command created:`,
        data
      );

      const actionLabel =
        action.charAt(0).toUpperCase() +
        action.slice(1);

      alert(
        `${actionLabel} command sent to the endpoint.`
      );

      // Refresh the table so latest action information is visible
      await fetchThreats();
    } catch (error) {
      console.error(
        `[Threat Action] ${action} request failed:`,
        error
      );

      alert(
        `Failed to send ${action} command.`
      );
    }
  };

  // --------------------------------------------------
  // BULK QUARANTINE
  // --------------------------------------------------

  const handleBulkQuarantine = async () => {
    if (
      bulkActionLoading ||
      selectedThreatIds.length === 0
    ) {
      return;
    }

    console.log(
      "[Bulk Quarantine] clicked:",
      selectedThreatIds
    );

    setBulkActionLoading(true);
    setBulkActionError("");

    const ids = [...selectedThreatIds];

    let successCount = 0;
    let failedCount = 0;

    try {
      for (const threatId of ids) {
        try {
          console.log(
            "[Bulk Quarantine] Sending command:",
            threatId
          );

          const response = await fetch(
            "/api/securityagent/agent/threat-action-commands",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                threat_id: threatId,
                action: "quarantine",
              }),
            }
          );

          const responseText =
            await response.text();

          let data: any = {};

          if (responseText.trim()) {
            try {
              data = JSON.parse(responseText);
            } catch {
              data = {
                error: responseText,
              };
            }
          }

          if (!response.ok) {
            console.error(
              "[Bulk Quarantine] Failed:",
              {
                threatId,
                status: response.status,
                data,
              }
            );

            failedCount++;
            continue;
          }

          console.log(
            "[Bulk Quarantine] Command created:",
            {
              threatId,
              data,
            }
          );

          successCount++;
        } catch (error) {
          console.error(
            "[Bulk Quarantine] Request failed:",
            {
              threatId,
              error,
            }
          );

          failedCount++;
        }
      }

      console.log(
        "[Bulk Quarantine] Completed:",
        {
          successCount,
          failedCount,
          total: ids.length,
        }
      );

      // Clear selection
      setSelectedThreatIds([]);

      // Refresh from database
      await fetchThreats();

      if (failedCount === 0) {
        alert(
          `Quarantine command sent for ${successCount} threat${
            successCount !== 1 ? "s" : ""
          }.`
        );
      } else {
        alert(
          `Quarantine completed: ${successCount} succeeded, ${failedCount} failed.`
        );
      }
    } catch (error) {
      console.error(
        "[Bulk Quarantine] Unexpected error:",
        error
      );

      setBulkActionError(
        "Failed to process bulk quarantine."
      );
    } finally {
      setBulkActionLoading(false);
    }
  };

  // --------------------------------------------------
  // BULK RESOLVE
  // --------------------------------------------------

  const handleBulkResolve = async () => {
    if (
      bulkActionLoading ||
      selectedThreatIds.length === 0
    ) {
      return;
    }

    console.log(
      "[Bulk Resolve] clicked:",
      selectedThreatIds
    );

    setBulkActionLoading(true);
    setBulkActionError("");

    const ids = [...selectedThreatIds];

    let successCount = 0;
    let failedCount = 0;

    try {
      for (const threatId of ids) {
        try {
          console.log(
            "[Bulk Resolve] Updating threat:",
            threatId
          );

          const response = await fetch(
            `/api/securityagent/agent/threat/${encodeURIComponent(
              threatId
            )}/status`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                status: "resolved",
              }),
            }
          );

          const responseText =
            await response.text();

          let data: any = {};

          if (responseText.trim()) {
            try {
              data = JSON.parse(responseText);
            } catch {
              data = {
                error: responseText,
              };
            }
          }

          if (!response.ok) {
            console.error(
              "[Bulk Resolve] Failed:",
              {
                threatId,
                status: response.status,
                data,
              }
            );

            failedCount++;
            continue;
          }

          console.log(
            "[Bulk Resolve] Threat resolved:",
            {
              threatId,
              data,
            }
          );

          successCount++;
        } catch (error) {
          console.error(
            "[Bulk Resolve] Request failed:",
            {
              threatId,
              error,
            }
          );

          failedCount++;
        }
      }

      console.log(
        "[Bulk Resolve] Completed:",
        {
          successCount,
          failedCount,
          total: ids.length,
        }
      );

      // Clear selection
      setSelectedThreatIds([]);

      // Refresh from database
      await fetchThreats();

      if (failedCount === 0) {
        alert(
          `${successCount} threat${
            successCount !== 1 ? "s" : ""
          } resolved successfully.`
        );
      } else {
        alert(
          `Resolve completed: ${successCount} succeeded, ${failedCount} failed.`
        );
      }
    } catch (error) {
      console.error(
        "[Bulk Resolve] Unexpected error:",
        error
      );

      setBulkActionError(
        "Failed to process bulk resolve."
      );
    } finally {
      setBulkActionLoading(false);
    }
  };

  // --------------------------------------------------
  // CSV EXPORT
  // --------------------------------------------------

  const handleExport = () => {
    const rowsToExport =
      selectedThreatIds.length > 0
        ? filteredThreats.filter((t) =>
            selectedThreatIds.includes(t.id)
          )
        : filteredThreats;

    if (rowsToExport.length === 0) {
      alert("There are no threats to export.");
      return;
    }

    const headers = [
      "Threat ID",
      "Threat Name",
      "Endpoint",
      "Threat Type",
      "Detected By",
      "Severity",
      "Detected At",
      "Status",
      "Last Action Error",
    ];

    const rows = rowsToExport.map((t) => [
      t.id,
      t.name,
      t.endpoint,
      t.threatType,
      t.detectedBy,
      t.severity,
      t.detectedAt,
      getDisplayStatus(t),
      t.latestActionError ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map(csvCell).join(",")
      )
      .join("\r\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `threats-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

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

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

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

  // --------------------------------------------------
  // TABLE
  // --------------------------------------------------

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">

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

      {/* Bulk action error */}
      {bulkActionError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {bulkActionError}
        </div>
      )}

      {/* Selected count / bulk actions */}
      {selectedThreatIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">

          <span className="text-sm text-slate-300">
            {selectedThreatIds.length} threat
            {selectedThreatIds.length !== 1
              ? "s"
              : ""}{" "}
            selected
          </span>

          <div className="flex gap-2">

            {/* BULK QUARANTINE */}
            <button
              type="button"
              onClick={handleBulkQuarantine}
              disabled={bulkActionLoading}
              className="rounded-lg border border-orange-500/40 px-3 py-1.5 text-sm text-orange-300 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkActionLoading
                ? "Processing..."
                : "Quarantine"}
            </button>

            {/* BULK RESOLVE */}
            <button
              type="button"
              onClick={handleBulkResolve}
              disabled={bulkActionLoading}
              className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkActionLoading
                ? "Processing..."
                : "Resolve"}
            </button>

            {/* CLEAR */}
            <button
              type="button"
              onClick={() =>
                setSelectedThreatIds([])
              }
              disabled={bulkActionLoading}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>

          </div>
        </div>
      )}

      <div>

        {/* Threat data table */}
        <table className="w-full table-fixed border-collapse text-left text-sm">

          <thead className="border-b border-slate-700 text-slate-400">
            <tr>

              {/* Checkbox header */}
              <th className="w-[4%] px-2 py-3" />

              <th
                onClick={() => handleSort("id")}
                className={`${thBase} w-[10%]`}
              >
                Threat ID {getSortIcon("id")}
              </th>

              <th
                onClick={() => handleSort("name")}
                className={`${thBase} w-[12%]`}
              >
                Threat Name {getSortIcon("name")}
              </th>

              <th
                onClick={() =>
                  handleSort("endpoint")
                }
                className={`${thBase} w-[11%]`}
              >
                Endpoint {getSortIcon("endpoint")}
              </th>

              <th
                onClick={() =>
                  handleSort("threatType")
                }
                className={`${thBase} w-[14%]`}
              >
                Threat Type {getSortIcon("threatType")}
              </th>

              <th
                onClick={() =>
                  handleSort("detectedBy")
                }
                className={`${thBase} w-[11%]`}
              >
                Detected By {getSortIcon("detectedBy")}
              </th>

              <th
                onClick={() =>
                  handleSort("severity")
                }
                className={`${thBase} w-[9%]`}
              >
                Severity {getSortIcon("severity")}
              </th>

              <th
                onClick={() =>
                  handleSort("detected")
                }
                className={`${thBase} w-[16%]`}
              >
                Detected {getSortIcon("detected")}
              </th>

              <th
                onClick={() =>
                  handleSort("status")
                }
                className={`${thBase} w-[9%]`}
              >
                Status {getSortIcon("status")}
              </th>

              <th className="w-[4%] whitespace-nowrap px-2 py-3 text-center">
                Action
              </th>

            </tr>
          </thead>

          <tbody>

            {paginatedThreats.map((t) => {
              const displayStatus =
                getDisplayStatus(t);

              return (
                <tr
                  key={t.id}
                  className="border-b border-white/5 transition hover:bg-white/5"
                >

                  {/* ROW CHECKBOX */}
                  <td className="px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedThreatIds.includes(
                        t.id
                      )}
                      onChange={() =>
                        handleThreatSelection(
                          t.id
                        )
                      }
                      disabled={bulkActionLoading}
                      className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed"
                      aria-label={`Select ${t.name}`}
                    />
                  </td>

                  {/* THREAT ID */}
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/securityAgent/threats/${t.id}`}
                      title={t.id}
                      className="block whitespace-nowrap font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      {shortId(t.id)}
                    </Link>
                  </td>

                  {/* THREAT NAME */}
                  <td
                    className={tdText}
                    title={t.name}
                  >
                    {t.name}
                  </td>

                  {/* ENDPOINT */}
                  <td
                    className={tdText}
                    title={t.endpoint}
                  >
                    {t.endpoint}
                  </td>

                  {/* THREAT TYPE */}
                  <td className="px-2 py-2.5">
                    <span className="inline-flex min-w-[80px] items-center justify-center whitespace-nowrap rounded-full bg-slate-700 px-3 py-1 text-xs">
                      {t.threatType}
                    </span>
                  </td>

                  {/* DETECTED BY */}
                  <td
                    className={tdText}
                    title={t.detectedBy}
                  >
                    {t.detectedBy}
                  </td>

                  {/* SEVERITY */}
                  <td className="px-2 py-2.5">
                    <span
                      className={`inline-flex min-w-[80px] justify-center rounded-full px-3 py-1 text-xs font-medium ${
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

                  {/* DETECTED */}
                  <td className="whitespace-nowrap px-2 py-2.5">
                    {t.detected}
                  </td>

                  {/* STATUS */}
                  <td className="px-2 py-2.5">
                    <span
                      className={`inline-flex min-w-[80px] justify-center rounded-full px-3 py-1 text-xs font-medium ${
                        displayStatus.endsWith(
                          "Failed"
                        )
                          ? "bg-red-500/15 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                          : displayStatus ===
                              "Resolved"
                            ? "bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                            : displayStatus ===
                                "Contained"
                              ? "bg-blue-500/15 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.35)]"
                              : "bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                      }`}
                      title={
                        displayStatus.endsWith(
                          "Failed"
                        )
                          ? t.latestActionError ||
                            displayStatus
                          : undefined
                      }
                    >
                      {displayStatus}
                    </span>
                  </td>

                  {/* GEAR ACTION */}
                  <td className="relative px-2 py-2.5 text-center">

                    <button
                      type="button"
                      onClick={() =>
                        setOpenActionMenu(
                          openActionMenu === t.id
                            ? null
                            : t.id
                        )
                      }
                      disabled={bulkActionLoading}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Actions for ${t.name}`}
                      title="Threat actions"
                    >
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
                            setOpenActionMenu(
                              null
                            );

                            router.push(
                              `/securityAgent/threats/${t.id}`
                            );
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

                        {/* Kill */}
                        <button
                          type="button"
                          onClick={() =>
                            handleThreatAction(
                              "kill",
                              t
                            )
                          }
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-slate-800"
                        >
                          <span>⚡</span>
                          Kill
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() =>
                            handleThreatAction(
                              "delete",
                              t
                            )
                          }
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-800"
                        >
                          <span>🗑</span>
                          Delete
                        </button>

                        {/* Block */}
                        <button
                          type="button"
                          onClick={() =>
                            handleThreatAction(
                              "block",
                              t
                            )
                          }
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-slate-800"
                        >
                          <span>🚫</span>
                          Block
                        </button>

                        {/* Allow */}
                        <button
                          type="button"
                          onClick={() =>
                            handleThreatAction(
                              "allow",
                              t
                            )
                          }
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-green-300 hover:bg-slate-800"
                        >
                          <span>✓</span>
                          Allow
                        </button>

                      </div>
                    )}
                  </td>

                </tr>
              );
            })}

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
        <div className="mt-4 flex items-center justify-between">

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
              type="button"
              onClick={() =>
                setCurrentPage((p) =>
                  Math.max(p - 1, 1)
                )
              }
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-700 px-4 py-1.5 disabled:opacity-50"
            >
              Previous
            </button>

            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of{" "}
              {totalPages || 1}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) =>
                  Math.min(
                    p + 1,
                    totalPages
                  )
                )
              }
              disabled={
                currentPage === totalPages ||
                totalPages === 0
              }
              className="rounded-lg border border-slate-700 px-4 py-1.5 disabled:opacity-50"
            >
              Next
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
