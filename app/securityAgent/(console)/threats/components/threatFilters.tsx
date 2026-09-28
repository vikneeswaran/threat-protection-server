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
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="h-12 rounded-lg border border-white/10 bg-[#06152c]/85 px-4 font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
      />

      <select
        value={severity}
        onChange={(e) => onSeverityChange(e.target.value)}
        className="h-12 rounded-lg border border-white/10 bg-[#06152c]/85 px-4 font-medium text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
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
        className="h-12 rounded-lg border border-white/10 bg-[#06152c]/85 px-4 font-medium text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
      >
        <option value="">All Status</option>
        <option value="detected">Detected</option>
        <option value="unknown">Unknown</option>
        <option value="quarantined">Quarantined</option>
        <option value="killed">Killed</option>
        <option value="allowed">Allowed</option>
        <option value="blocked">Blocked</option>
        <option value="deleted">Deleted</option>
        <option value="quarantine failed">Quarantine Failed</option>
        <option value="kill failed">Kill Failed</option>
        <option value="block failed">Block Failed</option>
        <option value="allow failed">Allow Failed</option>
        <option value="delete failed">Delete Failed</option>
        <option value="restore failed">Restore Failed</option>
      </select>

      <button
        onClick={onExport}
        className="h-12 rounded-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 font-medium text-white shadow-[0_0_18px_rgba(168,85,247,0.4)] transition hover:opacity-90"
      >
        Export Incidents
      </button>
    </div>
  );
}
