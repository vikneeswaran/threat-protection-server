// Imports a function that returns the currently logged-in user.
import { requireSessionUser } from "@/lib/auth/session";
//  Imports the Download Installer button component.
import DownloadInstallerButton from "./components/DownloadInstallerButton";
// Imports a function to retrieve the installation token for an account.
import { getInstallationToken } from "@/lib/installation-token";
import { getInstallerData } from "@/lib/installers/installer.service";

export const metadata = {
  // Sets the browser tab title.
  title: "Installers | Kuamini Security Console",
};

// Creates an asynchronous page component. it's async, it can wait for database calls.
export default async function InstallersPage() {
  // Waits for and retrieves the logged-in user's session.
  const user = await requireSessionUser();

  // Checks whether a user is logged in.
  if (!user) {
    return (
      <section className="relative min-h-screen w-full overflow-hidden bg-[#030817] text-white">
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-slate-400">User session not found</p>
        </div>
      </section>
    );
  }

  // Retrieves the installation token using the user's account ID.
  const installationToken = await getInstallationToken(user.account_id);

  const installerData = await getInstallerData(user.account_id, "Windows");

  // Starts rendering the page UI.
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#030817] text-white">
      {/* =========================================================
          GLOBAL DASHBOARD LIGHTING (matches Dashboard page)
          ========================================================= */}

      <div
        className="pointer-events-none absolute -top-40 left-[20%] h-[520px] w-[720px] rounded-full opacity-70 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(0,190,255,0.38) 0%, rgba(0,90,180,0.16) 38%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute -right-40 -top-20 h-[600px] w-[700px] rounded-full opacity-80 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(165,0,255,0.42) 0%, rgba(100,0,180,0.18) 42%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute right-[5%] top-[18%] h-[360px] w-[500px] rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,35,145,0.24) 0%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-60 left-[25%] h-[600px] w-[800px] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(110,0,255,0.28) 0%, rgba(50,20,130,0.16) 45%, transparent 75%)",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-60 right-[5%] h-[500px] w-[700px] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,65,90,0.30) 0%, rgba(255,140,0,0.20) 38%, transparent 72%)",
        }}
      />

      {/* Neon decorative curves */}
      <div className="pointer-events-none absolute right-[-180px] top-[-180px] h-[390px] w-[800px] rotate-[-17deg] rounded-[50%] border-b-2 border-r-2 border-pink-500/80 shadow-[0_0_18px_rgba(236,72,153,0.7),0_0_45px_rgba(168,85,247,0.45)]" />
      <div className="pointer-events-none absolute right-[-150px] top-[-130px] h-[340px] w-[720px] rotate-[-17deg] rounded-[50%] border-b border-orange-400/90 shadow-[0_0_15px_rgba(251,146,60,0.8)]" />
      <div className="pointer-events-none absolute -left-[420px] bottom-[-230px] h-[720px] w-[650px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.7),0_0_70px_rgba(168,85,247,0.4)]" />
      <div className="pointer-events-none absolute -left-[390px] bottom-[-180px] h-[650px] w-[580px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-orange-400/90 shadow-[0_0_20px_rgba(251,146,60,0.9),0_0_55px_rgba(251,146,60,0.45)]" />
      <div className="pointer-events-none absolute -bottom-[350px] right-[-100px] h-[600px] w-[1000px] rotate-[-12deg] rounded-[50%] border-t-2 border-pink-500/70 shadow-[0_0_22px_rgba(236,72,153,0.75),0_0_65px_rgba(168,85,247,0.45)]" />
      <div className="pointer-events-none absolute -bottom-[315px] right-[-80px] h-[540px] w-[900px] rotate-[-12deg] rounded-[50%] border-t border-orange-400/70 shadow-[0_0_18px_rgba(251,146,60,0.7)]" />

      {/* Decorative dot grid */}
      <div
        className="pointer-events-none absolute bottom-20 left-0 h-72 w-72 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(216,70,239,0.75) 1px, transparent 1px)",
          backgroundSize: "13px 13px",
          maskImage:
            "linear-gradient(to right, black, transparent), linear-gradient(to top, black, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, black, transparent), linear-gradient(to top, black, transparent)",
        }}
      />

      {/* =========================================================
          MAIN CONTENT
          ========================================================= */}

      <div className="relative z-10 mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-1 w-10 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
              Security Operations
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[42px]">
            SecurityAgent Installers
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-200/80 sm:text-base">
            Download and install the Kuamini Security Agent on your endpoints.
          </p>
        </div>

        {/* License Status */}
        <div
          className="relative overflow-hidden rounded-2xl border border-amber-400/40 p-5 shadow-[0_0_28px_rgba(245,158,11,0.13),inset_0_0_45px_rgba(245,158,11,0.05)] sm:p-6"
          style={{
            background:
              "linear-gradient(145deg, rgba(72,50,12,0.78), rgba(35,22,7,0.94) 65%, rgba(15,10,4,0.98))",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 rounded-bl-full bg-amber-400/15 blur-2xl" />

          <h3 className="relative z-10 mb-6 text-2xl font-bold text-white sm:text-3xl">
            License Status
          </h3>

          <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border-l-4 border-slate-300 border-t border-r border-b border-slate-400/20 bg-[#1a1206]/70 p-5">
              <p className="text-sm text-amber-100/80 sm:text-base">Total</p>
              <h4 className="mt-2 text-4xl font-bold text-white">
                {installerData.license.total}
              </h4>
            </div>

            <div className="rounded-xl border-l-4 border-rose-400 border-t border-r border-b border-rose-400/20 bg-[#1a1206]/70 p-5">
              <p className="text-sm text-amber-100/80 sm:text-base">Used</p>
              <h4 className="mt-2 text-4xl font-bold text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.4)]">
                {installerData.license.used}
              </h4>
            </div>

            <div className="rounded-xl border-l-4 border-emerald-400 border-t border-r border-b border-emerald-400/20 bg-[#1a1206]/70 p-5">
              <p className="text-sm text-amber-100/80 sm:text-base">
                Available
              </p>
              <h4 className="mt-2 text-4xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]">
                {installerData.license.available}
              </h4>
            </div>
          </div>
        </div>

        {/* Installation Details */}
        <div
          className="relative overflow-hidden rounded-2xl border border-blue-400/35 p-5 shadow-[0_0_28px_rgba(30,100,255,0.12),inset_0_0_45px_rgba(40,100,255,0.05)] sm:p-6"
          style={{
            background:
              "linear-gradient(145deg, rgba(20,55,100,0.78), rgba(5,20,48,0.94) 65%, rgba(4,13,31,0.98))",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-72 rounded-bl-full bg-cyan-400/10 blur-2xl" />

          <h3 className="relative z-10 mb-6 text-2xl font-bold text-white sm:text-3xl">
            Installation Details
          </h3>

          <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border-l-4 border-blue-400 border-t border-r border-b border-blue-400/20 bg-[#06152c]/85 p-5">
              <p className="text-sm text-sky-200/80 sm:text-base">Account</p>
              <p className="mt-2 text-lg font-medium text-white">
                {/* Displays the logged-in user's full name. */}
                {user.full_name}
              </p>
            </div>

            <div className="rounded-xl border-l-4 border-purple-400 border-t border-r border-b border-purple-400/20 bg-[#06152c]/85 p-5">
              <p className="text-sm text-sky-200/80 sm:text-base">
                Agent Version
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                {installerData.installer.version}
              </p>
            </div>

            <div className="rounded-xl border-l-4 border-emerald-400 border-t border-r border-b border-emerald-400/20 bg-[#06152c]/85 p-5">
              <p className="text-sm text-sky-200/80 sm:text-base">Platform</p>
              <p className="mt-2 text-lg font-medium text-white">
                {installerData.installer.platform}
              </p>
            </div>

            <div className="rounded-xl border-l-4 border-amber-400 border-t border-r border-b border-amber-400/20 bg-[#06152c]/85 p-5">
              <p className="text-sm text-sky-200/80 sm:text-base">
                License Type
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                Enterprise
              </p>
            </div>
          </div>
        </div>

        {/* Platform Selection */}
        <div
          className="relative overflow-hidden rounded-2xl border border-purple-400/30 p-2 shadow-[0_0_24px_rgba(120,70,255,0.1)]"
          style={{
            background:
              "linear-gradient(145deg, rgba(30,45,85,0.75), rgba(11,19,46,0.92) 65%, rgba(6,12,30,0.97))",
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            <button className="rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 px-5 py-3 font-medium text-white shadow-[0_0_18px_rgba(59,130,246,0.5)]">
              🪟 Windows
            </button>

            <button className="rounded-xl px-5 py-3 font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
              🍎 macOS
            </button>

            <button className="rounded-xl px-5 py-3 font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
              🐧 Linux
            </button>
          </div>
        </div>

        {/* Download Installer */}
        <div
          className="relative overflow-hidden rounded-2xl border border-cyan-400/35 p-5 shadow-[0_0_28px_rgba(34,211,238,0.12),inset_0_0_45px_rgba(34,211,238,0.05)] sm:p-6"
          style={{
            background:
              "linear-gradient(145deg, rgba(20,58,105,0.82), rgba(7,26,58,0.96) 65%, rgba(4,15,35,0.98))",
          }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-80 rounded-bl-full bg-cyan-400/20 blur-2xl" />

          <h3 className="relative z-10 text-2xl font-bold text-white sm:text-3xl">
            Download Installer
          </h3>

          <p className="relative z-10 mt-2 text-sm text-sky-200/80 sm:text-base">
            Download the latest version of Kuamini Security Agent.
          </p>

          <div className="relative z-10 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border-l-4 border-blue-400 border-t border-r border-b border-blue-400/20 bg-[#06152c]/90 p-4">
              <p className="text-sm text-sky-200/70">Version</p>
              <p className="mt-1 font-medium text-white">
                {installerData.installer.version}
              </p>
            </div>

            <div className="rounded-xl border-l-4 border-purple-400 border-t border-r border-b border-purple-400/20 bg-[#06152c]/90 p-4">
              <p className="text-sm text-sky-200/70">Platform</p>
              <p className="mt-1 font-medium text-white">
                {installerData.installer.platform}
              </p>
            </div>

            <div className="rounded-xl border-l-4 border-amber-400 border-t border-r border-b border-amber-400/20 bg-[#06152c]/90 p-4">
              <p className="text-sm text-sky-200/70">File Size</p>
              <p className="mt-1 font-medium text-white">
                {installerData.installer.fileSize}
              </p>
            </div>
          </div>

          {/* Renders the reusable download button component. */}
          <div className="relative z-10 mt-6">
            <DownloadInstallerButton />
          </div>
        </div>

        {/* Deployment Notes */}
        <div
          className="relative overflow-hidden rounded-2xl border border-emerald-400/30 p-5 shadow-[0_0_26px_rgba(16,185,129,0.1)] sm:p-6"
          style={{
            background:
              "linear-gradient(145deg, rgba(15,55,45,0.7), rgba(6,22,20,0.93) 65%, rgba(4,12,11,0.98))",
          }}
        >
          <h3 className="text-2xl font-bold text-white sm:text-3xl">
            Deployment Notes
          </h3>

          <p className="mt-2 text-sm text-emerald-100/70 sm:text-base">
            Please review the following requirements before installing the
            Kuamini Security Agent.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-xl text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">
                ✓
              </span>
              <p className="text-slate-200">
                Run the installer with <strong>Administrator</strong>{" "}
                privileges.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">
                ✓
              </span>
              <p className="text-slate-200">
                Ensure the endpoint has an active internet connection during
                installation.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">
                ✓
              </span>
              <p className="text-slate-200">
                The endpoint will automatically register with your Kuamini
                account after installation.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">
                ✓
              </span>
              <p className="text-slate-200">
                Restart the endpoint if prompted after the installation is
                complete.
              </p>
            </div>
          </div>
        </div>

        {/* Installation Token */}
        <div
          className="relative overflow-hidden rounded-2xl border border-orange-400/40 p-5 shadow-[0_0_28px_rgba(251,146,60,0.12)] sm:p-6"
          style={{
            background:
              "linear-gradient(145deg, rgba(34,52,90,0.85), rgba(12,25,58,0.95) 65%, rgba(7,14,34,0.98))",
          }}
        >
          <h3 className="text-2xl font-bold text-white sm:text-3xl">
            Installation Token
          </h3>

          <p className="mt-2 text-sm text-sky-200/80 sm:text-base">
            This unique installation token identifies your account when
            installing the Kuamini Security Agent.
          </p>

          <div className="mt-6 rounded-lg border border-emerald-400/30 bg-[#06152c]/90 p-4 shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]">
            <p className="break-all font-mono text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">
              {/* Shows the generated installation token. */}
              {installationToken}
            </p>
          </div>
        </div>

        {/* Bottom breathing room so decorative lighting remains visible */}
        <div className="h-16" />
      </div>
    </section>
  );
}