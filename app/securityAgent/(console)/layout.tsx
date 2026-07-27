import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import AccountDropdown from "./components/AccountDropdown";
import { requireSessionUser } from "@/lib/auth/session";

const navItems = [
  { label: "Dashboard", href: "/securityAgent/dashboard" },
  { label: "Threats", href: "/securityAgent/threats" },
  { label: "Endpoints", href: "/securityAgent/endpoints" },
  { label: "Installers", href: "/securityAgent/installers" },
];

export default async function SecurityAgentConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSessionUser();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#0f172a",
            color: "#ffffff",
            border: "1px solid #334155",
          },
        }}
      />
<header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
  <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:h-32 lg:flex-row lg:items-center lg:justify-between lg:px-8">
    {/* Left */}
 <h1 className="text-2xl font-bold tracking-tight lg:text-4xl">
  Kuamini Security Console
</h1>

    {/* Right */}
   <div className="flex h-full flex-col items-end justify-center">
   <div className="flex flex-wrap items-center gap-2 lg:gap-3">
    {navItems.map((item) => (
      <a
        key={item.href}
        href={item.href}
        className="flex h-12 items-center rounded-lg border border-slate-700 px-6 text-sm font-medium hover:bg-slate-800 transition-colors"
      >
        {item.label}
      </a>
    ))}

    <AccountDropdown />
  </div>

  {user && (
<div className="mt-2 text-left lg:text-right">
<span className="text-sm text-slate-400">
        Welcome back,
      </span>{" "}
      <span className="text-lg font-semibold text-white">
         {user.full_name ?? "User"}
      </span>
    </div>
  )}
</div>
  </div>
</header>
  <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">   
        {children}
      </main>
    </div>
  );
}