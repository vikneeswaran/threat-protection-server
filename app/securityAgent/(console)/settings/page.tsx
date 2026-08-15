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
  UserPlus,
} from "lucide-react";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<
    "home" | "password" | "sessions" | "history" | "createAccount" |"createUser"
  >("home");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [childFullName, setChildFullName] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [childConfirmPassword, setChildConfirmPassword] = useState("");
  const [accountData, setAccountData] = useState<any>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [childLicenses, setChildLicenses] = useState("");
  const [noLicensesMessage, setNoLicensesMessage] = useState(false);
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userConfirmPassword, setUserConfirmPassword] = useState("");
 const [userType, setUserType] = useState<"admin" | "viewer">("viewer");


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

  async function loadAccountData() {
  try {
    setAccountLoading(true);
    setAccountError("");

    const response = await fetch(
      "/api/securityagent/user/account",
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setAccountError(
        result.error ||
          "Failed to load account information."
      );

      return null;
    }

    setAccountData(result.account);

    // IMPORTANT:
    // Return the account data to the caller.
    return result.account;

  } catch (error) {
    console.error(
      "Account information error:",
      error
    );

    setAccountError(
      "Unable to load account information."
    );

    return null;

  } finally {
    setAccountLoading(false);
  }
}

async function handleCreateChildAccount() {
  if (!childFullName || !childEmail || !childPassword || !childConfirmPassword) {
    toast.error("Please fill all required fields.");
    return;
  }

  if (childPassword !== childConfirmPassword) {
    toast.error("Password and Confirm Password do not match.");
    return;
  }

if (!accountData) {
  toast.error("Account information is not loaded.");
  return;
}

const totalLicenses = Number(
  accountData.totalLicenses || 0
);

const availableLicenses = Number(
  accountData.availableLicenses || 0
);

const maxBy50Percent = Math.floor(
  totalLicenses * 0.5
);

const maxChildLicenses = Math.min(
  maxBy50Percent,
  availableLicenses
);



  if (!childLicenses || Number(childLicenses) <= 0) {
    toast.error("Please enter at least 1 license.");
    return;
  }

  if (Number(childLicenses) > maxChildLicenses) {
    toast.error(
      `You can allocate a maximum of ${maxChildLicenses} license(s) to this child account.`
    );
    return;
  }

  try {
    setLoading(true);

    const response = await fetch(
      "/api/securityagent/user/child-account",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: childFullName,
          email: childEmail,
          password: childPassword,
          confirmPassword: childConfirmPassword,
          licenses: Number(childLicenses),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      toast.error(
        result.message || "Failed to create child account."
      );
      return;
    }

    toast.success(
      "Child account created successfully."
    );

    console.log("Child account created:", result);

    // Clear form
    setChildFullName("");
    setChildEmail("");
    setChildPassword("");
    setChildConfirmPassword("");
    setChildLicenses("");

    // Refresh license information
    await loadAccountData();

  } catch (error) {
    console.error(
      "Create child account error:",
      error
    );

    toast.error(
      "Unable to create child account."
    );
  } finally {
    setLoading(false);
  }
}

