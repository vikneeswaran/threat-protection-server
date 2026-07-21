import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import AccountDropdown from "./components/AccountDropdown";

const navItems = [
  { label: "Dashboard", href: "/securityAgent/dashboard" },
  { label: "Threats", href: "/securityAgent/threats" },
  { label: "Endpoints", href: "/securityAgent/endpoints" },
  { label: "Installers", href: "/securityAgent/installers" },
];

export default function SecurityAgentConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
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
        </div>
      </header>
<main className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 py-8">
     
        {children}
      </main>
    </div>
  );
}