"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { Threat, Endpoint, UserRole, ThreatActionType } from "@/lib/types/database"
import { formatDistanceToNow } from "date-fns"
import { MoreHorizontal, AlertTriangle, Shield, Trash2, CheckCircle, Ban, Eye, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ThreatsListProps {
  threats: Array<Threat & { endpoint: Pick<Endpoint, "hostname" | "os"> | null }>
  userRole: UserRole
  userId: string
  accountId: string
}

const severityColors = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  low: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
}

const statusColors = {
  detected: "bg-red-500/10 text-red-600 dark:text-red-400",
  quarantined: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  killed: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  allowed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  resolved: "bg-green-500/10 text-green-600 dark:text-green-400",
}

export function ThreatsList({ threats, userRole, userId, accountId }: ThreatsListProps) {
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    threat: Threat | null
    action: ThreatActionType | null
  }>({ open: false, threat: null, action: null })
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [applyToAllInstances, setApplyToAllInstances] = useState(false)
  const router = useRouter()

  const canManage = ["super_admin", "admin", "operator"].includes(userRole)

  const handleAction = async () => {
    if (!actionDialog.threat || !actionDialog.action) {return}
    setIsLoading(true)

    try {
      const response = await fetch("/api/console/threat-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threatId: actionDialog.threat.id,
          action: actionDialog.action,
          notes,
          accountId,
          userId,
          applyToAllInstances,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to perform action" }))
        throw new Error(payload.error || "Failed to perform action")
      }

      toast.success(`Threat ${actionDialog.action}ed successfully`)
      setActionDialog({ open: false, threat: null, action: null })
      setNotes("")
      setApplyToAllInstances(false)
      router.refresh()
    } catch (error) {
      console.error("Error performing action:", error)
      toast.error("Failed to perform action")
    } finally {
      setIsLoading(false)
    }
  }

  const openActionDialog = (threat: Threat, action: ThreatActionType) => {
    setActionDialog({ open: true, threat, action })
  }

  if (threats.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Threats Found</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            No threats match your current filters, or your endpoints are clean.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Detected Threats
          </CardTitle>
          <CardDescription>
            {threats.length} threat{threats.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Threat</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File Path</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {threats.map((threat) => (
                <TableRow key={threat.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{threat.name}</p>
                      {threat.detection_engine && (
                        <p className="text-xs text-muted-foreground">via {threat.detection_engine}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {threat.endpoint ? (
                      <Link
                        href={`/securityAgent/endpoints/${threat.endpoint_id}`}
                        className="text-primary hover:underline"
                      >
                        {threat.endpoint.hostname}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={severityColors[threat.severity]}>
                      {threat.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[threat.status]}>
                      {threat.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate" title={threat.file_path || ""}>
                    {threat.file_path || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(threat.detected_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/securityAgent/threats/${threat.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {canManage && (
                          <>
                            <DropdownMenuSeparator />
                            {threat.status !== "quarantined" && (
                              <DropdownMenuItem onClick={() => openActionDialog(threat, "quarantine")}>
                                <Shield className="h-4 w-4 mr-2" />
                                Quarantine
                              </DropdownMenuItem>
                            )}
                            {threat.status !== "killed" && (
                              <DropdownMenuItem onClick={() => openActionDialog(threat, "kill")}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Kill Process
                              </DropdownMenuItem>
                            )}
                            {threat.status === "detected" && (
                              <DropdownMenuItem onClick={() => openActionDialog(threat, "allow")}>
                                <Ban className="h-4 w-4 mr-2" />
                                Allow (False Positive)
                              </DropdownMenuItem>
                            )}
                            {threat.status === "quarantined" && (
                              <DropdownMenuItem onClick={() => openActionDialog(threat, "restore")}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            )}
                            {threat.status !== "resolved" && (
                              <DropdownMenuItem
                                onClick={() => openActionDialog(threat, "delete")}
                                className="text-green-600"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Resolved
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ ...actionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionDialog.action} Threat</DialogTitle>
            <DialogDescription>
              {actionDialog.action === "quarantine" && "Move the threat to quarantine to prevent further damage."}
              {actionDialog.action === "kill" && "Terminate the malicious process immediately."}
              {actionDialog.action === "allow" &&
                "Mark this as a false positive and allow the file/process to continue."}
              {actionDialog.action === "restore" && "Restore the quarantined file to its original location."}
              {actionDialog.action === "delete" && "Mark this threat as resolved and remove it from active threats."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">{actionDialog.threat?.name}</p>
              <p className="text-xs text-muted-foreground">{actionDialog.threat?.file_path}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this action..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="applyToAllInstances"
              checked={applyToAllInstances}
              onChange={(e) => setApplyToAllInstances(e.target.checked)}
              className="accent-primary"
            />
            <Label htmlFor="applyToAllInstances" className="text-xs cursor-pointer">
              Apply to all instances (all endpoints and child accounts)
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, threat: null, action: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isLoading}
              variant={actionDialog.action === "allow" ? "destructive" : "default"}
            >
              {isLoading ? "Processing..." : `Confirm ${actionDialog.action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
