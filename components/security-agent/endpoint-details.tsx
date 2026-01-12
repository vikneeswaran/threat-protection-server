"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Endpoint } from "@/lib/types/database"
import { format } from "date-fns"
import { Monitor, Wifi, Clock, Shield, Network } from "lucide-react"

interface EndpointDetailsProps {
  endpoint: Endpoint & { computed_status?: "online" | "offline" | "disconnected" }
}

const statusColors = {
  online: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  offline: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  disconnected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
}

export function EndpointDetails({ endpoint }: EndpointDetailsProps) {
  // Use computed status if available, fallback to stored status
  const displayStatus = endpoint.computed_status || endpoint.status
  
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>Hardware and OS details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hostname</span>
            <span className="font-medium">{endpoint.hostname}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operating System</span>
            <span className="font-medium">
              {endpoint.os.charAt(0).toUpperCase() + endpoint.os.slice(1)} {endpoint.os_version || ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MAC Address</span>
            <span className="font-mono text-sm">{endpoint.mac_address || "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Network Information
          </CardTitle>
          <CardDescription>Network and connectivity details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">IP Address</span>
            <span className="font-mono text-sm">{endpoint.ip_address || "-"}</span>
          </div>displayStatus]}>
              <Wifi className="h-3 w-3 mr-1" />
              {displaySme="text-muted-foreground">Status</span>
            <Badge variant="outline" className={statusColors[endpoint.status]}>
              <Wifi className="h-3 w-3 mr-1" />
              {endpoint.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Seen</span>
            <span className="text-sm">
              {endpoint.last_seen_at ? format(new Date(endpoint.last_seen_at), "PPpp") : "Never"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Agent Information
          </CardTitle>
          <CardDescription>Protection agent details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Agent Version</span>
            <span className="font-medium">{endpoint.agent_version || "Unknown"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Registered</span>
            <span className="text-sm">{format(new Date(endpoint.registered_at), "PPpp")}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline
          </CardTitle>
          <CardDescription>Important dates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span className="text-sm">{format(new Date(endpoint.created_at), "PPpp")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Updated</span>
            <span className="text-sm">{format(new Date(endpoint.updated_at), "PPpp")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
