"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Threat, ThreatActionType, UserRole } from "@/lib/types/database"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, MoreHorizontal, Shield, Trash2, CheckCircle, Ban, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface EndpointThreatsProps {
  threats: Threat[]
  endpointId: string
  userRole: UserRole
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

export function EndpointThreats({ threats, endpointId: _endpointId, userRole }: EndpointThreatsProps) {
  const canManage = ["super_admin", "admin", "operator"].includes(userRole)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleAction = async (threatId: string, action: ThreatActionType) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/console/threat-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threatId, action }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to perform action" }))
        throw new Error(payload.error || "Failed to perform action")
      }

      toast.success(`Threat ${action}ed successfully`)
      router.refresh()
    } catch (error) {
      console.error("Error performing threat action:", error)
      toast.error("Failed to perform threat action")
    } finally {
      setIsLoading(false)
    }
  }

  if (threats.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Threats Detected</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            This endpoint is clean. No threats have been detected.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Detected Threats
        </CardTitle>
        <CardDescription>
          {threats.length} threat{threats.length !== 1 ? "s" : ""} on this endpoint
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Threat</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>File Path</TableHead>
              <TableHead>Detected</TableHead>
              {canManage && <TableHead className="w-[50px]"></TableHead>}
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
                {canManage && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {threat.status !== "quarantined" && (
                          <DropdownMenuItem onClick={() => handleAction(threat.id, "quarantine")} disabled={isLoading}>
                            <Shield className="h-4 w-4 mr-2" />
                            Quarantine
                          </DropdownMenuItem>
                        )}
                        {threat.status !== "killed" && (
                          <DropdownMenuItem onClick={() => handleAction(threat.id, "kill")} disabled={isLoading}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Block / Kill Process
                          </DropdownMenuItem>
                        )}
                        {threat.status === "detected" && (
                          <DropdownMenuItem onClick={() => handleAction(threat.id, "allow")} disabled={isLoading}>
                            <Ban className="h-4 w-4 mr-2" />
                            Allow
                          </DropdownMenuItem>
                        )}
                        {threat.status === "quarantined" && (
                          <DropdownMenuItem onClick={() => handleAction(threat.id, "restore")} disabled={isLoading}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                        )}
                        {threat.status !== "resolved" && (
                          <DropdownMenuItem onClick={() => handleAction(threat.id, "delete")} disabled={isLoading}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Resolved
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
