"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EndpointActionsProps {
  endpointId: string;
  isOffline: boolean;
}

export default function EndpointActions({
  endpointId,
  isOffline,
}: EndpointActionsProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleDeleteEndpoint = async () => {
    if (!isOffline || deleting) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this endpoint?\n\nThis action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/securityagent/endpoints/${endpointId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to delete endpoint."
        );
      }

      setOpen(false);

      // Show success toast before navigating away.
      setToast("Endpoint deleted successfully.");

      // Give the toast a moment to be visible.
      setTimeout(() => {
        router.push("/securityAgent/endpoints");
        router.refresh();
      }, 800);
    } catch (error) {
      console.error("Delete endpoint failed:", error);

      setToast(
        error instanceof Error
          ? error.message
          : "Failed to delete endpoint."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="relative">
        {/* =====================================================
            GEAR BUTTON
            ===================================================== */}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Endpoint actions"
          aria-expanded={open}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-200 shadow-sm transition-all hover:border-cyan-400/50 hover:bg-slate-700 hover:text-cyan-300 hover:shadow-cyan-500/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path
              d="M10.3 2.8h3.4l.5 2.1a7.6 7.6 0 0 1 1.7.9l2-.8 2.4 2.4-.8 2a7.6 7.6 0 0 1 .9 1.7l2.1.5V15l-2.1.5a7.6 7.6 0 0 1-.9 1.7l.8 2-2.4 2.4-2-.8a7.6 7.6 0 0 1-1.7.9l-.5 2.1h-3.4l-.5-2.1a7.6 7.6 0 0 1-1.7-.9l-2 .8-2.4-2.4.8-2a7.6 7.6 0 0 1-.9-1.7L1.5 15v-3.4l2.1-.5a7.6 7.6 0 0 1 .9-1.7l-.8-2 2.4-2.4 2 .8a7.6 7.6 0 0 1 1.7-.9l.5-2.1Z"
            />

            <circle
              cx="12"
              cy="13.3"
              r="3"
            />
          </svg>
        </button>

        {/* =====================================================
            ACTION MENU
            ===================================================== */}

        {open && (
          <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
            {/* Menu Header */}
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="text-sm font-semibold text-white">
                Endpoint Actions
              </p>
            </div>

            {/* =================================================
                SEND HEARTBEAT
                ================================================= */}

            <button
              type="button"
              onClick={() => {
                console.info(
                  "Send heartbeat requested for endpoint:",
                  endpointId
                );

                setOpen(false);

                // Heartbeat action will be connected here.
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-cyan-400"
            >
              <span className="text-lg text-cyan-400">
                ↻
              </span>

              <span>
                <span className="block font-medium">
                  Send heartbeat
                </span>

                <span className="text-xs text-slate-500">
                  Request endpoint status
                </span>
              </span>
            </button>

            <div className="border-t border-slate-800" />

            {/* =================================================
                DELETE ENDPOINT
                ================================================= */}

            <button
              type="button"
              disabled={!isOffline || deleting}
              onClick={handleDeleteEndpoint}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                isOffline && !deleting
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  : "cursor-not-allowed text-slate-600"
              }`}
            >
              <span
                className={`text-lg ${
                  isOffline && !deleting
                    ? "text-red-400"
                    : "text-slate-600"
                }`}
              >
                🗑
              </span>

              <span>
                <span className="block font-medium">
                  {deleting
                    ? "Deleting endpoint..."
                    : "Delete endpoint"}
                </span>

                {!isOffline && (
                  <span className="text-xs text-slate-600">
                    Available only when offline
                  </span>
                )}

                {isOffline && deleting && (
                  <span className="text-xs text-slate-500">
                    Please wait...
                  </span>
                )}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* =====================================================
          SUCCESS / ERROR TOAST
          ===================================================== */}

      {toast && (
        <div className="fixed top-6 right-6 z-[100]">
          <div
            className={`flex min-w-[300px] items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
              toast === "Endpoint deleted successfully."
                ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-300"
                : "border-red-500/30 bg-red-950/90 text-red-300"
            }`}
          >
            {/* Icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20">
              {toast === "Endpoint deleted successfully." ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 12 4 4L19 6"
                  />
                </svg>
              ) : (
                <span className="text-lg">!</span>
              )}
            </div>

            {/* Message */}
            <span className="text-sm font-medium">
              {toast}
            </span>
          </div>
        </div>
      )}
    </>
  );
}