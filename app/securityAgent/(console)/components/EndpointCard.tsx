interface EndpointCardProps {
  title: string;
  value: number;
  color?: string;
  border?: string;
  glow?: string;
  bg?: string;
  blob?: string;
}

export default function EndpointCard({
  title,
  value,
  color = "text-white",
  border = "border-slate-700/60",
  glow = "shadow-[0_0_16px_rgba(148,163,184,0.12)]",
  bg = "linear-gradient(135deg, rgba(30,41,59,0.6), rgba(10,15,28,0.9) 55%, rgba(4,8,16,0.97))",
  blob = "bg-slate-400/10",
}: EndpointCardProps) {
  return (
    <div
      className={`group relative min-h-[140px] overflow-hidden rounded-2xl border ${border} p-5 transition-all duration-300 hover:-translate-y-1 ${glow}`}
      style={{ background: bg }}
    >
      <div
        className={`pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full ${blob} blur-3xl`}
      />

      <div className="relative z-10">
        <p className="text-sm text-sky-200/70">{title}</p>

        <h3 className={`mt-3 text-4xl font-bold sm:text-5xl ${color}`}>
          {value}
        </h3>
      </div>
    </div>
  );
}