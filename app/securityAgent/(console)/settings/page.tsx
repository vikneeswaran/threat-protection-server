"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-6">
        Settings
      </h2>

      <div className="max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6">

        <div className="mb-4">
          <label className="block mb-2">
            Current Password
          </label>

          <input
            type="password"
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">
            New Password
          </label>

          <input
            type="password"
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2">
            Confirm Password
          </label>

          <input
            type="password"
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-700"
        >
          Update Password
        </button>

      </div>
    </section>
  );
}