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

  const [sortField, setSortField] =
    useState<keyof Endpoint>("hostname");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  const [selectedEndpoints, setSelectedEndpoints] =
    useState<Set<string>>(new Set());

  const [actionsOpen, setActionsOpen] = useState(false);

  /*
   * ============================================================
   * SORTING
   * ============================================================
   */

  const handleSort = (field: keyof Endpoint) => {
    if (sortField === field) {
      setSortDirection((previous) =>
        previous === "asc" ? "desc" : "asc"
      );
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  /*
   * ============================================================
   * FILTERING + SORTING
   * ============================================================
   */

  const filteredEndpoints = useMemo(() => {
    const filtered = endpoints.filter((endpoint) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        endpoint.hostname
          .toLowerCase()
          .includes(searchValue) ||
        (endpoint.ip_address ?? "")
          .toLowerCase()
          .includes(searchValue) ||
        (endpoint.public_ip ?? "")
          .toLowerCase()
          .includes(searchValue) ||
        endpoint.os
          .toLowerCase()
          .includes(searchValue) ||
        endpoint.os_version
          .toLowerCase()
          .includes(searchValue);

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
        String(endpoint.secured_by_kuamini) ===
          securedFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesInfected &&
        matchesSecured
      );
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (
        typeof aValue === "boolean" &&
        typeof bValue === "boolean"
      ) {
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

  /*
   * ============================================================
   * SELECTION
   * ============================================================
   */

  const selectedEndpointData = filteredEndpoints.filter(
    (endpoint) => selectedEndpoints.has(endpoint.id)
  );

  const selectedCount = selectedEndpointData.length;

  const hasSelection = selectedCount > 0;

  const hasOnlineSelected = selectedEndpointData.some(
    (endpoint) => endpoint.status === "online"
  );

  const hasOfflineSelected = selectedEndpointData.some(
    (endpoint) => endpoint.status !== "online"
  );

  /*
   * Delete is allowed ONLY when every selected endpoint
   * is offline.
   */
  const allSelectedOffline =
    hasSelection && !hasOnlineSelected;

  /*
   * ============================================================
   * SELECT ALL
   * ============================================================
   */

  const allVisibleSelected =
    filteredEndpoints.length > 0 &&
    filteredEndpoints.every((endpoint) =>
      selectedEndpoints.has(endpoint.id)
    );

  const someVisibleSelected =
    filteredEndpoints.some((endpoint) =>
      selectedEndpoints.has(endpoint.id)
    );

  /*
   * ============================================================
   * CHECKBOX HANDLERS
   * ============================================================
   */

  const toggleEndpointSelection = (id: string) => {
    setSelectedEndpoints((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedEndpoints((previous) => {
        const next = new Set(previous);

        filteredEndpoints.forEach((endpoint) => {
          next.delete(endpoint.id);
        });

        return next;
      });

      return;
    }

    setSelectedEndpoints((previous) => {
      const next = new Set(previous);

      filteredEndpoints.forEach((endpoint) => {
        next.add(endpoint.id);
      });

      return next;
    });
  };

  /*
   * ============================================================
   * ACTIONS
   * ============================================================
   */

  const handleSendHeartbeat = () => {
    if (!hasSelection) {
      return;
    }

    console.info(
      "Send heartbeat to endpoints:",
      selectedEndpointData.map(
        (endpoint) => endpoint.id
      )
    );

    setActionsOpen(false);
  };

  const handleDeleteEndpoints = () => {
    if (!allSelectedOffline) {
      return;
    }

    console.info(
      "Delete endpoints:",
      selectedEndpointData.map(
        (endpoint) => endpoint.id
      )
    );

    setActionsOpen(false);
  };

  /*
   * ============================================================
   * SORT ARROW
   * ============================================================
   */

  const renderSortArrow = (
    field: keyof Endpoint
  ) => {
    if (sortField !== field) {
      return (
        <span className="text-slate-500">
          ⇅
        </span>
      );
    }

    return (
      <span className="text-slate-300">
        {sortDirection === "asc"
          ? "▲"
          : "▼"}
      </span>
    );
  };

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="relative overflow-visible rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">

      {/* ========================================================
          HEADER
          ======================================================== */}

      <div className="p-6">

        <div className="flex items-start justify-between gap-6">

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-white">
              Endpoint Inventory
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Registered devices in your organization.
            </p>
          </div>

          {/* ====================================================
              SETTINGS / ACTION GEAR
              ==================================================== */}

          <div className="relative shrink-0">

            <button
              type="button"
              onClick={() =>
                setActionsOpen(
                  (previous) => !previous
                )
              }
              aria-label="Endpoint actions"
              aria-expanded={actionsOpen}
              title="Endpoint actions"
              className="
                inline-flex
                h-14
                w-14
                items-center
                justify-center
                rounded-full
                border
                border-slate-600
                bg-slate-800
                text-slate-300
                transition-all
                duration-200
                hover:border-slate-500
                hover:bg-slate-700
                hover:text-white
                focus:outline-none
                focus:ring-2
                focus:ring-cyan-500/40
              "
            >

              {/* ------------------------------------------------
                  THIN OUTLINED GEAR
                  ------------------------------------------------ */}

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path
                  d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                />

                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
              </svg>

            </button>

            {/* ==================================================
                ACTION MENU
                ================================================== */}

            {actionsOpen && (
              <div
                className="
                  absolute
                  right-0
                  top-[4.5rem]
                  z-50
                  w-72
                  overflow-visible
                  rounded-xl
                  border
                  border-slate-700
                  bg-slate-900
                  shadow-2xl
                  shadow-black/50
                "
              >

                {/* Menu header */}
                <div className="border-b border-slate-800 px-4 py-3">

                  <p className="text-sm font-semibold text-white">
                    Endpoint Actions
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedCount}{" "}
                    {selectedCount === 1
                      ? "endpoint"
                      : "endpoints"}{" "}
                    selected
                  </p>

                </div>

                {/* ==================================================
                    SEND HEARTBEAT
                    ================================================== */}

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={handleSendHeartbeat}
                  className={`
                    flex
                    w-full
                    items-center
                    gap-3
                    px-4
                    py-3
                    text-left
                    text-sm
                    transition-colors
                    ${
                      hasSelection
                        ? "text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                        : "cursor-not-allowed text-slate-600"
                    }
                  `}
                >

                  <span className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-cyan-500/10
                    text-xl
                    text-cyan-400
                  ">
                    ↻
                  </span>

                  <span className="min-w-0">

                    <span className="block font-medium">
                      Send heartbeat
                    </span>

                    <span className="mt-0.5 block text-xs text-slate-500">
                      {hasSelection
                        ? `Send to ${selectedCount} selected ${
                            selectedCount === 1
                              ? "endpoint"
                              : "endpoints"
                          }`
                        : "Select endpoints first"}
                    </span>

                  </span>

                </button>

                <div className="border-t border-slate-800" />

                {/* ==================================================
                    DELETE ENDPOINTS
                    ================================================== */}

                <div className="group relative">

                  <button
                    type="button"
                    disabled={!allSelectedOffline}
                    onClick={handleDeleteEndpoints}
                    className={`
                      flex
                      w-full
                      items-center
                      gap-3
                      px-4
                      py-3
                      text-left
                      text-sm
                      transition-colors
                      ${
                        allSelectedOffline
                          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          : "cursor-not-allowed text-slate-600"
                      }
                    `}
                  >

                    {/* Delete icon */}
                    <span
                      className={`
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        ${
                          allSelectedOffline
                            ? "bg-red-500/10 text-red-400"
                            : "bg-slate-800 text-slate-600"
                        }
                      `}
                    >

                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v5" />
                        <path d="M14 11v5" />
                      </svg>

                    </span>

                    <span className="min-w-0">

                      <span className="block font-medium">
                        Delete endpoints
                      </span>

                      <span className="mt-0.5 block text-xs text-slate-500">
                        {allSelectedOffline
                          ? `Delete ${selectedCount} selected ${
                              selectedCount === 1
                                ? "endpoint"
                                : "endpoints"
                            }`
                          : "Only offline endpoints can be deleted"}
                      </span>

                    </span>

                  </button>

                  {/* =================================================
                      MIXED ONLINE + OFFLINE TOOLTIP
                      ================================================= */}

                  {hasOnlineSelected &&
                    hasOfflineSelected && (
                      <div
                        className="
                          pointer-events-none
                          absolute
                          right-full
                          top-1/2
                          mr-3
                          hidden
                          w-72
                          -translate-y-1/2
                          rounded-xl
                          border
                          border-amber-500/20
                          bg-slate-950
                          px-4
                          py-3
                          shadow-2xl
                          group-hover:block
                        "
                      >

                        <div className="flex items-start gap-3">

                          <span className="
                            mt-0.5
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-amber-500/10
                            text-sm
                            font-bold
                            text-amber-400
                          ">
                            !
                          </span>

                          <div>

                            <p className="text-sm font-medium text-amber-400">
                              Delete unavailable
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              You have selected an online
                              endpoint. Online endpoints
                              cannot be deleted.
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Select only offline endpoints
                              to enable deletion.
                            </p>

                          </div>

                        </div>

                      </div>
                    )}

                  {/* =================================================
                      ONLINE ONLY TOOLTIP
                      ================================================= */}

                  {hasOnlineSelected &&
                    !hasOfflineSelected && (
                      <div
                        className="
                          pointer-events-none
                          absolute
                          right-full
                          top-1/2
                          mr-3
                          hidden
                          w-72
                          -translate-y-1/2
                          rounded-xl
                          border
                          border-slate-700
                          bg-slate-950
                          px-4
                          py-3
                          shadow-2xl
                          group-hover:block
                        "
                      >

                        <div className="flex items-start gap-3">

                          <span className="
                            mt-0.5
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-slate-800
                            text-sm
                            font-medium
                            text-slate-400
                          ">
                            i
                          </span>

                          <div>

                            <p className="text-sm font-medium text-white">
                              Endpoint is online
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              Delete is disabled because
                              the selected endpoint is
                              currently online.
                            </p>

                          </div>

                        </div>

                      </div>
                    )}

                </div>

              </div>
            )}

          </div>

        </div>

        {/* ========================================================
            FILTERS
            ======================================================== */}

        <div className="mt-6 flex flex-wrap items-center gap-3">

          {/* Search */}
          <input
            type="text"
            placeholder="Search endpoints..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="
              w-full
              rounded-lg
              border
              border-slate-700
              bg-slate-800
              px-4
              py-2
              text-sm
              text-white
              placeholder:text-slate-400
              focus:border-cyan-500
              focus:outline-none
              sm:w-72
              lg:w-80
            "
          />

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="
              rounded-lg
              border
              border-slate-700
              bg-slate-800
              px-4
              py-2
              text-sm
              text-white
              focus:border-cyan-500
              focus:outline-none
            "
          >
            <option value="" disabled hidden>
              Status
            </option>

            <option value="all">
              All
            </option>

            <option value="online">
              Online
            </option>

            <option value="offline">
              Offline
            </option>
          </select>

          {/* Infected */}
          <select
            value={infectedFilter}
            onChange={(event) =>
              setInfectedFilter(event.target.value)
            }
            className="
              rounded-lg
              border
              border-slate-700
              bg-slate-800
              px-4
              py-2
              text-sm
              text-white
              focus:border-cyan-500
              focus:outline-none
            "
          >
            <option value="" disabled hidden>
              Infected
            </option>

            <option value="all">
              All
            </option>

            <option value="true">
              Infected
            </option>

            <option value="false">
              Clean
            </option>
          </select>

          {/* Secured */}
          <select
            value={securedFilter}
            onChange={(event) =>
              setSecuredFilter(event.target.value)
            }
            className="
              rounded-lg
              border
              border-slate-700
              bg-slate-800
              px-4
              py-2
              text-sm
              text-white
              focus:border-cyan-500
              focus:outline-none
            "
          >
            <option value="" disabled hidden>
              Secured
            </option>

            <option value="all">
              All
            </option>

            <option value="true">
              Secured
            </option>

            <option value="false">
              Not Secured
            </option>
          </select>

        </div>

      </div>

      {/* ========================================================
          TABLE BORDER
          ======================================================== */}

      <div className="border-t border-slate-800" />

      {/* ========================================================
          TABLE
          ======================================================== */}

      <div className="overflow-x-auto overflow-y-visible">

        <table className="w-full">

          <thead>

            <tr className="border-b border-slate-700">

              {/* Select all */}
              <th className="w-12 px-2 py-4 text-center">

                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate =
                        someVisibleSelected &&
                        !allVisibleSelected;
                    }
                  }}
                  onChange={toggleSelectAll}
                  aria-label="Select all endpoints"
                  className="
                    h-4
                    w-4
                    cursor-pointer
                    rounded
                    border-slate-600
                    bg-slate-800
                    accent-cyan-500
                    focus:ring-cyan-500
                  "
                />

              </th>

              {/* Name */}
              <th
                onClick={() =>
                  handleSort("hostname")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Name
                  {renderSortArrow("hostname")}
                </div>
              </th>

              {/* Local IP */}
              <th
                onClick={() =>
                  handleSort("ip_address")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Local IP
                  {renderSortArrow("ip_address")}
                </div>
              </th>

              {/* Public IP */}
              <th
                onClick={() =>
                  handleSort("public_ip")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Public IP
                  {renderSortArrow("public_ip")}
                </div>
              </th>

              {/* OS */}
              <th
                onClick={() =>
                  handleSort("os")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  OS
                  {renderSortArrow("os")}
                </div>
              </th>

              {/* Version */}
              <th
                onClick={() =>
                  handleSort("os_version")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Version
                  {renderSortArrow("os_version")}
                </div>
              </th>

              {/* Agent Version */}
              <th
                onClick={() =>
                  handleSort("agent_version")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Agent Version
                  {renderSortArrow("agent_version")}
                </div>
              </th>

              {/* Status */}
              <th
                onClick={() =>
                  handleSort("status")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Status
                  {renderSortArrow("status")}
                </div>
              </th>

              {/* Infected */}
              <th
                onClick={() =>
                  handleSort("infected")
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Infected
                  {renderSortArrow("infected")}
                </div>
              </th>

              {/* Secured */}
              <th
                onClick={() =>
                  handleSort(
                    "secured_by_kuamini"
                  )
                }
                className="
                  cursor-pointer
                  select-none
                  px-6
                  py-4
                  text-center
                  text-slate-400
                  hover:text-white
                "
              >
                <div className="flex items-center justify-center gap-2">
                  Secured by Kuamini
                  {renderSortArrow(
                    "secured_by_kuamini"
                  )}
                </div>
              </th>

            </tr>

          </thead>

          {/* ======================================================
              BODY
              ====================================================== */}

          <tbody>

            {filteredEndpoints.length > 0 ? (

              filteredEndpoints.map(
                (endpoint) => (

                  <tr
                    key={endpoint.id}
                    className={`
                      border-b
                      border-slate-800
                      transition-colors
                      ${
                        selectedEndpoints.has(
                          endpoint.id
                        )
                          ? "bg-cyan-500/5"
                          : "hover:bg-slate-800"
                      }
                    `}
                  >

                    {/* ==================================================
                        CHECKBOX
                        ================================================== */}

                    <td className="w-12 px-2 py-4 text-center">

                      <input
                        type="checkbox"
                        checked={selectedEndpoints.has(
                          endpoint.id
                        )}
                        onChange={() =>
                          toggleEndpointSelection(
                            endpoint.id
                          )
                        }
                        aria-label={`Select ${endpoint.hostname}`}
                        className="
                          h-4
                          w-4
                          cursor-pointer
                          rounded
                          border-slate-600
                          bg-slate-800
                          accent-cyan-500
                          focus:ring-cyan-500
                        "
                      />

                    </td>

                    {/* ==================================================
                        NAME + VIEW ICON
                        ================================================== */}

                    <td className="px-6 py-4">

                      <div className="flex items-center justify-center gap-3">

                        <Link
                          href={`/securityAgent/endpoints/${endpoint.id}`}
                          className="
                            font-medium
                            text-cyan-400
                            hover:text-cyan-300
                            hover:underline
                          "
                        >
                          {endpoint.hostname}
                        </Link>

                        <Link
                          href={`/securityAgent/endpoints/${endpoint.id}`}
                          aria-label={`View ${endpoint.hostname} endpoint`}
                          title="View endpoint"
                          className="
                            inline-flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-full
                            bg-slate-800
                            text-slate-400
                            transition-all
                            hover:bg-cyan-500/15
                            hover:text-cyan-400
                          "
                        >

                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M14 5h5v5" />

                            <path d="M13 11l6-6" />

                            <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                          </svg>

                        </Link>

                      </div>

                    </td>

                    {/* Local IP */}
                    <td className="px-6 py-4 text-center">
                      {endpoint.ip_address || "-"}
                    </td>

                    {/* Public IP */}
                    <td className="px-6 py-4 text-center">
                      {endpoint.public_ip || "-"}
                    </td>

                    {/* OS */}
                    <td className="px-6 py-4 text-center">
                      {endpoint.os}
                    </td>

                    {/* OS Version */}
                    <td className="px-6 py-4 text-center">
                      {endpoint.os_version}
                    </td>

                    {/* Agent Version */}
                    <td className="px-6 py-4 text-center">
                      {endpoint.agent_version}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">

                      <span
                        className={`
                          inline-flex
                          rounded-full
                          px-3
                          py-1
                          text-sm
                          font-medium
                          ${
                            endpoint.status ===
                            "online"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }
                        `}
                      >
                        {endpoint.status}
                      </span>

                    </td>

                    {/* Infected */}
                    <td className="px-6 py-4 text-center">

                      <span
                        className={`
                          inline-flex
                          rounded-full
                          px-3
                          py-1
                          text-sm
                          font-medium
                          ${
                            endpoint.infected
                              ? "bg-red-500/20 text-red-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }
                        `}
                      >
                        {endpoint.infected
                          ? "Yes"
                          : "No"}
                      </span>

                    </td>

                    {/* Secured */}
                    <td className="px-6 py-4 text-center">

                      <span
                        className={`
                          inline-flex
                          rounded-full
                          px-3
                          py-1
                          text-sm
                          font-medium
                          ${
                            endpoint.secured_by_kuamini
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-slate-500/20 text-amber-300"
                          }
                        `}
                      >
                        {endpoint.secured_by_kuamini
                          ? "Yes"
                          : "Action Required"}
                      </span>

                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>

                <td
                  colSpan={10}
                  className="py-8 text-center text-slate-400"
                >
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