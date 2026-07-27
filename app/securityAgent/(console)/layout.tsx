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
      <div className="mx-auto max-w-[1600px] px-8 py-7 flex flex-wrap items-center justify-between gap-4">
         <h1 className="text-4xl font-bold tracking-tight">
            Kuamini Security Console
          </h1>

          <div className="flex items-center gap-3">
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
                >
                  {item.label}
                </a>
              ))}
            </nav>

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
</header>
  <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">   
        {children}
      </main>
    </div>
  );
}