async function handleCreateUser() {
  if (
    !userFullName.trim() ||
    !userEmail.trim() ||
    !userPassword ||
    !userConfirmPassword
  ) {
    toast.error("Please fill all fields.");
    return;
  }

  if (userPassword !== userConfirmPassword) {
    toast.error("Password and Confirm Password do not match.");
    return;
  }

  try {
    setLoading(true);

    const response = await fetch(
      "/api/securityagent/user/create-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: userFullName,
          email: userEmail,
          password: userPassword,
          confirmPassword: userConfirmPassword,
          userType,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      toast.error(
        result.message || "Failed to create user."
      );
      return;
    }

    toast.success("User created successfully.");

    setUserFullName("");
    setUserEmail("");
    setUserPassword("");
    setUserConfirmPassword("");
    setUserType("viewer");

    setTimeout(() => {
      setActiveSection("home");
    }, 1000);
  } catch (error) {
    console.error("Create User Error:", error);
    toast.error("Unable to create user.");
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

         
     <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-4">

            {/* Update Password */}
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


            {/* Active Sessions */}
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


            {/* Login History */}
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


            
       
{/* Create Account */}
<button
  onClick={async () => {
    setNoLicensesMessage(false);

    const account = await loadAccountData();

    if (!account) {
      return;
    }

const totalLicenses = Number(
  account.totalLicenses || 0
);

const availableLicenses = Number(
  account.availableLicenses || 0
);

const maxBy50Percent = Math.floor(
  totalLicenses * 0.5
);

const maxChildLicenses = Math.min(
  maxBy50Percent,
  availableLicenses
);

if (maxChildLicenses <= 0) {
  setNoLicensesMessage(true);
  return;
}

    setActiveSection("createAccount");
  }}
  className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-left transition hover:border-blue-500 hover:bg-slate-800"
>
  <UserPlus className="mb-4 h-10 w-10 text-blue-500" />

  <h3 className="text-xl font-semibold">
    Create Account
  </h3>

  <p className="mt-2 text-slate-400">
    Create a child account under your current account.
  </p>

  {/* No licenses message */}
  {noLicensesMessage && (
    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
      <p className="font-medium text-red-400">
        No licenses available
      </p>

      <p className="mt-1 text-sm text-slate-400">
        You have used all licenses allocated
        to your account.
      </p>
    </div>
  )}
</button>

{/* Create User */}
    <button
      onClick={() => setActiveSection("createUser")}
      className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-left transition hover:border-cyan-500 hover:bg-slate-800"
    >
      <UserPlus className="mb-4 h-10 w-10 text-cyan-500" />

      <h3 className="text-xl font-semibold">
        Create User
      </h3>

      <p className="mt-2 text-slate-400">
        Create another user under your current account.
      </p>
    </button>

          </div>
        )}
                {activeSection === "createAccount" && (

  <div className="flex justify-center">

    <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-lg">

      <button
        onClick={() => setActiveSection("home")}
        className="mb-6 flex items-center text-blue-400 hover:underline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Settings
      </button>

      <h3 className="mb-2 flex items-center gap-3 text-3xl font-semibold">
        <UserPlus className="h-8 w-8 text-blue-500" />
        Create Account
      </h3>

      <p className="mb-8 text-slate-400">
        Create a child account under your parent account.
      </p>

      <div className="space-y-6">



        {/* Full Name */}
        <div>
          <label className="mb-2 block font-medium">
            Full Name
          </label>

          <input
            type="text"
            value={childFullName}
            onChange={(e) =>
              setChildFullName(e.target.value)
            }
            placeholder="Enter full name"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-2 block font-medium">
            Email
          </label>

          <input
            type="email"
            value={childEmail}
            onChange={(e) =>
              setChildEmail(e.target.value)
            }
            placeholder="Enter email address"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <label className="mb-2 block font-medium">
            Password
          </label>

          <input
            type="password"
            value={childPassword}
            onChange={(e) =>
              setChildPassword(e.target.value)
            }
            placeholder="Enter password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="mb-2 block font-medium">
            Confirm Password
          </label>

          <input
            type="password"
            value={childConfirmPassword}
            onChange={(e) =>
              setChildConfirmPassword(e.target.value)
            }
            placeholder="Confirm password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
          />
        </div>
    
        {/* Licenses to Allocate */}
        <div>
          <label className="mb-2 block font-medium">
            Licenses to Allocate
          </label>

          <input
            type="number"
            min="1"
            value={childLicenses}
   onChange={(e) => {
  const value = Number(e.target.value);

  if (accountData) {
    const totalLicenses = Number(
      accountData.totalLicenses || 0
    );

    const availableLicenses = Number(
      accountData.availableLicenses || 0
    );

    const maxBy50Percent = Math.floor(
      totalLicenses * 0.5
    );

    const maxChildLicenses = Math.min(
      maxBy50Percent,
      availableLicenses
    );

    if (value > maxChildLicenses) {
      toast.error(
        `You can allocate a maximum of ${maxChildLicenses} license(s) to this child account.`
      );
      return;
    }
  }

  setChildLicenses(e.target.value);
}}
            placeholder="Enter number of licenses"
            className="w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-blue-500 focus:outline-none"
          />

   {accountData && (
  <div className="mt-2 space-y-1">
    <p className="text-sm text-slate-400">
      Maximum licenses for child:{" "}
      <span className="font-semibold text-blue-400">
        {Math.min(
          Math.floor(
            Number(accountData.totalLicenses || 0) * 0.5
          ),
          Number(accountData.availableLicenses || 0)
        )}
      </span>
    </p>
  </div>
)}
        </div>

        <button
          type="button"
          onClick={handleCreateChildAccount}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

      </div>
    </div>
  </div>
)}

{/* ======================================== */}
{/* CREATE USER SECTION                      */}
{/* ======================================== */}

{activeSection === "createUser" && (

  <div className="flex justify-center">

    <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-lg">

      {/* Back button */}
      <button
        onClick={() => setActiveSection("home")}
        className="mb-6 flex items-center text-blue-400 hover:underline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Settings
      </button>

      {/* Heading */}
      <h3 className="mb-2 flex items-center gap-3 text-3xl font-semibold">
        <UserPlus className="h-8 w-8 text-cyan-500" />
        Create User
      </h3>

      <p className="mb-8 text-slate-400">
        Create a new user under your current account.
      </p>

      <div className="space-y-6">

        {/* Full Name */}
        <div>
          <label className="mb-2 block font-medium">
            Full Name
          </label>

          <input
            type="text"
            value={userFullName}
            onChange={(e) =>
              setUserFullName(e.target.value)
            }
            placeholder="Enter full name"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-2 block font-medium">
            Email
          </label>

          <input
            type="email"
            value={userEmail}
            onChange={(e) =>
              setUserEmail(e.target.value)
            }
            placeholder="Enter email address"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <label className="mb-2 block font-medium">
            Password
          </label>

          <input
            type="password"
            value={userPassword}
            onChange={(e) =>
              setUserPassword(e.target.value)
            }
            placeholder="Enter password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="mb-2 block font-medium">
            Confirm Password
          </label>

          <input
            type="password"
            value={userConfirmPassword}
            onChange={(e) =>
              setUserConfirmPassword(e.target.value)
            }
            placeholder="Confirm password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* User Type */}
        <div>
          <label className="mb-2 block font-medium">
            User Type
          </label>

          <select
            value={userType}
            onChange={(e) =>
              setUserType(
                e.target.value as "admin" | "viewer"
              )
            }
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 focus:border-cyan-500 focus:outline-none"
          >
            <option value="viewer">
              Non-Admin
            </option>

            <option value="admin">
              Admin
            </option>
          </select>
        </div>

        {/* Create User Button */}
        <button
          type="button"
          onClick={handleCreateUser}
          disabled={loading}
          className="rounded-lg bg-cyan-600 px-6 py-3 font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create User"}
        </button>

      </div>

    </div>

  </div>
)}



{/* PASSWORD SECTION                         */}


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
