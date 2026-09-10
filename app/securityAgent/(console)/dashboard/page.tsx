import { requireSessionUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/dashboard.service";

export const metadata = {
  title: "Dashboard | Kuamini Security Agent",
};

export default async function SecurityAgentDashboardPage() {
  const user = await requireSessionUser();

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-center text-slate-400">
          User session not found
        </p>
      </div>
    );
  }

  const dashboard = await getDashboardData(user.account_id);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#030817] text-white">
      {/* =========================================================
          GLOBAL DASHBOARD LIGHTING
          ========================================================= */}

      {/* Blue atmospheric glow */}
      <div
        className="pointer-events-none absolute -top-40 left-[20%] h-[520px] w-[720px] rounded-full opacity-70 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(0,190,255,0.38) 0%, rgba(0,90,180,0.16) 38%, transparent 72%)",
        }}
      />

      {/* Purple glow - top right */}
      <div
        className="pointer-events-none absolute -right-40 -top-20 h-[600px] w-[700px] rounded-full opacity-80 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(165,0,255,0.42) 0%, rgba(100,0,180,0.18) 42%, transparent 72%)",
        }}
      />

      {/* Pink glow */}
      <div
        className="pointer-events-none absolute right-[5%] top-[18%] h-[360px] w-[500px] rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,35,145,0.24) 0%, transparent 72%)",
        }}
      />

      {/* Bottom purple glow */}
      <div
        className="pointer-events-none absolute -bottom-60 left-[25%] h-[600px] w-[800px] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(110,0,255,0.28) 0%, rgba(50,20,130,0.16) 45%, transparent 75%)",
        }}
      />

      {/* Bottom orange/pink glow */}
      <div
        className="pointer-events-none absolute -bottom-60 right-[5%] h-[500px] w-[700px] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,65,90,0.30) 0%, rgba(255,140,0,0.20) 38%, transparent 72%)",
        }}
      />

      {/* =========================================================
          NEON DECORATIVE CURVES
          ========================================================= */}

      {/* Top-right neon sweep */}
      <div className="pointer-events-none absolute right-[-180px] top-[-180px] h-[390px] w-[800px] rotate-[-17deg] rounded-[50%] border-b-2 border-r-2 border-pink-500/80 shadow-[0_0_18px_rgba(236,72,153,0.7),0_0_45px_rgba(168,85,247,0.45)]" />

      <div className="pointer-events-none absolute right-[-150px] top-[-130px] h-[340px] w-[720px] rotate-[-17deg] rounded-[50%] border-b border-orange-400/90 shadow-[0_0_15px_rgba(251,146,60,0.8)]" />

      {/* Left-bottom neon curve */}
      <div className="pointer-events-none absolute -left-[420px] bottom-[-230px] h-[720px] w-[650px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.7),0_0_70px_rgba(168,85,247,0.4)]" />

      <div className="pointer-events-none absolute -left-[390px] bottom-[-180px] h-[650px] w-[580px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-orange-400/90 shadow-[0_0_20px_rgba(251,146,60,0.9),0_0_55px_rgba(251,146,60,0.45)]" />

      {/* Bottom-right neon sweep */}
      <div className="pointer-events-none absolute -bottom-[350px] right-[-100px] h-[600px] w-[1000px] rotate-[-12deg] rounded-[50%] border-t-2 border-pink-500/70 shadow-[0_0_22px_rgba(236,72,153,0.75),0_0_65px_rgba(168,85,247,0.45)]" />

      <div className="pointer-events-none absolute -bottom-[315px] right-[-80px] h-[540px] w-[900px] rotate-[-12deg] rounded-[50%] border-t border-orange-400/70 shadow-[0_0_18px_rgba(251,146,60,0.7)]" />

      {/* =========================================================
          DECORATIVE DOT GRID
          ========================================================= */}

      <div
        className="pointer-events-none absolute bottom-20 left-0 h-72 w-72 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(216,70,239,0.75) 1px, transparent 1px)",
          backgroundSize: "13px 13px",
          maskImage:
            "linear-gradient(to right, black, transparent), linear-gradient(to top, black, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, black, transparent), linear-gradient(to top, black, transparent)",
        }}
      />

      {/* =========================================================
          MAIN CONTENT
          ========================================================= */}

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* =======================================================
            DASHBOARD TITLE
            ======================================================= */}

        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-1 w-10 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
                Security Operations
              </span>
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[42px]">
              Dashboard
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-200/80 sm:text-base">
              Overview of endpoint health, threats, policy status, and license
              utilization.
            </p>
          </div>

          {/* Reference-style slogan */}
          <div className="hidden pt-2 text-right lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-sky-200/65">
              A Safer Tomorrow
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.32em] text-pink-300/70">
              Starts Today
            </p>

            <div className="ml-auto mt-4 h-[2px] w-10 bg-gradient-to-r from-pink-500 to-orange-400 shadow-[0_0_10px_rgba(236,72,153,0.9)]" />
          </div>
        </div>

        {/* =======================================================
            TOP SUMMARY CARDS
            ======================================================= */}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* Endpoint Health */}
          <div
            className="group relative min-h-[185px] overflow-hidden rounded-2xl border border-cyan-400/60 p-5 shadow-[0_0_18px_rgba(34,211,238,0.18),inset_0_0_35px_rgba(34,211,238,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(34,211,238,0.35)]"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,180,210,0.24), rgba(5,36,62,0.88) 55%, rgba(5,20,35,0.96))",
            }}
          >
            <div className="pointer-events-none absolute -right-16 -bottom-20 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />

            <div className="relative z-10">
              <p className="text-sm font-medium text-cyan-100/80 sm:text-base">
                Endpoint Health
              </p>

              <h3 className="mt-2 text-4xl font-bold text-emerald-400 sm:text-5xl drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]">
                {dashboard.endpointHealth.online}
              </h3>

              <p className="mt-2 max-w-[220px] text-sm leading-5 text-white/90">
                Online of {dashboard.endpointHealth.total} registered endpoints
              </p>
            </div>

            {/* ECG icon */}
            <div className="absolute right-5 top-8 text-5xl text-emerald-400/80 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]">
              〽
            </div>

            <div className="absolute bottom-0 right-0 h-20 w-40 rounded-tl-full bg-emerald-400/10" />
          </div>

          {/* Threats */}
          <div
            className="group relative min-h-[185px] overflow-hidden rounded-2xl border border-rose-400/70 p-5 shadow-[0_0_20px_rgba(244,63,94,0.2),inset_0_0_40px_rgba(244,63,94,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_32px_rgba(244,63,94,0.38)]"
            style={{
              background:
                "linear-gradient(135deg, rgba(220,30,75,0.25), rgba(58,13,38,0.88) 55%, rgba(25,10,27,0.96))",
            }}
          >
            <div className="pointer-events-none absolute -right-16 -top-12 h-44 w-44 rounded-full bg-pink-500/20 blur-3xl" />

            <div className="relative z-10">
              <p className="text-sm font-medium text-pink-100/85 sm:text-base">
                Threats Detected
              </p>

              <h3 className="mt-2 text-4xl font-bold text-rose-400 sm:text-5xl drop-shadow-[0_0_12px_rgba(251,113,133,0.45)]">
                {dashboard.threats.detected}
              </h3>

              <p className="mt-2 text-sm leading-5 text-white/90">
                {dashboard.threats.resolved} resolved,{" "}
                {dashboard.threats.quarantined} quarantined
              </p>
            </div>

            {/* Shield / warning */}
            <div className="absolute right-6 top-8 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-rose-400/70 text-3xl font-bold text-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.45)]">
              !
            </div>
          </div>

          {/* Policies */}
          <div
            className="group relative min-h-[185px] overflow-hidden rounded-2xl border border-purple-500/80 p-5 shadow-[0_0_22px_rgba(168,85,247,0.22),inset_0_0_45px_rgba(168,85,247,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_35px_rgba(168,85,247,0.4)]"
            style={{
              background:
                "linear-gradient(135deg, rgba(100,30,190,0.28), rgba(43,16,85,0.88) 55%, rgba(25,10,48,0.96))",
            }}
          >
            <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-purple-500/25 blur-3xl" />

            <div className="relative z-10">
              <p className="text-sm font-medium text-purple-100/90 sm:text-base">
                Policies
              </p>

              <h3 className="mt-2 text-4xl font-bold text-purple-400 sm:text-5xl drop-shadow-[0_0_12px_rgba(192,132,252,0.5)]">
                {dashboard.policies.total}
              </h3>

              <p className="mt-2 text-sm leading-5 text-white/90">
                {dashboard.policies.active} active,{" "}
                {dashboard.policies.draft} draft
              </p>
            </div>

            <div className="absolute right-6 top-8 text-5xl text-purple-400/80 drop-shadow-[0_0_15px_rgba(192,132,252,0.8)]">
              ▤
            </div>
          </div>

          {/* Licenses */}
          <div
            className="group relative min-h-[185px] overflow-hidden rounded-2xl border border-amber-400/80 p-5 shadow-[0_0_22px_rgba(245,158,11,0.22),inset_0_0_45px_rgba(245,158,11,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_35px_rgba(245,158,11,0.4)]"
            style={{
              background:
                "linear-gradient(135deg, rgba(180,105,10,0.30), rgba(72,43,12,0.88) 55%, rgba(35,20,7,0.96))",
            }}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-orange-400/20 blur-3xl" />

            <div className="relative z-10">
              <p className="text-sm font-medium text-amber-100/90 sm:text-base">
                Licenses Used
              </p>

              <h3 className="mt-2 text-4xl font-bold text-amber-400 sm:text-5xl drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                {dashboard.licenses.used}
              </h3>

              <p className="mt-2 text-sm leading-5 text-white/90">
                {dashboard.licenses.available} available
              </p>
            </div>

            <div className="absolute right-6 top-9 flex items-end gap-2">
              <span className="h-8 w-4 rounded-sm bg-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
              <span className="h-12 w-4 rounded-sm bg-amber-400/90 shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
              <span className="h-16 w-4 rounded-sm bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.9)]" />
            </div>
          </div>
        </div>

        {/* =======================================================
            ENDPOINT + INCIDENTS
            ======================================================= */}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Endpoint Health */}
          <div
            className="relative overflow-hidden rounded-2xl border border-blue-400/35 p-5 shadow-[0_0_28px_rgba(30,100,255,0.12),inset_0_0_45px_rgba(40,100,255,0.05)] sm:p-6"
            style={{
              background:
                "linear-gradient(145deg, rgba(20,55,100,0.78), rgba(5,20,48,0.94) 65%, rgba(4,13,31,0.98))",
            }}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-36 w-72 rounded-bl-full bg-cyan-400/10 blur-2xl" />

            <h3 className="relative z-10 mb-6 text-2xl font-bold text-white sm:text-3xl">
              1. Endpoint Health
            </h3>

            <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Total */}
              <div className="rounded-xl border-l-4 border-blue-400 border-t border-r border-b border-blue-400/20 bg-[#06152c]/85 p-5 shadow-[inset_0_0_25px_rgba(30,144,255,0.05)]">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Total Registered
                </p>

                <h4 className="mt-2 text-4xl font-bold text-white">
                  {dashboard.endpointHealth.total}
                </h4>
              </div>

              {/* Online */}
              <div className="rounded-xl border-l-4 border-emerald-400 border-t border-r border-b border-emerald-400/20 bg-[#06152c]/85 p-5 shadow-[inset_0_0_25px_rgba(16,185,129,0.05)]">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Online
                </p>

                <h4 className="mt-2 text-4xl font-bold text-emerald-400">
                  {dashboard.endpointHealth.online}
                </h4>
              </div>

              {/* Offline */}
              <div className="rounded-xl border-l-4 border-orange-400 border-t border-r border-b border-orange-400/20 bg-[#06152c]/85 p-5">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Offline
                </p>

                <h4 className="mt-2 text-4xl font-bold text-orange-400">
                  {dashboard.endpointHealth.offline}
                </h4>
              </div>

              {/* Quarantine */}
              <div className="rounded-xl border-l-4 border-pink-500 border-t border-r border-b border-pink-400/20 bg-[#06152c]/85 p-5">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  In Quarantine
                </p>

                <h4 className="mt-2 text-4xl font-bold text-pink-400">
                  {dashboard.endpointHealth.quarantined}
                </h4>
              </div>
            </div>

            <p className="relative z-10 mt-5 text-sm text-slate-300/80 sm:text-base">
              Pending setup: {dashboard.endpointHealth.pending} endpoints
            </p>
          </div>

          {/* Incidents / Threats */}
          <div
            className="relative overflow-hidden rounded-2xl border border-purple-400/30 p-5 shadow-[0_0_30px_rgba(120,70,255,0.12),inset_0_0_45px_rgba(100,50,255,0.05)] sm:p-6"
            style={{
              background:
                "linear-gradient(145deg, rgba(30,45,85,0.82), rgba(11,19,46,0.96) 65%, rgba(6,12,30,0.98))",
            }}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 rounded-bl-full bg-purple-500/10 blur-2xl" />

            <h3 className="relative z-10 mb-6 text-2xl font-bold text-white sm:text-3xl">
              2. Incidents / Threats
            </h3>

            <div className="relative z-10 w-full overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-4 text-left font-medium text-sky-200/70">
                      Status
                    </th>

                    <th className="pb-4 text-right font-medium text-sky-200/70">
                      Count
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="border-b border-white/10">
                    <td className="py-4 text-white">Detected</td>

                    <td className="py-4 text-right font-semibold text-rose-400">
                      {dashboard.threats.detected}
                    </td>
                  </tr>

                  <tr className="border-b border-white/10">
                    <td className="py-4 text-white">Resolved</td>

                    <td className="py-4 text-right font-semibold text-emerald-400">
                      {dashboard.threats.resolved}
                    </td>
                  </tr>

                  <tr className="border-b border-white/10">
                    <td className="py-4 text-white">Quarantined</td>

                    <td className="py-4 text-right font-semibold text-pink-400">
                      {dashboard.threats.quarantined}
                    </td>
                  </tr>

                  <tr className="border-b border-white/10">
                    <td className="py-4 text-white">Deleted</td>

                    <td className="py-4 text-right font-semibold text-orange-400">
                      {dashboard.threats.killed}
                    </td>
                  </tr>

                  <tr>
                    <td className="pt-4 text-white">Allowed</td>

                    <td className="pt-4 text-right font-semibold text-cyan-400">
                      {dashboard.threats.allowed}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* =======================================================
            POLICY + LICENSE STATUS
            ======================================================= */}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Policy Status */}
          <div
            className="relative overflow-hidden rounded-2xl border border-cyan-400/35 p-5 shadow-[0_0_28px_rgba(34,211,238,0.12),inset_0_0_45px_rgba(34,211,238,0.05)] sm:p-6"
            style={{
              background:
                "linear-gradient(145deg, rgba(20,58,105,0.82), rgba(7,26,58,0.96) 65%, rgba(4,15,35,0.98))",
            }}
          >
            {/* Cyan upper-right light */}
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-80 rounded-bl-full bg-cyan-400/20 blur-2xl" />

            <h3 className="relative z-10 mb-6 text-2xl font-bold text-white sm:text-3xl">
              3. Policy Status
            </h3>

            <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Total */}
              <div className="rounded-xl border-l-4 border-blue-400 border-t border-r border-b border-blue-400/20 bg-[#06152c]/90 p-5">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Total Policies
                </p>

                <h4 className="mt-2 text-4xl font-bold text-white">
                  {dashboard.policies.total}
                </h4>
              </div>

              {/* Active */}
              <div className="rounded-xl border-l-4 border-emerald-400 border-t border-r border-b border-emerald-400/20 bg-[#06152c]/90 p-5">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Active
                </p>

                <h4 className="mt-2 text-4xl font-bold text-emerald-400">
                  {dashboard.policies.active}
                </h4>
              </div>

              {/* Draft */}
              <div className="rounded-xl border-l-4 border-amber-400 border-t border-r border-b border-amber-400/20 bg-[#06152c]/90 p-5">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Draft
                </p>

                <h4 className="mt-2 text-4xl font-bold text-amber-400">
                  {dashboard.policies.draft}
                </h4>
              </div>

              {/* Disabled */}
              <div className="rounded-xl border-l-4 border-slate-300 border-t border-r border-b border-slate-400/20 bg-[#06152c]/90 p-5">
                <p className="text-sm text-sky-200/80 sm:text-base">
                  Disabled
                </p>

                <h4 className="mt-2 text-4xl font-bold text-white">
                  {dashboard.policies.disabled}
                </h4>
              </div>
            </div>

            <p className="relative z-10 mt-5 text-sm leading-6 text-slate-300/80 sm:text-base">
              Endpoints assigned to policies: 236 • Unassigned: 12
            </p>
          </div>

          {/* License Status */}
          <div
            className="relative overflow-hidden rounded-2xl border border-orange-400/40 p-5 shadow-[0_0_30px_rgba(251,146,60,0.13),inset_0_0_45px_rgba(251,146,60,0.05)] sm:p-6"
            style={{
              background:
                "linear-gradient(145deg, rgba(34,52,90,0.90), rgba(12,25,58,0.96) 65%, rgba(7,14,34,0.98))",
            }}
          >
            {/* Orange upper-right light */}
            <div className="pointer-events-none absolute right-0 top-0 h-44 w-80 rounded-bl-full bg-orange-400/25 blur-2xl" />

            <h3 className="relative z-10 mb-6 text-2xl font-bold text-white sm:text-3xl">
              4. License Status
            </h3>

            <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {/* Total */}
              <div className="rounded-xl border-l-4 border-slate-300 border-t border-r border-b border-slate-400/20 bg-[#07172f]/90 p-4 sm:p-5">
                <p className="text-sm text-sky-200/80">Total</p>

                <h4 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                  {dashboard.licenses.total}
                </h4>
              </div>

              {/* Allocated */}
              <div className="rounded-xl border-l-4 border-blue-400 border-t border-r border-b border-blue-400/20 bg-[#07172f]/90 p-4 sm:p-5">
                <p className="text-sm text-sky-200/80">Allocated</p>

                <h4 className="mt-2 text-3xl font-bold text-blue-400 sm:text-4xl">
                  {dashboard.licenses.allocated}
                </h4>
              </div>

              {/* Used */}
              <div className="rounded-xl border-l-4 border-rose-400 border-t border-r border-b border-rose-400/20 bg-[#07172f]/90 p-4 sm:p-5">
                <p className="text-sm text-sky-200/80">Used</p>

                <h4 className="mt-2 text-3xl font-bold text-rose-400 sm:text-4xl">
                  {dashboard.licenses.used}
                </h4>
              </div>

              {/* Available */}
              <div className="rounded-xl border-l-4 border-emerald-400 border-t border-r border-b border-emerald-400/20 bg-[#07172f]/90 p-4 sm:p-5">
                <p className="text-sm text-sky-200/80">Available</p>

                <h4 className="mt-2 text-3xl font-bold text-emerald-400 sm:text-4xl">
                  {dashboard.licenses.available}
                </h4>
              </div>
            </div>

            {/* Utilization */}
            <div className="relative z-10 mt-7">
              <div className="mb-3 flex items-center justify-between text-sm text-sky-100/80">
                <span>Utilization</span>

                <span className="font-semibold text-white">
                  {dashboard.licenses.utilization}%
                </span>
              </div>

              <div className="h-4 overflow-hidden rounded-full border border-white/10 bg-[#142a4c] shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 shadow-[0_0_14px_rgba(251,191,36,0.9)] transition-all duration-700"
                  style={{
                    width: `${Math.min(
                      Math.max(dashboard.licenses.utilization, 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom breathing room so decorative lighting remains visible */}
        <div className="h-24" />
      </div>
    </section>
  );
}