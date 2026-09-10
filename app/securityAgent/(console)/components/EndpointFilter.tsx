"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EndpointFilterProps = {
  statusFilter: string;
  infectedFilter: string;
  securedFilter: string;

  setStatusFilter: (value: string) => void;
  setInfectedFilter: (value: string) => void;
  setSecuredFilter: (value: string) => void;
};

export default function EndpointFilter({
  statusFilter,
  infectedFilter,
  securedFilter,
  setStatusFilter,
  setInfectedFilter,
  setSecuredFilter,
}: EndpointFilterProps) {
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [mounted, setMounted] = useState(false);

  const [position, setPosition] = useState({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target;

      if (
        target instanceof globalThis.Node &&
        popupRef.current &&
        !popupRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 288,
      });
    }
  }, [open]);

  return (
    <div ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#06152c]/85 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-400/50 hover:bg-white/5"
      >
        Filter
        <span className="text-xs text-cyan-300">▼</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: "18rem",
              zIndex: 9999,
              background:
                "linear-gradient(145deg, rgba(20,58,105,0.95), rgba(7,26,58,0.98) 65%, rgba(4,15,35,0.99))",
            }}
            className="rounded-xl border border-cyan-400/30 p-5 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
          >
            <h3 className="mb-4 text-lg font-semibold text-white">Filters</h3>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-sky-200/80">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#06152c]/90 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="all">All</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Infected */}
              <div>
                <label className="mb-1 block text-sm font-medium text-sky-200/80">
                  Infection Status
                </label>

                <select
                  value={infectedFilter}
                  onChange={(e) => setInfectedFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#06152c]/90 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="all">All</option>
                  <option value="true">Infected</option>
                  <option value="false">Clean</option>
                </select>
              </div>

              {/* Secured */}
              <div>
                <label className="mb-1 block text-sm font-medium text-sky-200/80">
                  Secured by Kuamini
                </label>

                <select
                  value={securedFilter}
                  onChange={(e) => setSecuredFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#06152c]/90 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="all">All</option>
                  <option value="true">Secured</option>
                  <option value="false">Not Secured</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setInfectedFilter("all");
                    setSecuredFilter("all");
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-[0_0_14px_rgba(168,85,247,0.4)] transition hover:opacity-90"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}