"use client"

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
import type { Endpoint, UserRole } from "@/lib/types/database"
import { formatDistanceToNow } from "date-fns"
import { MoreHorizontal, Monitor, Eye, FileText, Trash2, RefreshCw, ShieldCheck, ShieldAlert, Download } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface EndpointWithThreats extends Endpoint {
  activeThreats: number
  computed_status: "online" | "offline" | "disconnected"
}

interface EndpointsListProps {
  endpoints: EndpointWithThreats[]
  userRole: UserRole
}

const statusColors = {
  online: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  offline: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  disconnected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
}

const osIcons: Record<string, string> = {
  windows: "🪟",
  macos: "🍎",
  linux: "🐧",
}

export function EndpointsList({ endpoints, userRole }: EndpointsListProps) {
  const canManage = ["super_admin", "admin", "operator"].includes(userRole)
  const canDelete = ["super_admin", "admin"].includes(userRole)
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (endpoint: EndpointWithThreats) => {
    if (removingId) {return}
    const confirmed = window.confirm(`Uninstall and remove ${endpoint.hostname}?`)
    if (!confirmed) {return}
    setRemovingId(endpoint.id)
    try {
      const res = await fetch("/securityAgent/api/agent/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint_id: endpoint.id, agent_id: endpoint.agent_id, os: endpoint.os }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to uninstall endpoint")
      }
      const commands = Array.isArray(data?.uninstall?.commands) ? data.uninstall.commands.join("\n") : ""
      if (commands) {
        alert(`Run these commands on the endpoint to finish cleanup:\n\n${commands}`)
      }
      router.refresh()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to uninstall endpoint")
    } finally {
      setRemovingId(null)
    }
  }

  if (endpoints.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Endpoints</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            No endpoints match your current filters, or no agents have been registered yet.
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Deploy the KuaminiThreatProtectAgent on your endpoints to start monitoring. The agent will automatically
            register with this console.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered Endpoints</CardTitle>
        <CardDescription>
          {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Health</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Local IP</TableHead>
              <TableHead>Public IP</TableHead>
              <TableHead>Agent Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.map((endpoint) => {
              const isInfected = endpoint.activeThreats > 0

              return (
                <TableRow key={endpoint.id} className={isInfected ? "bg-red-500/5 hover:bg-red-500/10" : ""}>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {isInfected ? (
                        <div className="flex flex-col items-center gap-1">
                          <ShieldAlert className="h-6 w-6 text-red-500 animate-pulse" />
                          <Badge variant="destructive" className="text-xs px-1">
                            {endpoint.activeThreats}
                          </Badge>
                        </div>
                      ) : (
                        <ShieldCheck className="h-6 w-6 text-green-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
                        {osIcons[endpoint.os] || "💻"}
                      </div>
                      <div>
                        <p className="font-medium">{endpoint.hostname}</p>
                        {endpoint.mac_address && (
                          <p className="text-xs text-muted-foreground font-mono">{endpoint.mac_address}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {endpoint.os.charAt(0).toUpperCase() + endpoint.os.slice(1)}
                      {endpoint.os_version && ` ${endpoint.os_version}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{endpoint.ip_address || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{endpoint.public_ip || "-"}</TableCell>
                  <TableCell>{endpoint.agent_version || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[endpoint.computed_status]}>
                      {endpoint.computed_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {endpoint.last_seen_at
                      ? formatDistanceToNow(new Date(endpoint.last_seen_at), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/securityAgent/endpoints/${endpoint.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(endpoint.agent_id || "")
                            alert(`Agent ID copied: ${endpoint.agent_id}`)
                          }}
                        >
                          <Monitor className="h-4 w-4 mr-2" />
                          Copy Agent ID
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/securityAgent/endpoints/${endpoint.id}/policies`}>
                            <FileText className="h-4 w-4 mr-2" />
                            Manage Policies
                          </Link>
                        </DropdownMenuItem>
                        {canManage && (
                          <DropdownMenuItem>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Force Sync
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/securityAgent/api/agent/uninstall/download/${endpoint.os}?${endpoint.id ? `endpoint_id=${endpoint.id}` : endpoint.agent_id ? `agent_id=${endpoint.agent_id}` : ""}`}
                                download
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download Uninstaller
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemove(endpoint)}
                              disabled={removingId === endpoint.id}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {removingId === endpoint.id ? "Removing..." : "Remove Endpoint"}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
