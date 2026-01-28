"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Policy, UserRole } from "@/lib/types/database"
import { formatDistanceToNow } from "date-fns"
import { FileText, Plus, Trash2 } from "lucide-react"

interface EndpointPoliciesProps {
  assignedPolicies: Array<{ policy: Policy; assigned_at: string }>
  endpointId: string
  userRole: UserRole
}

export function EndpointPolicies({ assignedPolicies, endpointId: _endpointId, userRole }: EndpointPoliciesProps) {

const policyTypeLabels: Record<string, string> = {
  real_time_protection: "Real-time Protection",
  scheduled_scan: "Scheduled Scan",
  exclusions: "Exclusions",
  threat_actions: "Threat Actions",
  network_protection: "Network Protection",
  device_control: "Device Control",
}

const canManage = ["super_admin", "admin", "operator"].includes(userRole)

  if (assignedPolicies.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Policies Assigned</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            This endpoint has no specific policies assigned. Default policies may still apply.
          </p>
          {canManage && (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign Policy
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
            <FileText className="h-5 w-5" />
            Assigned Policies
          </CardTitle>
          <CardDescription>
            {assignedPolicies.length} polic{assignedPolicies.length !== 1 ? "ies" : "y"} assigned
          </CardDescription>
        </div>
        {canManage && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Assign Policy
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              {canManage && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignedPolicies.map(({ policy, assigned_at }) => (
              <TableRow key={policy.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{policy.name}</p>
                    {policy.description && <p className="text-xs text-muted-foreground">{policy.description}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{policyTypeLabels[policy.type] || policy.type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={policy.is_active ? "default" : "secondary"}>
                    {policy.is_active ? "Active" : "Inactive"}
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
