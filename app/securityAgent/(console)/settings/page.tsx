"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  LockKeyhole,
  Monitor,
  History,
  ArrowLeft,
  MonitorSmartphone,
  Globe,
  Clock,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<
    "home" | "password" | "sessions" | "history"
  >("home");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New Password and Confirm Password do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/securityagent/user/settings/password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update password.");
        return;
      }

      toast.success("Password updated successfully.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setActiveSection("home");
      }, 1000);
    } catch {
      toast.error("Unable to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toaster position="top-right" />

      <section className="space-y-6">

        <div>
          <h2 className="text-3xl font-bold">
            Settings
          </h2>

          <p className="mt-2 text-slate-400">
            Manage your Security Agent account settings.
          </p>
        </div>

        {activeSection === "home" && (

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

            <button
              onClick={() => setActiveSection("password")}
              className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-left transition hover:border-blue-500 hover:bg-slate-800"
            >
              <LockKeyhole className="mb-4 h-10 w-10 text-blue-500" />

              <h3 className="text-xl font-semibold">
                Update Password
              </h3>

              <p className="mt-2 text-slate-400">
                Change your account password securely.
              </p>
            </button>

            <button
              onClick={() => setActiveSection("sessions")}
              className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-left transition hover:border-emerald-500 hover:bg-slate-800"
            >
              <Monitor className="mb-4 h-10 w-10 text-emerald-500" />

              <h3 className="text-xl font-semibold">
                Active Sessions
              </h3>

              <p className="mt-2 text-slate-400">
                View devices currently signed into your account.
              </p>
            </button>

            <button
              onClick={() => setActiveSection("history")}
              className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-left transition hover:border-amber-500 hover:bg-slate-800"
            >
              <History className="mb-4 h-10 w-10 text-amber-500" />

              <h3 className="text-xl font-semibold">
                Login History
              </h3>

              <p className="mt-2 text-slate-400">
                Review your recent login activity.
              </p>
            </button>

          </div>
        )}

        {activeSection === "password" && (

          <div className="flex justify-center">

            <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-lg">

              <button
                onClick={() => setActiveSection("home")}
                className="mb-6 flex items-center text-blue-400 hover:underline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
              </button>

              <h3 className="mb-8 text-3xl font-semibold">
                Update Password
              </h3>

              <div className="space-y-6">

                <div>
                  <label className="mb-2 block font-medium">
                    Current Password
                  </label>

                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) =>
                      setCurrentPassword(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    New Password
                  </label>

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) =>
                      setNewPassword(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    Confirm Password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading
                    ? "Updating..."
                    : "Update Password"}
                </button>

              </div>

            </div>

          </div>
        )}

        {activeSection === "sessions" && (

                    <div className="flex justify-center">

            <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-lg">

              <button
                onClick={() => setActiveSection("home")}
                className="mb-6 flex items-center text-blue-400 hover:underline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
              </button>

              <h3 className="mb-8 flex items-center gap-3 text-3xl font-semibold">
                <Monitor className="h-8 w-8 text-emerald-500" />
                Active Sessions
              </h3>

              <div className="rounded-xl border border-emerald-700 bg-slate-800 p-6">

                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-semibold">
                      Current Session
                    </h4>

                    <p className="mt-1 text-slate-400">
                      This device is currently logged in.
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium">
                    Active
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">

                  <div className="flex items-center gap-4">
                    <MonitorSmartphone className="h-8 w-8 text-blue-500" />

                    <div>
                      <p className="text-sm text-slate-400">
                        Device
                      </p>

                      <p className="font-medium">
                        Windows Desktop
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Globe className="h-8 w-8 text-cyan-500" />

                    <div>
                      <p className="text-sm text-slate-400">
                        Browser
                      </p>

                      <p className="font-medium">
                        Google Chrome
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Clock className="h-8 w-8 text-amber-500" />

                    <div>
                      <p className="text-sm text-slate-400">
                        Login Time
                      </p>

                      <p className="font-medium">
                        Today • 09:30 AM
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <ShieldCheck className="h-8 w-8 text-emerald-500" />

                    <div>
                      <p className="text-sm text-slate-400">
                        Status
                      </p>

                      <p className="font-medium text-emerald-400">
                        Session Active
                      </p>
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

        {activeSection === "history" && (

          <div className="flex justify-center">

            <div className="w-full max-w-5xl rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-lg">

              <button
                onClick={() => setActiveSection("home")}
                className="mb-6 flex items-center text-blue-400 hover:underline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
              </button>

              <h3 className="mb-8 flex items-center gap-3 text-3xl font-semibold">
                <History className="h-8 w-8 text-amber-500" />
                Login History
              </h3>

              <div className="overflow-hidden rounded-xl border border-slate-700">

                <table className="w-full">

                  <thead className="bg-slate-800">

                    <tr>

                      <th className="px-6 py-4 text-left">
                        Date
                      </th>

                      <th className="px-6 py-4 text-left">
                        Device
                      </th>

                      <th className="px-6 py-4 text-left">
                        Browser
                      </th>

                      <th className="px-6 py-4 text-left">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    <tr className="border-t border-slate-700">

                      <td className="px-6 py-4">
                        Today 09:30 AM
                      </td>

                      <td className="px-6 py-4">
                        Windows Desktop
                      </td>

                      <td className="px-6 py-4">
                        Chrome
                      </td>

                      <td className="px-6 py-4 text-emerald-400">
                        Success
                      </td>

                    </tr>

                    <tr className="border-t border-slate-700">

                      <td className="px-6 py-4">
                        Yesterday 06:40 PM
                      </td>

                      <td className="px-6 py-4">
                        Windows Desktop
                      </td>

                      <td className="px-6 py-4">
                        Chrome
                      </td>

                      <td className="px-6 py-4 text-emerald-400">
                        Success
                      </td>

                    </tr>

                    <tr className="border-t border-slate-700">

                      <td className="px-6 py-4">
                        Yesterday 10:05 AM
                      </td>

                      <td className="px-6 py-4">
                        Windows Desktop
                      </td>

                      <td className="px-6 py-4">
                        Chrome
                      </td>

                      <td className="px-6 py-4 text-emerald-400">
                        Success
                      </td>

                    </tr>

                  </tbody>

                </table>

              </div>

            </div>

          </div>
        )}

      </section>

    </>

  );

}