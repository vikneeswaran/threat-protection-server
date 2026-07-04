"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/services", label: "Services" },
    { href: "/contact", label: "Contact" },
  ]

  return (
    <header className="w-full bg-gradient-to-r from-[#d5dfff] via-[#ebe4ff] to-[#d5dfff] py-4">
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold text-gray-800">
          Kuamini Systems
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[#673de6] ${
                pathname === link.href ? "text-[#673de6] underline underline-offset-4" : "text-gray-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
