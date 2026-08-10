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
<header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900">
  <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6">

    {/* Left */}
    <h1 className="text-4xl font-bold">
      Kuamini Security Console
    </h1>

    {/* Right */}
   {user && (
  <div className="flex items-center gap-4">
    {/* Account Dropdown */}
    <AccountDropdown />

    {/* Welcome Message */}
    <div className="text-left">
      <p className="text-sm text-slate-400">
        Welcome back,
      </p>
      <p className="font-semibold text-white">
        {user.full_name ?? "User"}
      </p>
    </div>
  </div>
)}
  </div>
</header>
<div className="mx-auto flex max-w-[1600px]">
  {/* Sidebar */}
  <aside className="w-64 border-r border-slate-800 bg-slate-900 min-h-[calc(100vh-96px)]">

  {/* Top */}
  <div className="p-5">
    <nav className="flex flex-col gap-3">
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded-lg border border-slate-700 px-5 py-4 text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          {item.label}
        </a>
        
      ))}
       
    </nav>
    
  </div>

  {/* Bottom */}
  

   
  

</aside>
  <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
  {children}
</main>
    </div>
    </div>
  );
}