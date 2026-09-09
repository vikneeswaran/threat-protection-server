"use client"



export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#34334D] text-white">

      {/* =========================================================
          BACKGROUND LIGHTING
          ========================================================= */}

      {/* Main purple/pink ambient lighting */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 70% 90% at 0% 100%,
              rgba(92, 45, 180, 0.22) 0%,
              rgba(92, 45, 180, 0.08) 35%,
              transparent 70%
            ),
            radial-gradient(
              ellipse 65% 80% at 100% 0%,
              rgba(180, 45, 140, 0.18) 0%,
              rgba(120, 40, 120, 0.08) 40%,
              transparent 72%
            )
          `,
        }}
      />

      {/* =========================================================
          DECORATIVE LIGHTING
          ========================================================= */}

      {/* Bottom-left purple glow */}
      <div
        className="pointer-events-none absolute -left-40 -bottom-72 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(120,45,255,0.24) 0%, rgba(90,30,180,0.10) 45%, transparent 72%)",
        }}
      />

      {/* Top-right pink glow */}
      <div
        className="pointer-events-none absolute -right-48 -top-64 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,45,170,0.20) 0%, rgba(160,30,130,0.08) 45%, transparent 72%)",
        }}
      />

      {/* Bottom-left curved light */}
      <div
        className="pointer-events-none absolute -left-48 -bottom-[390px] h-[650px] w-[850px] rotate-[-25deg] rounded-[50%]"
        style={{
          borderTop: "1px solid rgba(190,80,255,0.35)",
          boxShadow: "0 -4px 18px rgba(160,50,255,0.12)",
        }}
      />

      {/* Top-right curved light */}
      <div
        className="pointer-events-none absolute -right-52 -top-[390px] h-[650px] w-[850px] rotate-[25deg] rounded-[50%]"
        style={{
          borderBottom: "1px solid rgba(255,70,170,0.30)",
          boxShadow: "0 4px 18px rgba(255,50,170,0.10)",
        }}
      />

      {/* =========================================================
          FOOTER CONTENT
          ========================================================= */}

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16">

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">

          {/* =====================================================
              ABOUT
              ===================================================== */}

          <div>
            <h2 className="mb-5 text-xl font-semibold text-white">
              About
            </h2>

            <p className="text-base leading-relaxed text-slate-200">
              Your trusted partner in technology solutions.
            </p>
          </div>

          {/* =====================================================
              CONTACT
              ===================================================== */}

          <div>
            <h2 className="mb-5 text-xl font-semibold text-white">
              CONTACT
            </h2>

            <div className="space-y-3 text-base text-slate-200">
              <p>
                +91 7829910997
              </p>

              <p>
                contact@kuaminisystems.com
              </p>
            </div>
          </div>

          {/* =====================================================
              EMAIL CONNECTION
              ===================================================== */}

          <div>
            <label
              htmlFor="footer-email"
              className="mb-4 block text-base text-slate-200"
            >
              Enter your email address
            </label>

            <input
              id="footer-email"
              type="email"
              placeholder="Your email here"
              className="w-full rounded-lg border border-white/10 bg-white px-5 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30"
            />

            <button
              type="button"
              className="mt-4 rounded-lg bg-[#8981F5] px-7 py-3 text-base font-semibold text-white transition-all duration-300 hover:bg-[#9A91FF] hover:shadow-[0_0_25px_rgba(137,129,245,0.35)]"
            >
              Connect With Us
            </button>
          </div>

        </div>

        {/* =======================================================
            DIVIDER
            ======================================================= */}

        <div className="my-10 border-t border-white/15" />

        {/* =======================================================
            COPYRIGHT
            ======================================================= */}

        <div className="text-center">
          <p className="text-base text-slate-300">
            © 2026. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  )
}