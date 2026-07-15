"use client";

import { useState } from "react";
import Link from "next/link";

export default function AccountDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
      >
        Account ▾
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          <Link
            href="/securityAgent/about"
            className="block px-4 py-2 text-sm hover:bg-slate-800"
          >
            About
          </Link>

          <Link
            href="/securityAgent/settings"
            className="block px-4 py-2 text-sm hover:bg-slate-800"
          >
            Settings
          </Link>

          <button
            type="button"
            onClick={async () => {
              try {
                const response = await fetch(
                  "/api/securityagent/auth/logout",
                  {
                    method: "POST",
                  }
                );

                if (response.ok) {
                  window.location.href = "/securityAgent/auth/login";
                } else {
                  alert("Logout failed.");
                }
              } catch {
                alert("Unable to logout.");
              }
            }}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}