"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
    const target = event.target as Node;

    if (
      popupRef.current &&
      !popupRef.current.contains(target) &&
      buttonRef.current &&
      !buttonRef.current.contains(target)
    ) {
      setOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () =>
    document.removeEventListener("mousedown", handleClickOutside);
}, []);
  useLayoutEffect(() => {
    if (open && buttonRef.current) {
      const rect =
        buttonRef.current.getBoundingClientRect();

      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 288,
      });
    }
  }, [open]);

  return (
    <div ref={containerRef} >
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Filter
        <span className="text-xs">▼</span>
      </button>

            {mounted &&open &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: "18rem",
              zIndex: 9999,
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            

            <h3 className="mb-4 text-lg font-semibold text-white">
              Filters
            </h3>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="all">All</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Infected */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Infection Status
                </label>

                <select
                  value={infectedFilter}
                  onChange={(e) =>
                    setInfectedFilter(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="all">All</option>
                  <option value="true">Infected</option>
                  <option value="false">Clean</option>
                </select>
              </div>

              {/* Secured */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Secured by Kuamini
                </label>

                <select
                  value={securedFilter}
                  onChange={(e) =>
                    setSecuredFilter(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="all">All</option>
                  <option value="true">Secured</option>
                  <option value="false">Not Secured</option>
                </select>
              </div>
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setInfectedFilter("all");
                    setSecuredFilter("all");
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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