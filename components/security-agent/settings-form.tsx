"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lock } from "lucide-react"
import type { UserRole } from "@/lib/types/database"
import { createClient } from "@/lib/supabase/client"
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
  const [formSettings, setFormSettings] = useState({
    notifications_enabled: (settings.notifications_enabled as boolean) ?? true,
    email_alerts: (settings.email_alerts as boolean) ?? true,
    auto_quarantine: (settings.auto_quarantine as boolean) ?? false,
    scan_schedule: (settings.scan_schedule as string) ?? "daily",
  })
  const router = useRouter()

  const canEdit = ["super_admin", "admin"].includes(userRole)

  const isLocked = (key: string) => lockedSettings.includes(key)

  const handleSave = async () => {
    if (!canEdit) {return}
    setIsLoading(true)

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("account_settings")
        .update({
          settings: { ...settings, ...formSettings },
        })
        .eq("account_id", accountId)

      if (error) {throw error}

      // Audit log
      await supabase.from("audit_logs").insert({
        account_id: accountId,
        user_id: userId,
        action: "settings_change",
        entity_type: "settings",
        details: { changed: formSettings },
      })

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

      {canEdit && (
        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Settings"}
        </Button>
      )}
    </div>
  )
}
