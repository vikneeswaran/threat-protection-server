"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { PolicyType } from "@/lib/types/database"
import { toast } from "sonner"

interface CreatePolicyDialogProps {
  accountId: string
  userId: string
}

const policyTypes: { value: PolicyType; label: string; description: string }[] = [
  {
    value: "real_time_protection",
    label: "Real-time Protection",
    description: "Enable or disable on-access scanning",
  },
  {
    value: "scheduled_scan",
    label: "Scheduled Scan",
    description: "Define scan schedules",
  },
  {
    value: "exclusions",
    label: "Exclusions",
    description: "Files/folders to exclude from scanning",
  },
  {
    value: "threat_actions",
    label: "Threat Actions",
    description: "Default actions per threat severity",
  },
  {
    value: "network_protection",
    label: "Network Protection",
    description: "Block malicious IPs/domains",
  },
  {
    value: "device_control",
    label: "Device Control",
    description: "USB/external device restrictions",
  },
]

export function CreatePolicyDialog({ accountId, userId }: CreatePolicyDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<PolicyType>("real_time_protection")
  const [isDefault, setIsDefault] = useState(false)
  const router = useRouter()

  const getDefaultConfig = (policyType: PolicyType) => {
    switch (policyType) {
      case "real_time_protection":
        return { enabled: true, scan_on_access: true, scan_on_write: true }
      case "scheduled_scan":
        return { schedule: "daily", time: "02:00", scan_type: "quick" }
      case "exclusions":
        return { paths: [], extensions: [], processes: [] }
      case "threat_actions":
        return {
          critical: "quarantine",
          high: "quarantine",
          medium: "alert",
          low: "log",
          info: "log",
        }
      case "network_protection":
        return { enabled: true, block_malicious: true, block_list: [] }
      case "device_control":
        return { usb_enabled: true, allow_read: true, allow_write: false }
      default:
        return {}
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()

    try {
      const { error } = await supabase.from("policies").insert({
        account_id: accountId,
        name,
        description: description || null,
        type,
        config: getDefaultConfig(type),
        is_default: isDefault,
        created_by: userId,
      })

      if (error) {throw error}

      // Create audit log
      await supabase.from("audit_logs").insert({
        account_id: accountId,
        user_id: userId,
        action: "policy_change",
        entity_type: "policy",
        details: { name, type, action: "created" },
      })

      toast.success("Policy created successfully")
      setOpen(false)
      setName("")
      setDescription("")
      setType("real_time_protection")
      setIsDefault(false)
      router.refresh()
    } catch (error) {
      console.error("Error creating policy:", error)
      toast.error("Failed to create policy")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Policy</DialogTitle>
          <DialogDescription>Create a new security policy for your endpoints.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Policy Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production Servers Policy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Policy Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as PolicyType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select policy type" />
                </SelectTrigger>
                <SelectContent>
                  {policyTypes.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      <div>
                        <div>{pt.label}</div>
                        <div className="text-xs text-muted-foreground">{pt.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this policy does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="default">Set as Default</Label>
                <p className="text-xs text-muted-foreground">Apply to all new endpoints automatically</p>
              </div>
              <Switch id="default" checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
