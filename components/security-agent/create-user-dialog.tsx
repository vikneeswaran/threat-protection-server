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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import type { UserRole } from "@/lib/types/database"
import { toast } from "sonner"

interface CreateUserDialogProps {
  accountId: string
  currentUserRole: UserRole
  currentUserId: string
}

export function CreateUserDialog({ accountId, currentUserRole, currentUserId }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<UserRole>("viewer")
  const router = useRouter()

  // Determine available roles based on current user's role
  const availableRoles: { value: UserRole; label: string }[] =
    currentUserRole === "super_admin"
      ? [
          { value: "admin", label: "Admin" },
          { value: "operator", label: "Operator" },
          { value: "viewer", label: "Viewer" },
        ]
      : [
          { value: "operator", label: "Operator" },
          { value: "viewer", label: "Viewer" },
        ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/console/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, currentUserId, email, fullName, role }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to send invitation" }))
        throw new Error(payload.error || "Failed to send invitation")
      }

      toast.success(`Invitation recorded for ${email}.`)

      setOpen(false)
      setEmail("")
      setFullName("")
      setRole("viewer")
      router.refresh()
    } catch (error) {
      console.error("Error inviting user:", error)
      toast.error("Failed to send invitation")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>Send an invitation to add a new user to your organization.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name (Optional)</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "admin" && "Admins can manage users, policies, and respond to threats."}
                {role === "operator" && "Operators can manage endpoints and respond to threats."}
                {role === "viewer" && "Viewers have read-only access to the dashboard."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
