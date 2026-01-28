"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, ShieldAlert, Activity, AlertTriangle, CheckCircle2, Power } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrayUIProps {
  endpointId?: string
  hostname?: string
}

interface EndpointStatus {
  agentRunning: boolean
  threatCount: number
  lastScan: Date | null
  protectionStatus: "protected" | "at-risk" | "offline"
  criticalThreats: number
}

export function EndpointTrayUI({ endpointId, hostname }: TrayUIProps) {
  const [status, setStatus] = useState<EndpointStatus>({
    agentRunning: true,
    threatCount: 0,
    lastScan: new Date(),
    protectionStatus: "protected",
    criticalThreats: 0,
  })

  useEffect(() => {
    // Simulate fetching status from local agent
    const checkStatus = async () => {
      try {
        // In real implementation, this would query the local agent service
        // For now, we'll simulate it
        const agentRunning = true
        const threatCount = 0
        const criticalThreats = 0

        setStatus({
          agentRunning,
          threatCount,
          lastScan: new Date(),
          protectionStatus: threatCount > 0 ? "at-risk" : agentRunning ? "protected" : "offline",
          criticalThreats,
        })
      } catch {
        setStatus((prev) => ({ ...prev, agentRunning: false, protectionStatus: "offline" }))
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [endpointId])

  const getStatusColor = () => {
    switch (status.protectionStatus) {
      case "protected":
        return "bg-green-500"
      case "at-risk":
        return "bg-red-500 animate-pulse"
      case "offline":
        return "bg-gray-400"
    }
  }

  const getStatusIcon = () => {
    switch (status.protectionStatus) {
      case "protected":
        return <Shield className="h-8 w-8 text-green-500" />
      case "at-risk":
        return <ShieldAlert className="h-8 w-8 text-red-500 animate-pulse" />
      case "offline":
        return <Shield className="h-8 w-8 text-gray-400" />
    }
  }

  return (
    <Card className="w-[400px] border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">KuaminiThreatProtect</CardTitle>
              <CardDescription>{hostname || "This Device"}</CardDescription>
            </div>
          </div>
          <div className={cn("h-3 w-3 rounded-full", getStatusColor())} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Agent Status</p>
            <div className="flex items-center gap-2">
              <Power className={cn("h-4 w-4", status.agentRunning ? "text-green-500" : "text-gray-400")} />
              <span className="text-sm font-medium">{status.agentRunning ? "Running" : "Stopped"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Protection</p>
            <Badge
              variant={status.protectionStatus === "protected" ? "default" : "destructive"}
              className={cn(
                status.protectionStatus === "protected" && "bg-green-500 hover:bg-green-600",
                status.protectionStatus === "at-risk" && "animate-pulse",
              )}
            >
              {status.protectionStatus === "protected" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {status.protectionStatus === "at-risk" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {status.protectionStatus.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Active Threats</p>
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn("h-4 w-4", status.threatCount > 0 ? "text-red-500" : "text-muted-foreground")}
              />
              <span className={cn("text-lg font-bold", status.threatCount > 0 && "text-red-500")}>
                {status.threatCount}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Scan</p>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{status.lastScan ? status.lastScan.toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
        </div>

        {status.threatCount > 0 && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">Threats Detected</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                  {status.criticalThreats > 0
                    ? `${status.criticalThreats} critical threat${status.criticalThreats !== 1 ? "s" : ""} require immediate attention.`
                    : `${status.threatCount} threat${status.threatCount !== 1 ? "s" : ""} detected on this device.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {status.protectionStatus === "protected" && status.threatCount === 0 && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">System Protected</p>
                <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                  Real-time protection is active. No threats detected.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
