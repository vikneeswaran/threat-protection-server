type ThreatFilterProps = {
  search: string;
  severity: string;
  status: string;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onExport: () => void;
};

export default function ThreatFilter({
  search,
  severity,
  status,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onExport,
}: ThreatFilterProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="h-12 rounded-lg border border-slate-700 bg-[#020617] px-4 font-medium"
      />

      <select
        value={severity}
        onChange={(e) => onSeverityChange(e.target.value)}
        className="h-12 rounded-lg border border-slate-700 bg-[#020617] px-4 font-medium"
      >
        <option value="">All Severities</option>
        <option value="Critical">Critical</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>

      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-12 rounded-lg border border-slate-700 bg-[#020617] px-4 font-medium"
      >
         <option value="">All Status</option>
         <option value="detected">Detected</option>
         <option value="unknown">Unknown</option>
      </select>

      <button
        onClick={onExport}
        className="h-12 rounded-lg bg-indigo-600 font-medium hover:bg-indigo-500"
      >
        Export Incidents
      </button>
    </div>
  );
}