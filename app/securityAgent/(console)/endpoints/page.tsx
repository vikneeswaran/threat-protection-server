import { requireSessionUser } from "@/lib/auth/session";
import { getEndpointsData } from "@/lib/endpoints/endpoints.service";

import EndpointSummary from "../components/EndpointSummary";
import EndpointTable from "../components/EndpointTable";

export const metadata = {
  title: "Endpoints | Kuamini Security Agent",
};

export default async function SecurityAgentEndpointsPage() {
  const user = await requireSessionUser();

  if (!user) {
    return (
      <section className="relative min-h-screen w-full overflow-hidden bg-[#030817] text-white">
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-slate-400">User session not found</p>
        </div>
      </section>
    );
  }

  const endpointData = await getEndpointsData(user.account_id);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#030817] text-white">
      {/* =========================================================
          GLOBAL DASHBOARD LIGHTING (matches Dashboard page)
          ========================================================= */}

      <div
        className="pointer-events-none absolute -top-40 left-[20%] h-[520px] w-[720px] rounded-full opacity-70 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(0,190,255,0.38) 0%, rgba(0,90,180,0.16) 38%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute -right-40 -top-20 h-[600px] w-[700px] rounded-full opacity-80 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(165,0,255,0.42) 0%, rgba(100,0,180,0.18) 42%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute right-[5%] top-[18%] h-[360px] w-[500px] rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,35,145,0.24) 0%, transparent 72%)",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-60 left-[25%] h-[600px] w-[800px] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(110,0,255,0.28) 0%, rgba(50,20,130,0.16) 45%, transparent 75%)",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-60 right-[5%] h-[500px] w-[700px] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,65,90,0.30) 0%, rgba(255,140,0,0.20) 38%, transparent 72%)",
        }}
      />

      {/* Neon decorative curves */}
      <div className="pointer-events-none absolute right-[-180px] top-[-180px] h-[390px] w-[800px] rotate-[-17deg] rounded-[50%] border-b-2 border-r-2 border-pink-500/80 shadow-[0_0_18px_rgba(236,72,153,0.7),0_0_45px_rgba(168,85,247,0.45)]" />
      <div className="pointer-events-none absolute right-[-150px] top-[-130px] h-[340px] w-[720px] rotate-[-17deg] rounded-[50%] border-b border-orange-400/90 shadow-[0_0_15px_rgba(251,146,60,0.8)]" />
      <div className="pointer-events-none absolute -left-[420px] bottom-[-230px] h-[720px] w-[650px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.7),0_0_70px_rgba(168,85,247,0.4)]" />
      <div className="pointer-events-none absolute -left-[390px] bottom-[-180px] h-[650px] w-[580px] rotate-[25deg] rounded-[50%] border-r-2 border-b-2 border-orange-400/90 shadow-[0_0_20px_rgba(251,146,60,0.9),0_0_55px_rgba(251,146,60,0.45)]" />
      <div className="pointer-events-none absolute -bottom-[350px] right-[-100px] h-[600px] w-[1000px] rotate-[-12deg] rounded-[50%] border-t-2 border-pink-500/70 shadow-[0_0_22px_rgba(236,72,153,0.75),0_0_65px_rgba(168,85,247,0.45)]" />
      <div className="pointer-events-none absolute -bottom-[315px] right-[-80px] h-[540px] w-[900px] rotate-[-12deg] rounded-[50%] border-t border-orange-400/70 shadow-[0_0_18px_rgba(251,146,60,0.7)]" />

      {/* Decorative dot grid */}
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

      <div className="relative z-10 mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-1 w-10 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/70">
              Security Operations
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[42px]">
            Endpoints
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-200/80 sm:text-base">
            Manage registered devices and monitor endpoint protection status.
          </p>
        </div>

        {/* Summary Cards */}
        <EndpointSummary summary={endpointData.summary} />

        {/* Endpoint Inventory */}
        <EndpointTable endpoints={endpointData.endpoints} />

        {/* Bottom breathing room so decorative lighting remains visible */}
        <div className="h-16" />
      </div>
    </section>
  );
}