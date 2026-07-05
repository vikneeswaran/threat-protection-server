import type { ReactNode } from "react"

const navItems = [
  { label: "Dashboard", href: "/securityAgent/dashboard" },
  { label: "Threats", href: "/securityAgent/threats" },
  { label: "Endpoints", href: "/securityAgent/endpoints" },
  { label: "Installers", href: "/securityAgent/installers" },
]

export default function SecurityAgentConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Kuamini Security Console</h1>
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
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
