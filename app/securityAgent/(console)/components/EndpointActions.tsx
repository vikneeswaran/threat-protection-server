"use client";

import { useState } from "react";

interface EndpointActionsProps {
  endpointId: string;
  isOffline: boolean;
}

export default function EndpointActions({
  endpointId,
  isOffline,
}: EndpointActionsProps) {
  const [open, setOpen] = useState(false);

  return (
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
            disabled={!isOffline}
            onClick={() => {
              if (!isOffline) {
                return;
              }

              console.info(
                "Delete requested for endpoint:",
                endpointId
              );

              setOpen(false);

              // Delete action will be connected here.
            }}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
              isOffline
                ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                : "cursor-not-allowed text-slate-600"
            }`}
          >
            <span
              className={`text-lg ${
                isOffline
                  ? "text-red-400"
                  : "text-slate-600"
              }`}
            >
              🗑
            </span>

            <span>
              <span className="block font-medium">
                Delete endpoint
              </span>

              {!isOffline && (
                <span className="text-xs text-slate-600">
                  Available only when offline
                </span>
              )}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}