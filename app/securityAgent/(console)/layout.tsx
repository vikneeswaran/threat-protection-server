import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import AccountDropdown from "./components/AccountDropdown";
import { requireSessionUser } from "@/lib/auth/session";
import SessionSecurityGuard from "./components/SessionSecurityGuard";

const navItems = [
  { label: "Dashboard", href: "/securityAgent/dashboard" },
  { label: "Threats", href: "/securityAgent/threats" },
  { label: "Endpoints", href: "/securityAgent/endpoints" },
  { label: "Installers", href: "/securityAgent/installers" },
  { label: "Policy Management", href: "/securityAgent/policies" },
];

export default async function SecurityAgentConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSessionUser();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050817] text-slate-100">
      <SessionSecurityGuard />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#0b1530",
            color: "#ffffff",
            border: "1px solid rgba(129, 140, 248, 0.35)",
          },
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 -top-48 h-[600px] w-[700px] rounded-full bg-purple-700/25 blur-[140px]" />
        <div className="absolute left-[35%] -top-48 h-[500px] w-[650px] rounded-full bg-cyan-500/20 blur-[130px]" />
        <div className="absolute right-[15%] -top-48 h-[500px] w-[600px] rounded-full bg-pink-600/25 blur-[130px]" />
        <div className="absolute -right-32 -top-40 h-[500px] w-[500px] rounded-full bg-orange-500/20 blur-[120px]" />
        <div className="absolute -bottom-64 left-[10%] h-[600px] w-[700px] rounded-full bg-purple-800/25 blur-[150px]" />
        <div className="absolute -bottom-64 left-[40%] h-[550px] w-[650px] rounded-full bg-blue-700/20 blur-[140px]" />
        <div className="absolute -bottom-64 right-[-10%] h-[600px] w-[700px] rounded-full bg-pink-600/20 blur-[150px]" />

        <div className="absolute inset-0 opacity-[0.045]" />
        <div className="absolute inset-0 bg-[#050817]/35" />
      </div>

      <header className="fixed left-0 right-0 top-0 z-[100] h-[96px] border-b border-white/10 bg-[#070916]/95 backdrop-blur-xl">
        <div className="relative mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Kuamini Security Console
          </h1>

          {user && (
            <div className="relative z-[99999] ml-3 flex shrink-0 items-center gap-2 sm:gap-4">
              <AccountDropdown />

              <div className="text-right sm:text-left">
                <p className="text-xs text-sky-200/80 sm:text-sm">
                  Welcome back,
                </p>
                <p className="max-w-[100px] truncate text-sm font-semibold text-white sm:max-w-none">
                  {user.full_name ?? "User"}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10 pt-[96px]">
        <div className="block w-full border-b border-white/10 bg-[#070b1d]/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-3 p-3 sm:p-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-[58px] items-center justify-center rounded-xl border border-white/10 bg-[#0b1530]/90 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition-all duration-500 hover:border-pink-400/80 hover:bg-gradient-to-r hover:from-purple-700/95 hover:via-fuchsia-600/95 hover:to-pink-500/95 hover:text-white sm:min-h-[64px] sm:text-base"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[1600px]">
          {/* CHANGED: sidebar width 320px -> 260px (removes the empty space) */}
          <aside className="relative hidden w-[260px] shrink-0 overflow-hidden border-r border-white/10 bg-[#070b1d]/90 backdrop-blur-xl lg:block">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-48 top-[25%] h-[500px] w-[500px] rounded-full bg-purple-700/20 blur-[120px]" />
              <div className="absolute -left-40 bottom-[10%] h-[450px] w-[450px] rounded-full bg-pink-600/20 blur-[120px]" />
              <div className="absolute -right-40 top-[10%] h-[450px] w-[450px] rounded-full bg-blue-600/15 blur-[120px]" />
            </div>

            <div className="relative z-10 min-h-[calc(100vh-96px)] p-5">
              <nav className="flex w-full flex-col gap-2">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    // CHANGED: w-[220px] -> w-full so buttons fill the sidebar
                    className="group relative flex h-[80px] w-full items-center overflow-hidden whitespace-nowrap rounded-xl border border-white/10 bg-[#0b1530]/90 px-5 py-4 text-sm font-semibold text-slate-200 transition-all duration-500 ease-out hover:-translate-y-[1px] hover:border-pink-400/80 hover:bg-gradient-to-r hover:from-purple-700/95 hover:via-fuchsia-600/95 hover:to-pink-500/95 hover:text-white hover:shadow-[0_0_35px_rgba(236,72,153,0.55)]"
                  >
                    <span className="pointer-events-none absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-orange-400 via-pink-400 to-purple-500 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                    <span className="relative z-10 flex h-full items-center gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sky-200 transition-all duration-500 group-hover:scale-110 group-hover:text-white">
                        {item.label === "Dashboard" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                          >
                            <path d="M3 10.5L12 3l9 7.5" />
                            <path d="M5 9.5V21h14V9.5" />
                            <path d="M9 21v-6h6v6" />
                          </svg>
                        )}

                        {item.label === "Threats" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                          >
                            <path d="M12 3L4.5 6v5.5c0 4.7 3.1 8.5 7.5 9.5 4.4-1 7.5-4.8 7.5-9.5V6L12 3z" />
                            <path d="M12 8v4" />
                            <path d="M12 16h.01" />
                          </svg>
                        )}

                        {item.label === "Endpoints" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                          >
                            <rect x="3" y="4" width="18" height="13" rx="1" />
                            <path d="M8 21h8" />
                            <path d="M12 17v4" />
                          </svg>
                        )}

                        {item.label === "Installers" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                          >
                            <path d="M12 3v12" />
                            <path d="M7 10l5 5 5-5" />
                            <path d="M4 20h16" />
                          </svg>
                        )}

                        {item.label === "Policy Management" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                          >
                            <path d="M6 4h12v16H6z" />
                            <path d="M9 8h6" />
                            <path d="M9 12h6" />
                            <path d="M9 16h6" />
                          </svg>
                        )}
                      </span>

                      <span className="leading-tight transition-all duration-500 group-hover:translate-x-1">
                        {item.label}
                      </span>
                    </span>
                  </a>
                ))}
              </nav>

              <div className="pointer-events-none mt-10 pl-3">
                <div className="mb-5 h-[3px] w-12 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />

                <div className="space-y-1.5">
                  {["Secure", "Protect", "Monitor", "Together"].map((text) => (
                    <p
                      key={text}
                      className="text-[11px] font-medium uppercase tracking-[0.38em] text-sky-200/75"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="relative min-w-0 flex-1 overflow-hidden">
            <div className="relative z-10 min-w-0 px-3 py-5 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}