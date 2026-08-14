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
// Creates an asynchronous page component.it's async, it can wait for database calls.
export default async function InstallersPage() {
// Waits for and retrieves the logged-in user's session.
  const user = await requireSessionUser();
// Checks whether a user is logged in.
  if (!user) {
    // Returns JSX if no user exists.
    return (
      // Displays a white text container with padding.
      <div className="p-8 text-white">
        {/* Shows a session not found message. */}
        User session not found.
      </div>
    );
    
  }
// Retrieves the installation token using the user's account ID.
const installationToken = await getInstallationToken(user.account_id);

const installerData = await getInstallerData(
  user.account_id,
  "Windows"
);
// Starts rendering the page UI.
  return (
<section className="space-y-8 ">
  {/*header */ }
  <div className="w-full">
    <h2 className="text-2xl font-bold text-white">
      SecurityAgent Installers
    </h2>

    <p className="mt-2 text-slate-400">
      Download and install the Kuamini Security Agent on your endpoints.
    </p>
  </div>
 <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
  <h3 className="text-2xl font-semibold">
    License Status
  </h3>

  <div className="mt-6 grid grid-cols-3 gap-6">

    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-slate-400">
        Total
      </p>

      <h4 className="mt-2 text-4xl font-bold">
          {installerData.license.total}
      </h4>
    </div>

    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-slate-400">
        Used
      </p>

      <h4 className="mt-2 text-4xl font-bold text-rose-400">
        {installerData.license.used}
      </h4>
    </div>

    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-slate-400">
        Available
      </p>

      <h4 className="mt-2 text-4xl font-bold text-emerald-400">
        {installerData.license.available}
      </h4>
    </div>

  </div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

  <h3 className="text-2xl font-semibold">
    Installation Details
  </h3>

  <div className="mt-6 grid grid-cols-2 gap-6">

    <div>
      <p className="text-slate-400">
        Account
      </p>

      <p className="mt-1 text-lg font-medium">
        {/* Displays the logged-in user's full name. */}
        {user.full_name}
      </p>
    </div>

    <div>
      <p className="text-slate-400">
        Agent Version
      </p>

      <p className="mt-1 text-lg font-medium">
        {installerData.installer.version}
      </p>
    </div>

    <div>
      <p className="text-slate-400">
        Platform
      </p>

      <p className="mt-1 text-lg font-medium">
        {installerData.installer.platform}
      </p>
    </div>

    <div>
      <p className="text-slate-400">
        License Type
      </p>

      <p className="mt-1 text-lg font-medium">
        Enterprise
      </p>
    </div>

  </div>

</div>
{/* Platform Tabs */}
{/* Platform Selection */}
<div className="rounded-2xl border border-slate-800 bg-slate-900 p-2">
  <div className="grid grid-cols-3 gap-2">

    <button className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white">
      🪟 Windows
    </button>

    <button className="rounded-xl px-5 py-3 font-medium text-slate-400 hover:bg-slate-800">
      🍎 macOS
    </button>

    <button className="rounded-xl px-5 py-3 font-medium text-slate-400 hover:bg-slate-800">
      🐧 Linux
    </button>

  </div>
</div>
{/* Download Installer */}
<div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

  <h3 className="text-2xl font-semibold">
    Download Installer
  </h3>

  <p className="mt-2 text-slate-400">
    Download the latest version of Kuamini Security Agent.
  </p>

  <div className="mt-6 grid grid-cols-3 gap-6">

    <div>
      <p className="text-slate-400">Version</p>
      <p className="mt-1 font-medium">{installerData.installer.version}</p>
    </div>

    <div>
      <p className="text-slate-400">Platform</p>
      <p className="mt-1 font-medium">{installerData.installer.platform}</p>
    </div>

    <div>
      <p className="text-slate-400">File Size</p>
      <p className="mt-1 font-medium">{installerData.installer.fileSize}</p>
    </div>

  </div>
{/* Renders the reusable download button component. */}
  <DownloadInstallerButton />

</div>
{/* Deployment Notes */}
<div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

  <h3 className="text-2xl font-semibold text-white">
    Deployment Notes
  </h3>

  <p className="mt-2 text-slate-400">
    Please review the following requirements before installing the Kuamini Security Agent.
  </p>

  <div className="mt-6 space-y-4">

    <div className="flex items-start gap-3">
      <span className="text-emerald-400 text-xl">✓</span>
      <p className="text-slate-300">
        Run the installer with <strong>Administrator</strong> privileges.
      </p>
    </div>

    <div className="flex items-start gap-3">
      <span className="text-emerald-400 text-xl">✓</span>
      <p className="text-slate-300">
        Ensure the endpoint has an active internet connection during installation.
      </p>
    </div>

    <div className="flex items-start gap-3">
      <span className="text-emerald-400 text-xl">✓</span>
      <p className="text-slate-300">
        The endpoint will automatically register with your Kuamini account after installation.
      </p>
    </div>

    <div className="flex items-start gap-3">
      <span className="text-emerald-400 text-xl">✓</span>
      <p className="text-slate-300">
        Restart the endpoint if prompted after the installation is complete.
      </p>
    </div>

  </div>

</div>
<div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
  <h3 className="text-2xl font-semibold">
    Installation Token
  </h3>

  <p className="mt-2 text-slate-400">
    This unique installation token identifies your account when installing the Kuamini Security Agent.
  </p>

  <div className="mt-6 rounded-lg border border-slate-700 bg-slate-950 p-4">
    <p className="break-all font-mono text-emerald-400">
      {/* Shows the generated installation token. */}
      {installationToken}
    </p>
  </div>
</div>
</section>
  );
}