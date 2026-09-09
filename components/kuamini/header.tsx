"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()

  const navLinks = [
    {
      href: "/",
      label: "Home",
    },
    {
      href: "/about",
      label: "About",
    },
    {
      href: "/services",
      label: "Services",
    },
    {
      href: "/contact",
      label: "Contact",
    },
  ]

  return (
    <header className="relative z-50 w-full overflow-hidden border-b border-white/10 bg-[#090711]">

      {/* =========================================================
          HEADER LIGHTING
          Visual only — does not affect content or navigation
          ========================================================= */}

      {/* Main blue/purple atmospheric glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `
            radial-gradient(
              ellipse 55% 180% at 52% 0%,
              rgba(38, 83, 150, 0.42) 0%,
              rgba(38, 83, 150, 0.18) 32%,
              transparent 68%
            ),
            radial-gradient(
              ellipse 45% 150% at 82% 0%,
              rgba(100, 30, 150, 0.35) 0%,
              rgba(100, 30, 150, 0.12) 35%,
              transparent 70%
            )
          `,
        }}
      />

      {/* Cyan glow */}
      <div
        className="pointer-events-none absolute -top-24 left-[42%] h-48 w-[420px] rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(ellipse, rgba(0,220,255,0.55) 0%, rgba(0,160,255,0.18) 42%, transparent 72%)",
        }}
      />

      {/* Purple glow */}
      <div
        className="pointer-events-none absolute -top-32 right-[18%] h-56 w-[420px] rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(ellipse, rgba(150,40,255,0.65) 0%, rgba(100,30,200,0.2) 45%, transparent 75%)",
        }}
      />

      {/* =========================================================
          CURVED LIGHT STREAK
          ========================================================= */}

      <div
        className="pointer-events-none absolute -top-36 left-[54%] h-[280px] w-[760px] rotate-[-17deg] rounded-[50%] border-b-[2px] border-cyan-300/20 blur-[1px]"
      />

      <div
        className="pointer-events-none absolute -top-40 left-[57%] h-[300px] w-[780px] rotate-[-17deg] rounded-[50%] border-b-[2px] border-purple-400/40"
      />

      <div
        className="pointer-events-none absolute -top-40 left-[58%] h-[300px] w-[780px] rotate-[-17deg] rounded-[50%] border-b-[2px] border-pink-400/35 blur-[2px]"
      />

      {/* Bright central streak */}
      <div
        className="pointer-events-none absolute -top-44 left-[61%] h-[320px] w-[820px] rotate-[-17deg] rounded-[50%] border-b-[3px] border-orange-300/30 blur-[1px]"
      />

      {/* Soft pink glow around streak */}
      <div
        className="pointer-events-none absolute right-[8%] -top-24 h-52 w-80 rounded-full blur-3xl opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(255,40,150,0.6) 0%, rgba(255,40,150,0.15) 45%, transparent 75%)",
        }}
      />

      {/* =========================================================
          HEADER CONTENT
          ========================================================= */}

      <div className="relative z-10 container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">

          {/* Logo / Company Name */}
          <Link
            href="/"
            className="text-xl font-semibold text-white transition-colors hover:text-purple-300"
          >
            Kuamini Systems
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

        </div>
      </div>
    </header>
  )
}