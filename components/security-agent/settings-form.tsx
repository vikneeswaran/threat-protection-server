"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lock } from "lucide-react"
import type { UserRole } from "@/lib/types/database"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface SettingsFormProps {
  accountId: string
  settings: Record<string, unknown>
  lockedSettings: string[]
  userRole: UserRole
  userId: string
}

export function SettingsForm({ accountId, settings, lockedSettings, userRole, userId }: SettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [versionOptions, setVersionOptions] = useState<string[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [formSettings, setFormSettings] = useState({
    notifications_enabled: (settings.notifications_enabled as boolean) ?? true,
    email_alerts: (settings.email_alerts as boolean) ?? true,
    auto_quarantine: (settings.auto_quarantine as boolean) ?? false,
    scan_schedule: (settings.scan_schedule as string) ?? "daily",
    target_agent_version: (settings.target_agent_version as string) ?? "latest",
  })
  const router = useRouter()

  const canEdit = ["super_admin", "admin"].includes(userRole)

  const isLocked = (key: string) => lockedSettings.includes(key)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/agent/versions?limit=3")
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        const versions = Array.isArray(payload?.common_versions) ? payload.common_versions.filter((v: unknown) => typeof v === "string") : []
        setVersionOptions(versions)
        const selected = typeof settings.target_agent_version === "string" ? settings.target_agent_version : null
        if (versions.length > 0 && (!selected || !versions.includes(selected))) {
          setFormSettings((prev) => ({ ...prev, target_agent_version: versions[0] }))
        }
      } catch (error) {
        console.error("Failed to load version options", error)
      } finally {
        setLoadingVersions(false)
      }
    })()
  }, [settings.target_agent_version])

  const handleSave = async () => {
    if (!canEdit) {return}
    setIsLoading(true)

    try {
      const response = await fetch("/api/console/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, userId, settings: { ...settings, ...formSettings } }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to save settings" }))
        throw new Error(payload.error || "Failed to save settings")
      }

      toast.success("Settings saved successfully")
      router.refresh()
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-2">
            Notifications {isLocked("notifications_enabled") && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <p className="text-xs text-muted-foreground">Enable in-app notifications</p>
        </div>
        <Switch
          checked={formSettings.notifications_enabled}
          onCheckedChange={(checked) => setFormSettings({ ...formSettings, notifications_enabled: checked })}
          disabled={!canEdit || isLocked("notifications_enabled")}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-2">
            Email Alerts {isLocked("email_alerts") && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <p className="text-xs text-muted-foreground">Receive email alerts for critical events</p>
        </div>
        <Switch
          checked={formSettings.email_alerts}
          onCheckedChange={(checked) => setFormSettings({ ...formSettings, email_alerts: checked })}
          disabled={!canEdit || isLocked("email_alerts")}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-2">
            Auto-Quarantine {isLocked("auto_quarantine") && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <p className="text-xs text-muted-foreground">Automatically quarantine critical threats</p>
        </div>
        <Switch
          checked={formSettings.auto_quarantine}
          onCheckedChange={(checked) => setFormSettings({ ...formSettings, auto_quarantine: checked })}
          disabled={!canEdit || isLocked("auto_quarantine")}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          Default Scan Schedule {isLocked("scan_schedule") && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
        <Select
          value={formSettings.scan_schedule}
          onValueChange={(value) => setFormSettings({ ...formSettings, scan_schedule: value })}
          disabled={!canEdit || isLocked("scan_schedule")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          Agent Rollout Version {isLocked("target_agent_version") && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
        <p className="text-xs text-muted-foreground">
          Endpoints will only upgrade to this version. Downgrades are blocked; older versions require uninstall then reinstall.
        </p>
        <Select
          value={formSettings.target_agent_version}
          onValueChange={(value) => setFormSettings({ ...formSettings, target_agent_version: value })}
          disabled={!canEdit || isLocked("target_agent_version") || loadingVersions}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingVersions ? "Loading versions..." : "Select a version"} />
          </SelectTrigger>
          <SelectContent>
            {versionOptions.map((version) => (
              <SelectItem key={version} value={version}>
                v{version}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canEdit && (
        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Settings"}
        </Button>
      )}
    </div>
  )
}
