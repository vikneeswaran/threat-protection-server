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
import { Plus } from "lucide-react"
import type { Account } from "@/lib/types/database"
import { toast } from "sonner"

interface CreateSubAccountDialogProps {
  parentAccount: Account
  userId: string
}

export function CreateSubAccountDialog({ parentAccount, userId: _userId }: CreateSubAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [licenses, setLicenses] = useState("")
  const router = useRouter()

  const availableLicenses =
    parentAccount.total_licenses - parentAccount.used_licenses - parentAccount.allocated_licenses

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const licensesToAllocate = Number.parseInt(licenses, 10)

    if (isNaN(licensesToAllocate) || licensesToAllocate < 1) {
      toast.error("Please enter a valid number of licenses")
      setIsLoading(false)
      return
    }

    if (licensesToAllocate > availableLicenses) {
      toast.error(`You can only allocate up to ${availableLicenses} licenses`)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/console/sub-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, licenses: licensesToAllocate }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to create sub-account" }))
        throw new Error(payload.error || "Failed to create sub-account")
      }

      toast.success("Sub-account created successfully")
      setOpen(false)
      setName("")
      setLicenses("")
      router.refresh()
    } catch (error) {
      console.error("Error creating sub-account:", error)
      toast.error("Failed to create sub-account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Sub-Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sub-Account</DialogTitle>
          <DialogDescription>
            Create a new organization under {parentAccount.name}. This will be a Level {parentAccount.level + 1}{" "}
            account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="Enter organization name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenses">Licenses to Allocate</Label>
              <Input
                id="licenses"
                type="number"
                min="1"
                max={availableLicenses}
                placeholder={`Max: ${availableLicenses}`}
                value={licenses}
                onChange={(e) => setLicenses(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                You have {availableLicenses} licenses available to allocate
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Sub-Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
