import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import AccountDropdown from "./components/AccountDropdown";
import { requireSessionUser } from "@/lib/auth/session";
import SessionSecurityGuard from "./components/SessionSecurityGuard";

const navItems = [
  {
    label: "Dashboard",
    href: "/securityAgent/dashboard",
  },
  {
    label: "Threats",
    href: "/securityAgent/threats",
  },
  {
    label: "Endpoints",
    href: "/securityAgent/endpoints",
  },
  {
    label: "Installers",
    href: "/securityAgent/installers",
  },
  {
    label: "Policy Management",
    href: "/securityAgent/policies",
  },
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

      {/* ========================================================= */}
      {/* BACKGROUND LIGHTING */}
      {/* ========================================================= */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Purple top glow */}
        <div className="absolute -left-40 -top-48 h-[600px] w-[700px] rounded-full bg-purple-700/25 blur-[140px]" />

        {/* Blue / Cyan top glow */}
        <div className="absolute left-[35%] -top-48 h-[500px] w-[650px] rounded-full bg-cyan-500/20 blur-[130px]" />

        {/* Pink top glow */}
        <div className="absolute right-[15%] -top-48 h-[500px] w-[600px] rounded-full bg-pink-600/25 blur-[130px]" />

        {/* Orange top-right glow */}
        <div className="absolute -right-32 -top-40 h-[500px] w-[500px] rounded-full bg-orange-500/20 blur-[120px]" />

        {/* Bottom purple */}
        <div className="absolute -bottom-64 left-[10%] h-[600px] w-[700px] rounded-full bg-purple-800/25 blur-[150px]" />

        {/* Bottom blue */}
        <div className="absolute -bottom-64 left-[40%] h-[550px] w-[650px] rounded-full bg-blue-700/20 blur-[140px]" />

        {/* Bottom pink */}
        <div className="absolute -bottom-64 right-[-10%] h-[600px] w-[700px] rounded-full bg-pink-600/20 blur-[150px]" />

        {/* Cyan / pink diagonal lighting */}
        <div
          className="
            absolute
            -right-10
            -top-20
            h-[3px]
            w-[750px]
            rotate-[-25deg]
            bg-gradient-to-r
            from-transparent
            via-cyan-300
            to-pink-500
            opacity-80
            shadow-[0_0_25px_rgba(34,211,238,0.9)]
          "
        />

        {/* Orange / pink diagonal */}
        <div
          className="
            absolute
            right-[5%]
            top-[-20px]
            h-[3px]
            w-[600px]
            rotate-[-25deg]
            bg-gradient-to-r
            from-transparent
            via-orange-300
            to-pink-500
            opacity-80
            shadow-[0_0_25px_rgba(251,146,60,0.9)]
          "
        />

        {/* Bottom diagonal lighting */}
        <div
          className="
            absolute
            -bottom-10
            right-[5%]
            h-[3px]
            w-[750px]
            rotate-[-18deg]
            bg-gradient-to-r
            from-purple-500
            via-pink-500
            to-orange-400
            opacity-75
            shadow-[0_0_25px_rgba(236,72,153,0.9)]
          "
        />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "55px 55px",
          }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#050817]/35" />
      </div>

      {/* ========================================================= */}
      {/* FIXED HEADER */}
      {/* ========================================================= */}

      <header
        className="
          fixed
          left-0
          right-0
          top-0
          z-[100]
          h-[96px]
          overflow-visible
          border-b
          border-white/10
          bg-[#070916]/95
          backdrop-blur-xl
        "
      >
        {/* Header lighting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Blue */}
          <div className="absolute -left-20 -top-48 h-[400px] w-[550px] rounded-full bg-blue-600/15 blur-[120px]" />

          {/* Cyan */}
          <div className="absolute left-[42%] -top-48 h-[400px] w-[550px] rounded-full bg-cyan-400/20 blur-[110px]" />

          {/* Purple */}
          <div className="absolute left-[58%] -top-48 h-[400px] w-[500px] rounded-full bg-purple-600/25 blur-[110px]" />

          {/* Pink */}
          <div className="absolute right-[10%] -top-48 h-[400px] w-[500px] rounded-full bg-pink-600/20 blur-[110px]" />

          {/* Orange */}
          <div className="absolute -right-32 -top-40 h-[400px] w-[450px] rounded-full bg-orange-500/20 blur-[110px]" />

          {/* Header diagonal line */}
          <div
            className="
              absolute
              right-[10%]
              -top-16
              h-[3px]
              w-[650px]
              rotate-[-23deg]
              bg-gradient-to-r
              from-transparent
              via-orange-300
              to-pink-500
              opacity-80
              shadow-[0_0_20px_rgba(251,146,60,0.9)]
            "
          />
        </div>

        <div className="relative mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* ===================================================== */}
          {/* CONSOLE TITLE */}
          {/* ===================================================== */}

          <h1
            className="
              min-w-0
              truncate
              text-2xl
              font-bold
              tracking-tight
              text-white
              sm:text-3xl
              lg:text-4xl
            "
          >
            Kuamini Security Console
          </h1>

          {/* ===================================================== */}
          {/* ACCOUNT */}
          {/* ===================================================== */}

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

      {/* ========================================================= */}
      {/* EVERYTHING BELOW FIXED HEADER */}
      {/* ========================================================= */}

      <div className="relative z-10 pt-[96px]">

        {/* ========================================================= */}
        {/* MOBILE / NARROW NAVIGATION */}
        {/* ========================================================= */}

        <div
          className="
            block
            w-full
            border-b
            border-white/10
            bg-[#070b1d]/95
            backdrop-blur-xl
            lg:hidden
          "
        >
          <nav
            className="
              mx-auto
              grid
              w-full
              max-w-[1600px]
              grid-cols-2
              gap-3
              p-3
              sm:p-4
            "
          >
            {/* Dashboard, Threats, Endpoints, Installers */}
              {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="
                  group
                  relative
                  flex
                  min-h-[58px]
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-xl
                  border
                  border-white/10
                  bg-[#0b1530]/90
                  px-4
                  py-3
                  text-center
                  text-sm
                  font-semibold
                  text-slate-200

                  transition-all
                  duration-500
                  ease-out

                  hover:-translate-y-[1px]
                  hover:border-pink-400/80
                  hover:bg-gradient-to-r
                  hover:from-purple-700/95
                  hover:via-fuchsia-600/95
                  hover:to-pink-500/95
                  hover:text-white
                  hover:shadow-[0_0_35px_rgba(236,72,153,0.55)]

                  active:scale-[0.98]

                  sm:min-h-[64px]
                  sm:text-base
                "
              >
                {/* Left neon line */}
                <span
                  className="
                    pointer-events-none
                    absolute
                    bottom-0
                    left-0
                    top-0
                    w-1
                    bg-gradient-to-b
                    from-orange-400
                    via-pink-400
                    to-purple-500
                    opacity-0
                    transition-opacity
                    duration-500
                    group-hover:opacity-100
                  "
                />

                {/* Card glow */}
                <span
                  className="
                    pointer-events-none
                    absolute
                    -right-12
                    top-1/2
                    h-24
                    w-24
                    -translate-y-1/2
                    rounded-full
                    bg-pink-300/20
                    blur-3xl
                    opacity-0
                    transition-opacity
                    duration-500
                    group-hover:opacity-100
                  "
                />

                {/* Top light */}
                <span
                  className="
                    pointer-events-none
                    absolute
                    -top-8
                    left-1/3
                    h-12
                    w-32
                    rounded-full
                    bg-purple-400/20
                    blur-2xl
                    opacity-0
                    transition-opacity
                    duration-500
                    group-hover:opacity-100
                  "
                />

                <span className="relative z-10">
                  {item.label}
                </span>
              </a>
            ))}
          </nav>
        </div>

        {/* ========================================================= */}
        {/* DESKTOP LAYOUT */}
        {/* ========================================================= */}

        <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[1600px]">

          {/* ===================================================== */}
          {/* DESKTOP SIDEBAR */}
          {/* ===================================================== */}

          <aside
            className="
              relative
              hidden
              w-72
              shrink-0
              overflow-hidden
              border-r
              border-white/10
              bg-[#070b1d]/90
              backdrop-blur-xl
              lg:block
            "
          >
            {/* Sidebar background lighting */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">

              {/* Purple */}
              <div className="absolute -left-48 top-[25%] h-[500px] w-[500px] rounded-full bg-purple-700/20 blur-[120px]" />

              {/* Pink */}
              <div className="absolute -left-40 bottom-[10%] h-[450px] w-[450px] rounded-full bg-pink-600/20 blur-[120px]" />

              {/* Blue */}
              <div className="absolute -right-40 top-[10%] h-[450px] w-[450px] rounded-full bg-blue-600/15 blur-[120px]" />

              {/* Curved purple lighting */}
              <div
                className="
                  absolute
                  -left-48
                  top-[38%]
                  h-[330px]
                  w-[620px]
                  rotate-[35deg]
                  rounded-[50%]
                  border-t-2
                  border-purple-500/80
                  shadow-[0_0_25px_rgba(168,85,247,0.8)]
                "
              />

              {/* Curved orange lighting */}
              <div
                className="
                  absolute
                  -left-44
                  top-[44%]
                  h-[330px]
                  w-[620px]
                  rotate-[35deg]
                  rounded-[50%]
                  border-t-2
                  border-orange-400/80
                  shadow-[0_0_25px_rgba(251,146,60,0.8)]
                "
              />

              {/* Pink curved lighting */}
              <div
                className="
                  absolute
                  -left-40
                  top-[50%]
                  h-[330px]
                  w-[620px]
                  rotate-[35deg]
                  rounded-[50%]
                  border-t
                  border-pink-500/50
                  shadow-[0_0_20px_rgba(236,72,153,0.7)]
                "
              />

              {/* Dots */}
              <div
                className="absolute bottom-[12%] left-12 h-44 w-36 opacity-35"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(217,70,239,0.9) 1px, transparent 1.5px)",
                  backgroundSize: "12px 12px",
                }}
              />
            </div>

            {/* ================================================= */}
            {/* SIDEBAR CONTENT */}
            {/* ================================================= */}

            <div className="relative z-10 min-h-[calc(100vh-96px)] p-5">
              <nav className="flex flex-col gap-3">

                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="
                      group
                      relative
                      min-h-[80px]
                      overflow-hidden
                      rounded-xl
                      border
                      border-white/10
                      bg-[#0b1530]/90
                      px-5
                      py-4
                      text-sm
                      font-semibold
                      text-slate-200

                      transition-all
                      duration-500
                      ease-out

                      hover:-translate-y-[1px]
                      hover:border-pink-400/80
                      hover:bg-gradient-to-r
                      hover:from-purple-700/95
                      hover:via-fuchsia-600/95
                      hover:to-pink-500/95
                      hover:text-white
                      hover:shadow-[0_0_35px_rgba(236,72,153,0.55)]
                    "
                  >
                    {/* ========================================= */}
                    {/* LEFT NEON LINE */}
                    {/* ========================================= */}

                    <span
                      className="
                        pointer-events-none
                        absolute
                        bottom-0
                        left-0
                        top-0
                        w-1
                        bg-gradient-to-b
                        from-orange-400
                        via-pink-400
                        to-purple-500
                        opacity-0
                        transition-all
                        duration-500
                        group-hover:opacity-100
                      "
                    />

                    {/* ========================================= */}
                    {/* CARD INNER LIGHT */}
                    {/* ========================================= */}

                    <span
                      className="
                        pointer-events-none
                        absolute
                        -right-16
                        top-1/2
                        h-32
                        w-32
                        -translate-y-1/2
                        rounded-full
                        bg-pink-300/30
                        blur-3xl
                        opacity-0
                        transition-all
                        duration-500
                        group-hover:opacity-100
                      "
                    />

                    {/* ========================================= */}
                    {/* TOP LIGHT */}
                    {/* ========================================= */}

                    <span
                      className="
                        pointer-events-none
                        absolute
                        -top-10
                        left-1/3
                        h-16
                        w-40
                        rounded-full
                        bg-purple-400/20
                        blur-2xl
                        opacity-0
                        transition-opacity
                        duration-500
                        group-hover:opacity-100
                      "
                    />

                    {/* ========================================= */}
                    {/* CARD CONTENT */}
                    {/* ========================================= */}

                    <span className="relative z-10 flex h-full items-center gap-4">

                      {/* Icon */}
                      <span
                        className="
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          text-sky-200

                          transition-all
                          duration-500

                          group-hover:scale-110
                          group-hover:text-white
                          group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]
                        "
                      >

                        {/* Dashboard icon */}
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

                        {/* Threats icon */}
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

                        {/* Endpoints icon */}
                        {item.label === "Endpoints" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                          >
                            <rect
                              x="3"
                              y="4"
                              width="18"
                              height="13"
                              rx="1"
                            />
                            <path d="M8 21h8" />
                            <path d="M12 17v4" />
                          </svg>
                        )}

                        {/* Installers icon */}
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

                        {/* Policy Management icon */}
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

                      {/* Label */}
                      <span
                        className="
                          leading-tight
                          transition-all
                          duration-500
                          group-hover:translate-x-1
                        "
                      >
                        {item.label}
                      </span>
                    </span>
                  </a>
                ))}
              </nav>

              {/* ================================================= */}
              {/* SIDEBAR SLOGAN */}
              {/* ================================================= */}

              <div className="pointer-events-none mt-14 pl-3">

                <div
                  className="
                    mb-5
                    h-[3px]
                    w-12
                    bg-gradient-to-r
                    from-cyan-400
                    via-purple-500
                    to-pink-500
                    shadow-[0_0_15px_rgba(168,85,247,0.9)]
                  "
                />

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-sky-200/75">
                    Secure
                  </p>

                  <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-sky-200/75">
                    Protect
                  </p>

                  <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-sky-200/75">
                    Monitor
                  </p>

                  <p className="text-[11px] font-medium uppercase tracking-[0.38em] text-sky-200/75">
                    Together
                  </p>
                </div>

                <div
                  className="
                    mt-5
                    h-[2px]
                    w-10
                    bg-gradient-to-r
                    from-pink-500
                    to-orange-400
                    shadow-[0_0_12px_rgba(236,72,153,0.9)]
                  "
                />
              </div>
            </div>
          </aside>

          {/* ===================================================== */}
          {/* MAIN CONTENT */}
          {/* ===================================================== */}

          <main className="relative min-w-0 flex-1 overflow-hidden">

            {/* Main content lighting */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">

              {/* Cyan */}
              <div className="absolute -left-20 -top-48 h-[500px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px]" />

              {/* Purple */}
              <div className="absolute right-[-150px] -top-48 h-[500px] w-[550px] rounded-full bg-purple-600/15 blur-[140px]" />

              {/* Pink */}
              <div className="absolute right-[-180px] top-[35%] h-[500px] w-[500px] rounded-full bg-pink-600/10 blur-[140px]" />

              {/* Bottom purple */}
              <div className="absolute -bottom-64 left-[20%] h-[550px] w-[650px] rounded-full bg-purple-700/15 blur-[150px]" />

              {/* Orange */}
              <div className="absolute -bottom-48 right-[5%] h-[450px] w-[500px] rounded-full bg-orange-500/10 blur-[140px]" />

              {/* Bottom diagonal */}
              <div
                className="
                  absolute
                  -bottom-10
                  right-[-5%]
                  h-[3px]
                  w-[700px]
                  rotate-[-15deg]
                  bg-gradient-to-r
                  from-purple-500
                  via-pink-500
                  to-orange-400
                  opacity-70
                  shadow-[0_0_25px_rgba(236,72,153,0.8)]
                "
              />
            </div>

            {/* Page content */}
            <div className="relative z-10 min-w-0 px-3 py-5 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}