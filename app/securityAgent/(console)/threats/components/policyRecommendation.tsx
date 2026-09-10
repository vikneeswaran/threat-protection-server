export default function PolicyRecommendation() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-orange-400/40 p-5 shadow-[0_0_30px_rgba(251,146,60,0.13),inset_0_0_45px_rgba(251,146,60,0.05)] sm:p-6"
      style={{
        background:
          "linear-gradient(145deg, rgba(34,52,90,0.90), rgba(12,25,58,0.96) 65%, rgba(7,14,34,0.98))",
      }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-44 w-80 rounded-bl-full bg-orange-400/25 blur-2xl" />

      <h2 className="relative z-10 text-lg font-semibold text-white sm:text-xl">
        Policy Recommendation
      </h2>

      <p className="relative z-10 mt-4 text-sm leading-6 text-sky-200/75">
        3 endpoints are repeatedly triggering credential dumping behavior.
        Apply stricter memory-access policy and enforce isolation on repeated
        detections.
      </p>

      <button
        className="relative z-10 mt-5 w-full rounded-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 py-3 font-medium text-white shadow-[0_0_18px_rgba(168,85,247,0.4)] transition hover:opacity-90"
      >
        Apply Suggested Policy
      </button>
    </div>
  );
}