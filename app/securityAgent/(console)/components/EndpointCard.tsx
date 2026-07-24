interface EndpointCardProps {
  title: string;
  value: number;
  color?: string;
}

export default function EndpointCard({
  title,
  value,
  color = "text-white",
}: EndpointCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg transition-all duration-200 hover:border-slate-700 hover:shadow-xl">
      <p className="text-slate-400 text-sm">
        {title}
      </p>

      <h3 className={`mt-3 text-5xl font-bold ${color}`}>
        {value}
      </h3>
    </div>
  );
}