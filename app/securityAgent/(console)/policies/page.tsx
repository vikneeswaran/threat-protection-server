"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type Policy = {
  id: string;
  account_id: string;
  parent_policy_id: string | null;

  // Account to which this policy actually applies
  applies_to_account_id: string;
  applies_to_account_name?: string | null;

  // True only for the currently logged-in account's own policy
  is_current_account: boolean;

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

  // True when inherited from parent
  is_inherited?: boolean;

  // Parent account setting
  parent_allows_child_overrides?: boolean;
};
const POLICIES_PER_PAGE = 5;

type ChildAccount = {
  id: string;
  name: string;
};

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

  const [editingPolicyId, setEditingPolicyId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threatType, setThreatType] = useState("");
  const [priority, setPriority] = useState("");
  const [action, setAction] = useState("");

  // ---------------------------------------------------------
  // Account-level child override setting
  // ---------------------------------------------------------

  const [allowChildOverrides, setAllowChildOverrides] =
    useState(false);

  // ---------------------------------------------------------
  // Child accounts
  // ---------------------------------------------------------

  const [childAccounts, setChildAccounts] =
    useState<ChildAccount[]>([]);

  const [selectedChildAccountIds, setSelectedChildAccountIds] =
    useState<string[]>([]);

  const [childDropdownOpen, setChildDropdownOpen] =
    useState(false);

  // ---------------------------------------------------------
  // Search / pagination
  // ---------------------------------------------------------

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ---------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------

  type SortKey =
    | "name"
    | "threatType"
    | "priority"
    | "action"
    | "appliedTo";

  const [sortKey, setSortKey] =
    useState<SortKey>("name");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  // ---------------------------------------------------------
  // Load policies, threat types and child accounts
  // ---------------------------------------------------------

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [
          policiesResponse,
          threatTypesResponse,
          childAccountsResponse,
        ] = await Promise.all([
          fetch("/api/securityagent/policies"),
          fetch("/api/securityagent/policies/threat-types"),
          fetch("/api/securityagent/policies/child-accounts"),
        ]);

        // -----------------------------------------------------
        // Validate policies response
        // -----------------------------------------------------

        if (!policiesResponse.ok) {
          throw new Error("Failed to fetch policies");
        }

        // -----------------------------------------------------
        // Validate threat types response
        // -----------------------------------------------------

        if (!threatTypesResponse.ok) {
          throw new Error("Failed to fetch threat types");
        }

        // -----------------------------------------------------
        // Validate child accounts response
        // -----------------------------------------------------

        if (!childAccountsResponse.ok) {
          throw new Error(
            "Failed to fetch child accounts"
          );
        }

        // -----------------------------------------------------
        // Parse responses
        // -----------------------------------------------------

        const policiesData =
          await policiesResponse.json();

        const threatTypesData =
          await threatTypesResponse.json();

        const childAccountsData =
          await childAccountsResponse.json();

        // -----------------------------------------------------
        // Policies
        // -----------------------------------------------------

        /*
         * The policies API returns:
         *
         * {
         *   policies: [...],
         *   allowChildOverrides: boolean
         * }
         */

        if (
          !policiesData ||
          !Array.isArray(
            policiesData.policies
          )
        ) {
          throw new Error(
            "Invalid policies response"
          );
        }

        setPolicies(
          policiesData.policies
        );
        console.log(
  "POLICIES FROM API:",
  policiesData.policies
);

        setAllowChildOverrides(
          policiesData.allowChildOverrides === true
        );

        // -----------------------------------------------------
        // Threat types
        // -----------------------------------------------------

        /*
         * Threat types API returns an array.
         */

        if (Array.isArray(threatTypesData)) {
          setThreatTypes(
            threatTypesData
          );
        } else {
          setThreatTypes([]);
        }

        // -----------------------------------------------------
        // Child accounts
        // -----------------------------------------------------

        /*
         * Child accounts API returns:
         *
         * [
         *   {
         *     id: "...",
         *     name: "Name1"
         *   },
         *   {
         *     id: "...",
         *     name: "Name2"
         *   }
         * ]
         */

        if (Array.isArray(childAccountsData)) {
          setChildAccounts(
            childAccountsData
          );
        } else {
          setChildAccounts([]);
        }

        console.log(
          "Child accounts loaded:",
          childAccountsData
        );
      } catch (error) {
        console.error(
          "Failed to load policy data:",
          error
        );

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load policy data"
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
  if (!isPolicyForSelectedChild(policy)) {
    toast.error(
      "Please select this child account before editing its policy."
    );
    return;
  }

  if (
    policy.is_inherited &&
   policy.parent_allows_child_overrides !== true
  ) {
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

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
};    

  // ---------------------------------------------------------
  // Validate unique policy name
  // ---------------------------------------------------------

  const validateUniquePolicyName = () => {
    const normalizedName =
      name.trim().toLowerCase();

    if (!normalizedName) {
      return false;
    }

    const duplicateExists = policies.some(
      (policy) => {
        /*
         * When editing, ignore the policy currently
         * being edited.
         */

        if (
          editingPolicyId &&
          policy.id === editingPolicyId
        ) {
          return false;
        }

        return (
          policy.name.trim().toLowerCase() ===
          normalizedName
        );
      }
    );

    if (duplicateExists) {
      toast.error(
        "A policy with this name already exists."
      );

      return false;
    }

    return true;
  };

  // ---------------------------------------------------------
  // Save / update policy
  // ---------------------------------------------------------

  const handleSavePolicy = async () => {
    if (!name.trim()) {
      toast.error(
        "Policy name is required"
      );

      return;
    }

    if (!validateUniquePolicyName()) {
      return;
    }

    if (!threatType) {
      toast.error(
        "Threat type is required"
      );

      return;
    }

    if (!priority) {
      toast.error(
        "Priority is required"
      );

      return;
    }

    if (!action) {
      toast.error(
        "Default action is required"
      );

      return;
    }

    if (description.length > 200) {
      toast.error(
        "Description must be 200 characters or less"
      );

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
        const response = await fetch(
          "/api/securityagent/policies",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: editingPolicyId,
              ...payload,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to update policy"
          );
        }

        /*
         * If an inherited policy was edited, the API
         * creates a child-specific override.
         *
         * Therefore replace the original inherited
         * policy with the returned child policy.
         */

        setPolicies(
          (currentPolicies) =>
            currentPolicies.map(
              (policy) =>
                policy.id ===
                editingPolicyId
                  ? data
                  : policy
            )
        );

        toast.success(
          "Policy updated successfully"
        );

        resetForm();

        return;
      }

      // -----------------------------------------------------
      // Create new policy
      // -----------------------------------------------------

      const response = await fetch(
        "/api/securityagent/policies",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create policy"
        );
      }

      setPolicies(
        (currentPolicies) => [
          data,
          ...currentPolicies,
        ]
      );

      /*
       * Return to first page so the newly created
       * policy is visible.
       */

      setCurrentPage(1);

      toast.success(
        "Policy created successfully"
      );

      resetForm();
    } catch (error) {
      console.error(
        "Failed to save policy:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save policy"
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------
  // Delete policy
  // ---------------------------------------------------------

 // ---------------------------------------------------------
// Apply policy to all endpoints
// ---------------------------------------------------------

const handleApplyToEndpoints = async (
  policy: Policy
) => {
  if (policy.is_inherited) {
    toast.error(
      "Inherited policies cannot be directly applied."
    );
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to apply "${policy.name}" to all endpoints belonging to this account?`
  );

  if (!confirmed) {
    return;
  }

  try {
    setSaving(true);

   

   const response = await fetch(
  "/api/securityagent/policies/apply-to-endpoints",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      policyId: policy.id,
      accountId: policy.applies_to_account_id,
    }),
  }
);

const responseText = await response.text();

console.log(
  "Apply policy API status:",
  response.status
);

console.log(
  "Apply policy API response:",
  responseText
);

if (!response.ok) {
  throw new Error(
    `API error ${response.status}: ${responseText}`
  );
}

let data;

try {
  data = JSON.parse(responseText);
} catch {
  throw new Error(
    "The API returned an invalid response. Check the backend route."
  );
}

toast.success(
  data.message ||
    "Policy applied to all endpoints successfully"
);

    
  } catch (error) {
    console.error(
      "Failed to apply policy to endpoints:",
      error
    );

    toast.error(
      error instanceof Error
        ? error.message
        : "Failed to apply policy to endpoints"
    );
  } finally {
    setSaving(false);
  }
};


// ---------------------------------------------------------
// Delete policy
// ---------------------------------------------------------

const handleDelete = async (
  policy: Policy
) => {
  /*
   * Inherited parent policies cannot be deleted
   * from a child account.
   */

  if (policy.is_inherited) {
    toast.error(
      "Inherited policies cannot be deleted from a child account."
    );

    return;
  }

  const confirmed =
    window.confirm(
      `Are you sure you want to delete "${policy.name}"?`
    );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `/api/securityagent/policies?id=${encodeURIComponent(
        policy.id
      )}`,
      {
        method: "DELETE",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Failed to delete policy"
      );
    }

    setPolicies(
      (currentPolicies) =>
        currentPolicies.filter(
          (currentPolicy) =>
            currentPolicy.id !==
            policy.id
        )
    );

    if (
      editingPolicyId === policy.id
    ) {
      resetForm();
    }

    toast.success(
      "Policy deleted successfully"
    );
  } catch (error) {
    console.error(
      "Failed to delete policy:",
      error
    );

    toast.error(
      error instanceof Error
        ? error.message
        : "Failed to delete policy"
    );
  }
};

  // ---------------------------------------------------------
  // Child account dropdown helpers
  // ---------------------------------------------------------

  const toggleChildAccount = (
    childId: string
  ) => {
    setSelectedChildAccountIds(
      (current) =>
        current.includes(childId)
          ? current.filter(
              (id) => id !== childId
            )
          : [
              ...current,
              childId,
            ]
    );
  };

    const getSelectedChildAccountLabel =
    () => {
      if (
        selectedChildAccountIds.length ===
        0
      ) {
        return "Select Child Accounts";
      }

      if (
        selectedChildAccountIds.length ===
        1
      ) {
        const selectedChild =
          childAccounts.find(
            (child) =>
              child.id ===
              selectedChildAccountIds[0]
          );

        return (
          selectedChild?.name ||
          "1 Child Selected"
        );
      }

      return `${selectedChildAccountIds.length} Children Selected`;
    };

  // ---------------------------------------------------------
  // Check whether the policy belongs to a selected child
  // ---------------------------------------------------------

const isPolicyForSelectedChild = (policy: Policy) => {
  // Current account policy is always editable.
  if (policy.is_current_account) {
    return true;
  }

  // Child policy is editable only when
  // that exact child account is selected.
  return selectedChildAccountIds.includes(
    policy.applies_to_account_id
  );
};
  // ---------------------------------------------------------
  // Child override setting
  // ---------------------------------------------------------

  const handleChildOverrideChange =
    async (
      enabled: boolean
    ) => {
      /*
       * Optimistic UI update.
       */

      setAllowChildOverrides(
        enabled
      );

      try {
        setSavingSettings(true);

        const response =
          await fetch(
            "/api/securityagent/policies/settings",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                allowChildOverrides:
                  enabled,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to update policy settings"
          );
        }

        setAllowChildOverrides(
          data.allowChildOverrides === true
        );

        /*
         * Reload policies because the parent override
         * permission can affect inherited policy actions.
         */

        const policiesResponse =
          await fetch(
            "/api/securityagent/policies"
          );

        if (policiesResponse.ok) {
          const policiesData =
            await policiesResponse.json();

          if (
            Array.isArray(
              policiesData.policies
            )
          ) {
            setPolicies(
              policiesData.policies
            );
          }

          setAllowChildOverrides(
            policiesData.allowChildOverrides ===
              true
          );
        }

        toast.success(
          enabled
            ? "Child account overrides enabled"
            : "Child account overrides disabled"
        );
      } catch (error) {
        console.error(
          "Failed to update child override setting:",
          error
        );

        /*
         * Revert optimistic update.
         */

        setAllowChildOverrides(
          !enabled
        );

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update policy settings"
        );
      } finally {
        setSavingSettings(false);
      }
    };

  // ---------------------------------------------------------
  // Search filtering
  // ---------------------------------------------------------

  const filteredPolicies =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      if (!search) {
        return policies;
      }

      return policies.filter(
        (policy) => {
          const policyName =
            policy.name?.toLowerCase() ||
            "";

          const description =
            policy.description?.toLowerCase() ||
            "";

          const threat =
            policy.config?.threatType
              ?.toLowerCase() ||
            "";

          const priority =
            policy.config?.priority
              ?.toLowerCase() ||
            "";

          const action =
            policy.config?.action
              ?.toLowerCase() ||
            "";

          return (
            policyName.includes(
              search
            ) ||
            description.includes(
              search
            ) ||
            threat.includes(
              search
            ) ||
            priority.includes(
              search
            ) ||
            action.includes(
              search
            )
          );
        }
      );
    }, [
      policies,
      searchTerm,
    ]);

  // ---------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------

  const handleSort = (
    key: SortKey
  ) => {
    if (sortKey === key) {
      setSortDirection(
        (current) =>
          current === "asc"
            ? "desc"
            : "asc"
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }

    /*
     * Start from the first page after changing
     * the sort.
     */

    setCurrentPage(1);
  };

  const sortedPolicies =
    useMemo(() => {
      const sorted = [
        ...filteredPolicies,
      ];

      sorted.sort((a, b) => {
        let valueA = "";
        let valueB = "";

        switch (sortKey) {
          case "name":
            valueA =
              a.name || "";
            valueB =
              b.name || "";
            break;

          case "threatType":
            valueA =
              a.config
                ?.threatType ||
              "";

            valueB =
              b.config
                ?.threatType ||
              "";
            break;

          case "priority":
            valueA =
              a.config
                ?.priority ||
              "";

            valueB =
              b.config
                ?.priority ||
              "";
            break;

          case "action":
            valueA =
              a.config?.action ||
              "";

            valueB =
              b.config?.action ||
              "";
            break;

          case "appliedTo":
            valueA =
              a.is_inherited
                ? "Inherited"
                : "Current Account";

            valueB =
              b.is_inherited
                ? "Inherited"
                : "Current Account";

            break;
        }

        const comparison =
          valueA.localeCompare(
            valueB,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );

        return sortDirection ===
          "asc"
          ? comparison
          : -comparison;
      });

      return sorted;
    }, [
      filteredPolicies,
      sortKey,
      sortDirection,
    ]);

  // ---------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedPolicies.length /
          POLICIES_PER_PAGE
      )
    );

  const paginatedPolicies =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        POLICIES_PER_PAGE;

      return sortedPolicies.slice(
        start,
        start +
          POLICIES_PER_PAGE
      );
    }, [
      sortedPolicies,
      currentPage,
    ]);

  /*
   * If filtering/search causes the current page
   * to become invalid, return to page 1.
   */

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(1);
    }
  }, [
    currentPage,
    totalPages,
  ]);

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
    filteredPolicies.length ===
    0
      ? 0
      : (currentPage - 1) *
          POLICIES_PER_PAGE +
        1;

  const endItem = Math.min(
    currentPage *
      POLICIES_PER_PAGE,
    filteredPolicies.length
  );

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* =================================================
            PAGE HEADER
        ================================================== */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div>
            <h1 className="text-2xl font-semibold text-white">
              Policies
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Manage your security policies and
              inherited account policies.
            </p>
          </div>

          {/* =================================================
              ACCOUNT-LEVEL CHILD SETTINGS
          ================================================== */}

          <div className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 lg:min-w-[620px]">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

              {/* -------------------------------------------------
                  ALLOW CHILD OVERRIDES
              -------------------------------------------------- */}

              <label className="flex cursor-pointer items-start gap-3">

                <input
                  type="checkbox"
                  checked={
                    allowChildOverrides
                  }
                  disabled={
                    savingSettings
                  }
                  onChange={(e) =>
                    handleChildOverrideChange(
                      e.target.checked
                    )
                  }
                  className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                />

                <div>
                  <div className="text-sm font-semibold text-white">
                    Allow child account overrides
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Allow child accounts to
                    override inherited policies.
                  </p>

                  {savingSettings && (
                    <p className="mt-1 text-xs text-blue-400">
                      Saving...
                    </p>
                  )}
                </div>
              </label>

              {/* -------------------------------------------------
                  DIVIDER
              -------------------------------------------------- */}

              <div className="hidden h-10 w-px bg-slate-700 sm:block" />

              {/* -------------------------------------------------
                  CHILD ACCOUNT DROPDOWN
              -------------------------------------------------- */}

              <div className="relative min-w-[230px]">

                <button
                  type="button"
                  onClick={() =>
                    setChildDropdownOpen(
                      (current) =>
                        !current
                    )
                  }
                  disabled={
                    childAccounts.length ===
                    0
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">
                    {getSelectedChildAccountLabel()}
                  </span>

                  <span
                    className={`text-xs transition-transform ${
                      childDropdownOpen
                        ? "rotate-180"
                        : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {/* -------------------------------------------------
                    DROPDOWN MENU
                -------------------------------------------------- */}

                {childDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-full min-w-[230px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">

                    <div className="border-b border-slate-700 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Child Accounts
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-2">

                      {childAccounts.length ===
                      0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                          No child accounts found
                        </div>
                      ) : (
                        childAccounts.map(
                          (child) => {
                            const isSelected =
                              selectedChildAccountIds.includes(
                                child.id
                              );

                            return (
                              <label
                                key={
                                  child.id
                                }
                                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition hover:bg-slate-800"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    isSelected
                                  }
                                  onChange={() =>
                                    toggleChildAccount(
                                      child.id
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-blue-500"
                                />

                                <span className="truncate text-sm text-slate-200">
                                  {
                                    child.name
                                  }
                                </span>
                              </label>
                            );
                          }
                        )
                      )}

                    </div>

                    {/* -------------------------------------------------
                        SELECTED COUNT
                    -------------------------------------------------- */}

                    {selectedChildAccountIds.length >
                      0 && (
                      <div className="border-t border-slate-700 px-4 py-2.5">
                        <p className="text-xs text-blue-400">
                          {
                            selectedChildAccountIds.length
                          }{" "}
                          {selectedChildAccountIds.length ===
                          1
                            ? "child account"
                            : "child accounts"}{" "}
                          selected
                        </p>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>
          </div>
        </div>

        {/* =================================================
            POLICIES TABLE
        ================================================== */}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">

          {/* -------------------------------------------------
              TABLE HEADER / SEARCH
          -------------------------------------------------- */}

          <div className="border-b border-slate-800 px-6 py-5">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Policies
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Manage your existing security
                  policies.
                </p>
              </div>

              <div className="w-full lg:max-w-md">

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  placeholder="Search policies..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />

              </div>

            </div>
          </div>

          {/* -------------------------------------------------
              LOADING
          -------------------------------------------------- */}

          {loading ? (
            <div className="flex items-center justify-center px-6 py-16">

              <div className="text-sm text-slate-400">
                Loading policies...
              </div>

            </div>
          ) : filteredPolicies.length ===
            0 ? (

            <div className="flex items-center justify-center px-6 py-16">

              <div className="text-center">

                <p className="text-sm font-medium text-slate-300">
                  {searchTerm.trim()
                    ? "No matching policies found"
                    : "No policies found"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
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

              <div className="overflow-x-auto">

                <table className="w-full min-w-[950px] text-left text-sm">

                  <thead className="border-b border-slate-800 bg-slate-950/60">

                    <tr>

                      {/* Policy Name */}

                      <th className="px-6 py-4 font-medium text-slate-400">

                        <button
                          type="button"
                          onClick={() =>
                            handleSort(
                              "name"
                            )
                          }
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Policy Name"
                        >
                          Policy Name

                          <span className="text-xs">
                            {sortKey ===
                            "name"
                              ? sortDirection ===
                                "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>

                      </th>

                      {/* Threat Type */}

                      <th className="px-6 py-4 font-medium text-slate-400">

                        <button
                          type="button"
                          onClick={() =>
                            handleSort(
                              "threatType"
                            )
                          }
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Threat Type"
                        >
                          Threat Type

                          <span className="text-xs">
                            {sortKey ===
                            "threatType"
                              ? sortDirection ===
                                "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>

                      </th>

                      {/* Priority */}

                      <th className="px-6 py-4 font-medium text-slate-400">

                        <button
                          type="button"
                          onClick={() =>
                            handleSort(
                              "priority"
                            )
                          }
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Priority"
                        >
                          Priority

                          <span className="text-xs">
                            {sortKey ===
                            "priority"
                              ? sortDirection ===
                                "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>

                      </th>

                      {/* Default Action */}

                      <th className="px-6 py-4 font-medium text-slate-400">

                        <button
                          type="button"
                          onClick={() =>
                            handleSort(
                              "action"
                            )
                          }
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Default Action"
                        >
                          Default Action

                          <span className="text-xs">
                            {sortKey ===
                            "action"
                              ? sortDirection ===
                                "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>

                      </th>

                      {/* Applied To */}

                      <th className="px-6 py-4 font-medium text-slate-400">

                        <button
                          type="button"
                          onClick={() =>
                            handleSort(
                              "appliedTo"
                            )
                          }
                          className="flex items-center gap-2 transition hover:text-white"
                          title="Sort by Applied To"
                        >
                          Applied To

                          <span className="text-xs">
                            {sortKey ===
                            "appliedTo"
                              ? sortDirection ===
                                "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>

                      </th>

                    {/* Actions */}

                    <th className="px-6 py-4 text-center font-medium text-slate-400">
                        Actions
                    </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-800">

                   {paginatedPolicies.map(
  (policy) => {

   const canEdit =
  isPolicyForSelectedChild(policy) &&
  (
    !policy.is_inherited ||
    policy.parent_allows_child_overrides === true
  );
    const canDelete =
      !policy.is_inherited;

    return (
                          <tr
                            key={
                              policy.id
                            }
                            className="transition hover:bg-slate-800/40"
                          >

                            {/* Policy Name */}

                            <td className="px-6 py-4">

                              <div>

                                <div className="flex items-center gap-2">

                                  <span className="font-medium text-white">
                                    {
                                      policy.name
                                    }
                                  </span>

                                  {policy.is_inherited && (
                                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                                      Inherited
                                    </span>
                                  )}

                                  {!policy.is_inherited &&
                                    policy.parent_policy_id && (
                                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-400">
                                        Override
                                      </span>
                                    )}

                                </div>

                                {policy.description && (
                                  <div className="mt-1 max-w-xs truncate text-xs text-slate-500">
                                    {
                                      policy.description
                                    }
                                  </div>
                                )}

                              </div>

                            </td>

                            {/* Threat Type */}

                            <td className="px-6 py-4 text-slate-300">
                              {policy.config
                                ?.threatType ||
                                "-"}
                            </td>

                            {/* Priority */}

                            <td className="px-6 py-4">

                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                  policy.config
                                    ?.priority ===
                                  "High"
                                    ? "bg-red-500/10 text-red-400"
                                    : policy.config
                                          ?.priority ===
                                        "Medium"
                                      ? "bg-yellow-500/10 text-yellow-400"
                                      : "bg-slate-700/50 text-slate-300"
                                }`}
                              >
                                {policy.config
                                  ?.priority ||
                                  "-"}
                              </span>

                            </td>

                            {/* Default Action */}

                            <td className="px-6 py-4 text-slate-300">
                              {policy.config
                                ?.action ||
                                "-"}
                            </td>

                            {/* Applied To */}

                            <td className="px-6 py-4">

                              {policy.is_inherited ? (
  <div>
    <span className="text-sm text-blue-400">
      Inherited
    </span>

    {policy.applies_to_account_name && (
      <div className="mt-1 text-xs text-slate-500">
        Applied to {policy.applies_to_account_name}
      </div>
    )}
  </div>
) : policy.is_current_account ? (
  <div>
    <span className="text-sm text-slate-300">
      Current Account
    </span>
  </div>
) : (
  <div>
    <span className="text-sm text-purple-400">
      {policy.applies_to_account_name ||
        "Child Account"}
    </span>
  </div>
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
      !isPolicyForSelectedChild(policy)
        ? "Please select this child account"
        : policy.is_inherited &&
          policy.parent_allows_child_overrides !== true
        ? "Parent account does not allow child overrides"
        : "Edit policy"
    }
    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
  >
    Edit
  </button>

  {/* APPLY TO ENDPOINTS */}

  <button
    type="button"
    onClick={() => handleApplyToEndpoints(policy)}
    disabled={policy.is_inherited}
    title={
      policy.is_inherited
        ? "Inherited policies cannot be directly applied"
        : "Apply this policy to all endpoints in this account"
    }
    className="rounded-md border border-green-900/60 px-3 py-1.5 text-xs font-medium text-green-400 transition hover:bg-green-950/40 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-40"
  >
    Apply to Endpoints
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
    className="rounded-md border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-950/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
  >
    Delete
  </button>

</div>

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

              {/* -------------------------------------------------
                  PAGINATION
              -------------------------------------------------- */}

              <div className="flex flex-col gap-3 border-t border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="text-xs text-slate-500">
                  Showing{" "}
                  {startItem} -{" "}
                  {endItem} of{" "}
                  {
                    filteredPolicies.length
                  }{" "}
                  {
                    filteredPolicies.length ===
                    1
                      ? "policy"
                      : "policies"
                  }
                </div>

                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(
                            1,
                            page - 1
                          )
                      )
                    }
                    disabled={
                      currentPage ===
                      1
                    }
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="px-2 text-xs text-slate-400">
                    Page{" "}
                    {currentPage} of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            totalPages,
                            page + 1
                          )
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
        ================================================== */}

        <div
          id="policy-configuration"
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg"
        >

          <div className="mb-5">

            <h2 className="text-lg font-semibold text-white">
              {editingPolicyId
                ? "Edit Policy"
                : "Configure Policy"}
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              {editingPolicyId
                ? "Update the selected security policy."
                : "Create and configure a security policy."}
            </p>

          </div>

          {/* -------------------------------------------------
              FORM
          -------------------------------------------------- */}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* Policy Name */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Policy Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                placeholder="Enter policy name"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                onChange={(e) =>
                  setThreatType(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >

                <option value="">
                  {threatTypes.length ===
                  0
                    ? "No threat types available"
                    : "Select Threat Type"}
                </option>

                {threatTypes.map(
                  (threat) => (
                    <option
                      key={threat}
                      value={threat}
                    >
                      {threat}
                    </option>
                  )
                )}

              </select>

              {threatTypes.length ===
                0 &&
                !loading && (
                  <p className="mt-1 text-xs text-slate-500">
                    No threats were found
                    in the threat master.
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
                onChange={(e) =>
                  setPriority(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >

                <option value="">
                  Select Priority
                </option>

                <option value="Low">
                  Low
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="High">
                  High
                </option>

              </select>

            </div>

            {/* Default Action */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Default Action
              </label>

              <select
                value={action}
                onChange={(e) =>
                  setAction(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >

                <option value="">
                  Select Default Action
                </option>

                <option value="Quarantine">
                  Quarantine
                </option>

                <option value="Kill">
                  Kill
                </option>

                <option value="Block">
                  Block
                </option>

                <option value="Allow">
                  Allow
                </option>

              </select>

            </div>

            {/* Description */}

            <div className="lg:col-span-2">

              <label className="mb-2 block text-sm font-medium text-slate-300">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                placeholder="Enter policy description"
                rows={4}
                maxLength={200}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />

              <div className="mt-1 flex justify-end">

                <span
                  className={`text-xs ${
                    description.length >=
                    190
                      ? "text-yellow-400"
                      : "text-slate-500"
                  }`}
                >
                  {
                    description.length
                  }
                  /200
                </span>

              </div>

            </div>

          </div>

          {/* -------------------------------------------------
              FORM BUTTONS
          -------------------------------------------------- */}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-5">

            {editingPolicyId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                disabled={saving}
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={
                handleSavePolicy
              }
              disabled={
                saving ||
                loading
              }
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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

      </div>
    </div>
  );
}