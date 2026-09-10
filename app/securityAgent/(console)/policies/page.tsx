"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type Policy = {
  id: string;
  account_id: string;
  parent_policy_id: string | null;
  name: string;
  description: string | null;
  type: string;
  config: {
    threatType?: string;
    priority?: string;
    action?: string;
  };
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: string;

  // True when the policy is inherited from the parent account.
  is_inherited?: boolean;

  // Comes from the parent account's policy setting.
  // This determines whether the child can override
  // an inherited policy.
  parent_allows_child_overrides?: boolean;
};

const POLICIES_PER_PAGE = 5;

export default function PoliciesPage() {
  // ---------------------------------------------------------
  // Policies
  // ---------------------------------------------------------

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [threatTypes, setThreatTypes] = useState<string[]>([]);

  // ---------------------------------------------------------
  // Loading / saving
  // ---------------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // ---------------------------------------------------------
  // Policy form
  // ---------------------------------------------------------

  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threatType, setThreatType] = useState("");
  const [priority, setPriority] = useState("");
  const [action, setAction] = useState("");

  // ---------------------------------------------------------
  // Account-level child override setting
  // ---------------------------------------------------------

  const [allowChildOverrides, setAllowChildOverrides] = useState(false);

  // ---------------------------------------------------------
  // Search / pagination
  // ---------------------------------------------------------

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ---------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------

  type SortKey = "name" | "threatType" | "priority" | "action" | "appliedTo";

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // ---------------------------------------------------------
  // Load policies and threat types
  // ---------------------------------------------------------

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [policiesResponse, threatTypesResponse] = await Promise.all([
          fetch("/api/securityagent/policies"),
          fetch("/api/securityagent/policies/threat-types"),
        ]);

        if (!policiesResponse.ok) {
          throw new Error("Failed to fetch policies");
        }

        if (!threatTypesResponse.ok) {
          throw new Error("Failed to fetch threat types");
        }

        const policiesData = await policiesResponse.json();

        const threatTypesData = await threatTypesResponse.json();

        /*
         * The policies API returns:
         *
         * {
         *   policies: [...],
         *   allowChildOverrides: boolean
         * }
         */
        if (!policiesData || !Array.isArray(policiesData.policies)) {
          throw new Error("Invalid policies response");
        }

        setPolicies(policiesData.policies);

        setAllowChildOverrides(policiesData.allowChildOverrides === true);

        /*
         * Threat types API returns an array.
         */
        if (Array.isArray(threatTypesData)) {
          setThreatTypes(threatTypesData);
        } else {
          setThreatTypes([]);
        }
      } catch (error) {
        console.error("Failed to load policy data:", error);

        toast.error(
          error instanceof Error ? error.message : "Failed to load policy data"
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ---------------------------------------------------------
  // Reset form
  // ---------------------------------------------------------

  const resetForm = () => {
    setEditingPolicyId(null);
    setName("");
    setDescription("");
    setThreatType("");
    setPriority("");
    setAction("");
  };

  // ---------------------------------------------------------
  // Edit policy
  // ---------------------------------------------------------

  const handleEdit = (policy: Policy) => {
    /*
     * An inherited policy can only be edited when
     * the parent account has explicitly allowed overrides.
     */
    if (policy.is_inherited && !policy.parent_allows_child_overrides) {
      toast.error(
        "The parent account does not allow this inherited policy to be overridden."
      );
      return;
    }

    setEditingPolicyId(policy.id);

    setName(policy.name);
    setDescription(policy.description || "");

    setThreatType(policy.config?.threatType || "");

    setPriority(policy.config?.priority || "");

    setAction(policy.config?.action || "");

    /*
     * Scroll to the configuration section below
     * the policies table.
     */
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  };

  // ---------------------------------------------------------
  // Validate unique policy name
  // ---------------------------------------------------------

  const validateUniquePolicyName = () => {
    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      return false;
    }

    const duplicateExists = policies.some((policy) => {
      /*
       * When editing, ignore the policy currently
       * being edited.
       */
      if (editingPolicyId && policy.id === editingPolicyId) {
        return false;
      }

      return policy.name.trim().toLowerCase() === normalizedName;
    });

    if (duplicateExists) {
      toast.error("A policy with this name already exists.");

      return false;
    }

    return true;
  };

  // ---------------------------------------------------------
  // Save / update policy
  // ---------------------------------------------------------

  const handleSavePolicy = async () => {
    if (!name.trim()) {
      toast.error("Policy name is required");
      return;
    }

    if (!validateUniquePolicyName()) {
      return;
    }

    if (!threatType) {
      toast.error("Threat type is required");
      return;
    }

    if (!priority) {
      toast.error("Priority is required");
      return;
    }

    if (!action) {
      toast.error("Default action is required");
      return;
    }

    if (description.length > 200) {
      toast.error("Description must be 200 characters or less");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        threatType,
        priority,
        action,
      };

      // -----------------------------------------------------
      // Update existing policy
      // -----------------------------------------------------

      if (editingPolicyId) {
        const response = await fetch("/api/securityagent/policies", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingPolicyId,
            ...payload,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update policy");
        }

        /*
         * If an inherited policy was edited, the API
         * creates a child-specific override.
         *
         * Therefore replace the original inherited
         * policy with the returned child policy.
         */
        setPolicies((currentPolicies) =>
          currentPolicies.map((policy) =>
            policy.id === editingPolicyId ? data : policy
          )
        );

        toast.success("Policy updated successfully");

        resetForm();

        return;
      }

      // -----------------------------------------------------
      // Create new policy
      // -----------------------------------------------------

      const response = await fetch("/api/securityagent/policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create policy");
      }

      setPolicies((currentPolicies) => [data, ...currentPolicies]);

      /*
       * Return to first page so the newly created
       * policy is visible.
       */
      setCurrentPage(1);

      toast.success("Policy created successfully");

      resetForm();
    } catch (error) {
      console.error("Failed to save policy:", error);

      toast.error(error instanceof Error ? error.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------
  // Delete policy
  // ---------------------------------------------------------

  const handleDelete = async (policy: Policy) => {
    /*
     * Inherited parent policies cannot be deleted
     * from a child account.
     */
    if (policy.is_inherited) {
      toast.error("Inherited policies cannot be deleted from a child account.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${policy.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/securityagent/policies?id=${encodeURIComponent(policy.id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete policy");
      }

      setPolicies((currentPolicies) =>
        currentPolicies.filter((currentPolicy) => currentPolicy.id !== policy.id)
      );

      if (editingPolicyId === policy.id) {
        resetForm();
      }

      toast.success("Policy deleted successfully");
    } catch (error) {
      console.error("Failed to delete policy:", error);

      toast.error(
        error instanceof Error ? error.message : "Failed to delete policy"
      );
    }
  };

  // ---------------------------------------------------------
  // Child override setting
  // ---------------------------------------------------------

  const handleChildOverrideChange = async (enabled: boolean) => {
    /*
     * Optimistic UI update.
     */
    setAllowChildOverrides(enabled);

    try {
      setSavingSettings(true);

      const response = await fetch("/api/securityagent/policies/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowChildOverrides: enabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update policy settings");
      }

      setAllowChildOverrides(data.allowChildOverrides === true);

      /*
       * Reload policies because the parent override
       * permission can affect inherited policy actions.
       */
      const policiesResponse = await fetch("/api/securityagent/policies");

      if (policiesResponse.ok) {
        const policiesData = await policiesResponse.json();

        if (Array.isArray(policiesData.policies)) {
          setPolicies(policiesData.policies);
        }

        setAllowChildOverrides(policiesData.allowChildOverrides === true);
      }

      toast.success(
        enabled
          ? "Child account overrides enabled"
          : "Child account overrides disabled"
      );
    } catch (error) {
      console.error("Failed to update child override setting:", error);

      /*
       * Revert optimistic update.
       */
      setAllowChildOverrides(!enabled);

      toast.error(
        error instanceof Error ? error.message : "Failed to update policy settings"
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // ---------------------------------------------------------
  // Search filtering
  // ---------------------------------------------------------

  const filteredPolicies = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return policies;
    }

    return policies.filter((policy) => {
      const policyName = policy.name?.toLowerCase() || "";

      const description = policy.description?.toLowerCase() || "";

      const threat = policy.config?.threatType?.toLowerCase() || "";

      const priority = policy.config?.priority?.toLowerCase() || "";

      const action = policy.config?.action?.toLowerCase() || "";

      return (
        policyName.includes(search) ||
        description.includes(search) ||
        threat.includes(search) ||
        priority.includes(search) ||
        action.includes(search)
      );
    });
  }, [policies, searchTerm]);

  // ---------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }

    // Start from the first page after changing the sort.
    setCurrentPage(1);
  };

  const sortedPolicies = useMemo(() => {
    const sorted = [...filteredPolicies];

    sorted.sort((a, b) => {
      let valueA = "";
      let valueB = "";

      switch (sortKey) {
        case "name":
          valueA = a.name || "";
          valueB = b.name || "";
          break;

        case "threatType":
          valueA = a.config?.threatType || "";
          valueB = b.config?.threatType || "";
          break;

        case "priority":
          valueA = a.config?.priority || "";
          valueB = b.config?.priority || "";
          break;

        case "action":
          valueA = a.config?.action || "";
          valueB = b.config?.action || "";
          break;

        case "appliedTo":
          valueA = a.is_inherited ? "Inherited" : "Current Account";
          valueB = b.is_inherited ? "Inherited" : "Current Account";
          break;
      }

      const comparison = valueA.localeCompare(valueB, undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredPolicies, sortKey, sortDirection]);

  // ---------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(sortedPolicies.length / POLICIES_PER_PAGE)
  );

  const paginatedPolicies = useMemo(() => {
    const start = (currentPage - 1) * POLICIES_PER_PAGE;

    return sortedPolicies.slice(start, start + POLICIES_PER_PAGE);
  }, [sortedPolicies, currentPage]);

  /*
   * If filtering/search causes the current page
   * to become invalid, return to page 1.
   */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  /*
   * Reset pagination whenever the search term changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // ---------------------------------------------------------
  // Pagination helpers
  // ---------------------------------------------------------

  const startItem =
    filteredPolicies.length === 0 ? 0 : (currentPage - 1) * POLICIES_PER_PAGE + 1;

  const endItem = Math.min(currentPage * POLICIES_PER_PAGE, filteredPolicies.length);

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#030817] text-white">
      {/* =========================================================
          GLOBAL DASHBOARD LIGHTING (matches Dashboard page)
          ========================================================= */}

      <div
        className="pointer-events-none absolute -top-40 left-[20%] h-[520px] w-[720px] rounded-full opacity-70 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(0,190,255,0.38) 0%, rgba(0,90,180,0.16) 38%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute -right-40 -top-20 h-[600px] w-[700px] rounded-full opacity-80 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(165,0,255,0.42) 0%, rgba(100,0,180,0.18) 42%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute right-[5%] top-[18%] h-[360px] w-[500px] rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,35,145,0.24) 0%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-60 left-[25%] h-[600px] w-[800px] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(110,0,255,0.28) 0%, rgba(50,20,130,0.16) 45%, transparent 75%)",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-60 right-[5%] h-[500px] w-[700px] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,65,90,0.30) 0%, rgba(255,140,0,0.20) 38%, transparent 72%)",
        }}
      />

      {/* Neon decorative curves */}
      <div className="pointer-events-none absolute right-[-180px] top-[-180px] h-[390px] w-[800px] rotate-[-17deg] rounded-[50%] border-b-2 border-r-2 border-pink-500/80 shadow-[0_0_18px_rgba(236,72,153,0.7),0_0_45px_rgba(168,85,247,0.45)]" />
      <div className="pointer-events-none absolute right-[-150px] top-[-130px] h-[340px] w-[720px] rotate-[-17deg] rounded-[50%] border-b border-orange-400/90 shadow-[0_0_15px_rgba(251,146,60,0.8)]" />
      <div className="pointer-events-none absolute -left-[420px] bottom-[-230px] h-[720px] w-[650px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.7),0_0_70px_rgba(168,85,247,0.4)]" />
      <div className="pointer-events-none absolute -left-[390px] bottom-[-180px] h-[650px] w-[580px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-orange-400/90 shadow-[0_0_20px_rgba(251,146,60,0.9),0_0_55px_rgba(251,146,60,0.45)]" />
      <div className="pointer-events-none absolute -bottom-[350px] right-[-100px] h-[600px] w-[1000px] rotate-[-12deg] rounded-[50%] border-t-2 border-pink-500/70 shadow-[0_0_22px_rgba(236,72,153,0.75),0_0_65px_rgba(168,85,247,0.45)]" />
      <div className="pointer-events-none absolute -bottom-[315px] right-[-80px] h-[540px] w-[900px] rotate-[-12deg] rounded-[50%] border-t border-orange-400/70 shadow-[0_0_18px_rgba(251,146,60,0.7)]" />

      {/* Decorative dot grid */}
      <div
        className="pointer-events-none absolute bottom-20 left-0 h-72 w-72 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(216,70,239,0.75) 1px, transparent 1px)",
          backgroundSize: "13px 13px",
          maskImage:
            "linear-gradient(to right, black, transparent), linear-gradient(to top, black, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, black, transparent), linear-gradient(to top, black, transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* =================================================
            PAGE HEADER
        ================================================== */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-1 w-10 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
                Security Operations
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Policies
            </h1>

            <p className="mt-2 text-sm leading-6 text-sky-200/80 sm:text-base">
              Manage your security policies and inherited account policies.
            </p>
          </div>

          {/* =================================================
              ACCOUNT-LEVEL CHILD OVERRIDE SETTING
          ================================================== */}

          <div
            className="relative overflow-hidden rounded-2xl border border-purple-400/40 px-5 py-4 shadow-[0_0_20px_rgba(168,85,247,0.15)] lg:min-w-[420px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(60,20,110,0.5), rgba(20,10,45,0.9) 60%, rgba(10,5,25,0.96))",
            }}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={allowChildOverrides}
                disabled={savingSettings}
                onChange={(e) => handleChildOverrideChange(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-purple-400/40 bg-slate-900 text-purple-500 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div>
                <div className="text-sm font-semibold text-white">
                  Allow child account overrides
                </div>

                <p className="mt-1 text-xs leading-5 text-purple-100/60">
                  Allow child accounts to override inherited policies.
                </p>

                {savingSettings && (
                  <p className="mt-1 text-xs text-cyan-300">Saving...</p>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* =================================================
            POLICIES TABLE
        ================================================== */}

        <div
          className="relative overflow-hidden rounded-2xl border border-blue-400/35 shadow-[0_0_28px_rgba(30,100,255,0.12),inset_0_0_45px_rgba(40,100,255,0.05)]"
          style={{
            background:
              "linear-gradient(145deg, rgba(20,55,100,0.6), rgba(5,20,48,0.92) 65%, rgba(4,13,31,0.98))",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-72 rounded-bl-full bg-cyan-400/10 blur-2xl" />

          {/* -------------------------------------------------
              TABLE HEADER / SEARCH
          -------------------------------------------------- */}

          <div className="relative z-10 border-b border-white/10 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Policies</h2>

                <p className="mt-1 text-sm text-sky-200/70">
                  Manage your existing security policies.
                </p>
              </div>

              <div className="w-full lg:max-w-md">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search policies..."
                  className="w-full rounded-lg border border-white/10 bg-[#06152c]/85 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* -------------------------------------------------
              LOADING
          -------------------------------------------------- */}

          {loading ? (
            <div className="relative z-10 flex items-center justify-center px-6 py-16">
              <div className="text-sm text-sky-200/70">Loading policies...</div>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="relative z-10 flex items-center justify-center px-6 py-16">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-200">
                  {searchTerm.trim()
                    ? "No matching policies found"
                    : "No policies found"}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  {searchTerm.trim()
                    ? "Try a different search term."
                    : "Create your first policy using the configuration form below."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* -------------------------------------------------
                  TABLE
              -------------------------------------------------- */}

              <div className="relative z-10 overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20">
                    <tr>
                      {/* Policy Name */}
                      <th className="px-6 py-4 font-medium text-sky-200/70">
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Policy Name"
                        >
                          Policy Name
                          <span className="text-xs">
                            {sortKey === "name"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>

                      {/* Threat Type */}
                      <th className="px-6 py-4 font-medium text-sky-200/70">
                        <button
                          type="button"
                          onClick={() => handleSort("threatType")}
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Threat Type"
                        >
                          Threat Type
                          <span className="text-xs">
                            {sortKey === "threatType"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>

                      {/* Priority */}
                      <th className="px-6 py-4 font-medium text-sky-200/70">
                        <button
                          type="button"
                          onClick={() => handleSort("priority")}
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Priority"
                        >
                          Priority
                          <span className="text-xs">
                            {sortKey === "priority"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>

                      {/* Default Action */}
                      <th className="px-6 py-4 font-medium text-sky-200/70">
                        <button
                          type="button"
                          onClick={() => handleSort("action")}
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Default Action"
                        >
                          Default Action
                          <span className="text-xs">
                            {sortKey === "action"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>

                      {/* Applied To */}
                      <th className="px-6 py-4 font-medium text-sky-200/70">
                        <button
                          type="button"
                          onClick={() => handleSort("appliedTo")}
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Applied To"
                        >
                          Applied To
                          <span className="text-xs">
                            {sortKey === "appliedTo"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>

                      {/* Actions - not sortable */}
                      <th className="px-6 py-4 font-medium text-sky-200/70">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {paginatedPolicies.map((policy) => {
                      const canEdit =
                        !policy.is_inherited ||
                        policy.parent_allows_child_overrides === true;

                      const canDelete = !policy.is_inherited;

                      return (
                        <tr
                          key={policy.id}
                          className="transition hover:bg-white/5"
                        >
                          {/* Policy Name */}
                          <td className="px-6 py-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {policy.name}
                                </span>

                                {policy.is_inherited && (
                                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.35)]">
                                    Inherited
                                  </span>
                                )}

                                {!policy.is_inherited && policy.parent_policy_id && (
                                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.35)]">
                                    Override
                                  </span>
                                )}
                              </div>

                              {policy.description && (
                                <div className="mt-1 max-w-xs truncate text-xs text-slate-400">
                                  {policy.description}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Threat Type */}
                          <td className="px-6 py-4 text-slate-200">
                            {policy.config?.threatType || "-"}
                          </td>

                          {/* Priority */}
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                policy.config?.priority === "High"
                                  ? "bg-rose-500/15 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                                  : policy.config?.priority === "Medium"
                                    ? "bg-amber-500/15 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
                                    : "bg-slate-500/15 text-slate-300"
                              }`}
                            >
                              {policy.config?.priority || "-"}
                            </span>
                          </td>

                          {/* Default Action */}
                          <td className="px-6 py-4 text-slate-200">
                            {policy.config?.action || "-"}
                          </td>

                          {/* Applied To */}
                          <td className="px-6 py-4">
                            {policy.is_inherited ? (
                              <span className="text-sm text-blue-300">
                                Inherited
                              </span>
                            ) : policy.parent_policy_id ? (
                              <span className="text-sm text-purple-300">
                                Current Account (Override)
                              </span>
                            ) : (
                              <span className="text-sm text-slate-300">
                                Current Account
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {/* EDIT */}
                              <button
                                type="button"
                                onClick={() => handleEdit(policy)}
                                disabled={!canEdit}
                                title={
                                  policy.is_inherited &&
                                  !policy.parent_allows_child_overrides
                                    ? "Parent account does not allow child overrides"
                                    : "Edit policy"
                                }
                                className="rounded-md border border-cyan-400/30 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Edit
                              </button>

                              {/* DELETE */}
                              <button
                                type="button"
                                onClick={() => handleDelete(policy)}
                                disabled={!canDelete}
                                title={
                                  policy.is_inherited
                                    ? "Inherited policies cannot be deleted"
                                    : "Delete policy"
                                }
                                className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* -------------------------------------------------
                  PAGINATION
              -------------------------------------------------- */}

              <div className="relative z-10 flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-400">
                  Showing {startItem} - {endItem} of {filteredPolicies.length}{" "}
                  {filteredPolicies.length === 1 ? "policy" : "policies"}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="px-2 text-xs text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* =================================================
            POLICY CONFIGURATION
            THIS IS BELOW THE TABLE
        ================================================== */}

        <div
          id="policy-configuration"
          className="relative overflow-hidden rounded-2xl border border-purple-400/35 p-6 shadow-[0_0_28px_rgba(168,85,247,0.12),inset_0_0_45px_rgba(168,85,247,0.05)]"
          style={{
            background:
              "linear-gradient(145deg, rgba(50,20,95,0.55), rgba(20,10,45,0.92) 65%, rgba(10,5,25,0.98))",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 rounded-bl-full bg-purple-500/10 blur-2xl" />

          <div className="relative z-10 mb-5">
            <h2 className="text-lg font-semibold text-white">
              {editingPolicyId ? "Edit Policy" : "Configure Policy"}
            </h2>

            <p className="mt-1 text-sm text-purple-100/60">
              {editingPolicyId
                ? "Update the selected security policy."
                : "Create and configure a security policy."}
            </p>
          </div>

          {/* -------------------------------------------------
              FORM
          -------------------------------------------------- */}

          <div className="relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Policy Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Policy Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter policy name"
                className="w-full rounded-lg border border-white/10 bg-[#0b0620]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />

              <p className="mt-1 text-xs text-slate-500">
                Policy name must be unique.
              </p>
            </div>

            {/* Threat Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Threat Type
              </label>

              <select
                value={threatType}
                onChange={(e) => setThreatType(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0620]/80 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              >
                <option value="">
                  {threatTypes.length === 0
                    ? "No threat types available"
                    : "Select Threat Type"}
                </option>

                {threatTypes.map((threat) => (
                  <option key={threat} value={threat}>
                    {threat}
                  </option>
                ))}
              </select>

              {threatTypes.length === 0 && !loading && (
                <p className="mt-1 text-xs text-slate-500">
                  No threats were found in the threat master.
                </p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Priority
              </label>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0620]/80 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              >
                <option value="">Select Priority</option>

                <option value="Low">Low</option>

                <option value="Medium">Medium</option>

                <option value="High">High</option>
              </select>
            </div>

            {/* Default Action */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Default Action
              </label>

              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0620]/80 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              >
                <option value="">Select Default Action</option>

                <option value="Quarantine">Quarantine</option>

                <option value="Kill">Kill</option>

                <option value="Block">Block</option>

                <option value="Allow">Allow</option>
              </select>
            </div>

            {/* Description */}
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter policy description"
                rows={4}
                maxLength={200}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#0b0620]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />

              <div className="mt-1 flex justify-end">
                <span
                  className={`text-xs ${
                    description.length >= 190
                      ? "text-amber-400"
                      : "text-slate-500"
                  }`}
                >
                  {description.length}/200
                </span>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------
              FORM BUTTONS
          -------------------------------------------------- */}

          <div className="relative z-10 mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-5">
            {editingPolicyId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={handleSavePolicy}
              disabled={saving || loading}
              className="rounded-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(168,85,247,0.4)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? editingPolicyId
                  ? "Updating..."
                  : "Saving..."
                : editingPolicyId
                  ? "Update Policy"
                  : "Save Policy"}
            </button>
          </div>
        </div>

        {/* Bottom breathing room so decorative lighting remains visible */}
        <div className="h-16" />
      </div>
    </section>
  );
}