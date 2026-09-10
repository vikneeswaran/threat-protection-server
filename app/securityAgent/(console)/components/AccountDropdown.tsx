"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function AccountDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  async function handleLogout() {
    try {
      const response = await fetch(
        "/api/securityagent/auth/logout",
        {
          method: "POST",
        }
      );

      if (response.ok) {
        toast.success("Logged out successfully.");

        setTimeout(() => {
          window.location.href = "/securityAgent/auth/login";
        }, 100);
      } else {
        toast.error("Logout failed.");
      }
    } catch {
      toast.error("Unable to logout.");
    }
  }

  return (
    <div className="relative z-[99999]">
      {/* Account Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          relative z-[99999]
          flex h-12 items-center
          rounded-lg
          border border-slate-700
          bg-transparent
          px-6
          text-sm font-medium
          text-white
          transition-all duration-200
          hover:border-purple-400/60
          hover:bg-white/5
        "
      >
        Account
        <span
          className={`ml-2 text-xs transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="
            absolute
            right-0
            top-full
            z-[999999]
            mt-2
            w-48
            overflow-hidden
            rounded-lg
            border border-slate-700
            bg-[#0B1020]
            shadow-2xl
            shadow-black/50
          "
        >
          {/* About */}
          <Link
            href="/securityAgent/about"
            onClick={() => setIsOpen(false)}
            className="
              block
              px-4 py-3
              text-sm
              font-medium
              text-slate-200
              transition-colors
              hover:bg-purple-600/20
              hover:text-white
            "
          >
            About
          </Link>

          {/* Settings */}
          <Link
            href="/securityAgent/settings"
            onClick={() => setIsOpen(false)}
            className="
              block
              px-4 py-3
              text-sm
              font-medium
              text-slate-200
              transition-colors
              hover:bg-purple-600/20
              hover:text-white
            "
          >
            Settings
          </Link>

          {/* Divider */}
          <div className="border-t border-slate-700/70" />

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="
              block
              w-full
              px-4 py-3
              text-left
              text-sm
              font-medium
              text-slate-200
              transition-colors
              hover:bg-red-500/10
              hover:text-red-300
            "
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}