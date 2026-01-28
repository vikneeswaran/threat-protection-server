"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Endpoint, UserRole } from "@/lib/types/database"
import { formatDistanceToNow } from "date-fns"
import { Monitor, Plus, Trash2 } from "lucide-react"

interface PolicyEndpointsProps {
  assignedEndpoints: Array<{ endpoint: Endpoint; assigned_at: string }>
  policyId: string
  userRole: UserRole
}

const statusColors = {
  online: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  offline: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  disconnected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
}

export function PolicyEndpoints({ assignedEndpoints, policyId: _policyId, userRole }: PolicyEndpointsProps) {
  const canManage = ["super_admin", "admin", "operator"].includes(userRole)

  if (assignedEndpoints.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Endpoints Assigned</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            This policy is not assigned to any endpoints yet.
          </p>
          {canManage && (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign to Endpoints
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Assigned Endpoints
          </CardTitle>
          <CardDescription>
            {assignedEndpoints.length} endpoint{assignedEndpoints.length !== 1 ? "s" : ""} using this policy
          </CardDescription>
        </div>
        {canManage && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Assign to Endpoints
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              {canManage && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignedEndpoints.map(({ endpoint, assigned_at }) => (
              <TableRow key={endpoint.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{endpoint.hostname}</p>
                    <p className="text-xs text-muted-foreground">{endpoint.ip_address}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{endpoint.os.charAt(0).toUpperCase() + endpoint.os.slice(1)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[endpoint.status]}>
                    {endpoint.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(assigned_at), { addSuffix: true })}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
