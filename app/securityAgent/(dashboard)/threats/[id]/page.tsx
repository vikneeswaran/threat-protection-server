import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"
import { notFound } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"

export default async function ThreatDetailPage({ params }: { params: { id: string } }) {
  const { user, profile } = await requireConsoleContext()
  const threatId = params.id
  if (!threatId) notFound()

  const result = await query(
    `SELECT id::text, account_id::text, endpoint_id::text, name, description, severity::text, status::text, file_path, file_hash, process_name, detection_engine, detected_at, resolved_at, resolved_by::text, created_at, updated_at FROM threats WHERE id = $1 AND account_id = $2 LIMIT 1`,
    [threatId, profile.account.id],
  )
  const threat = result.rows[0]
  if (!threat) notFound()

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <SecurityHeader title={threat.name} subtitle={`Threat Details`} />
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">{threat.name}</h2>
        <div className="mb-4 text-sm text-muted-foreground">Detected: {new Date(threat.detected_at).toLocaleString()}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><b>Severity:</b> {threat.severity}</div>
          <div><b>Status:</b> {threat.status}</div>
          <div><b>File Path:</b> {threat.file_path || "-"}</div>
          <div><b>File Hash:</b> {threat.file_hash || "-"}</div>
          <div><b>Process Name:</b> {threat.process_name || "-"}</div>
          <div><b>Detection Engine:</b> {threat.detection_engine || "-"}</div>
          <div><b>Resolved At:</b> {threat.resolved_at ? new Date(threat.resolved_at).toLocaleString() : "-"}</div>
          <div><b>Resolved By:</b> {threat.resolved_by || "-"}</div>
        </div>
        {threat.description && (
          <div className="mt-4"><b>Description:</b> {threat.description}</div>
        )}
        <div className="mt-6 text-xs text-muted-foreground">Threat ID: {threat.id}</div>
      </div>
    </main>
  )
}
