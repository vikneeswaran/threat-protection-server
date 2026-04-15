"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import type { Account, LicenseTier } from "@/lib/types/database"
import { formatDistanceToNow, format } from "date-fns"
import { Key, AlertTriangle, Plus, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface LicenseDetailsProps {
  account: Account & { license_tier: LicenseTier }
  subAccounts: Array<{ id: string; name: string; total_licenses: number; used_licenses: number }>
  userId: string
}

const tierColors = {
  free: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  basic: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pro: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  enterprise: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

export function LicenseDetails({ account, subAccounts, userId }: LicenseDetailsProps) {
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState("")
  const [quantity, setQuantity] = useState("")
  const router = useRouter()

  const availableLicenses = account.total_licenses - account.used_licenses - account.allocated_licenses
  const usedPercentage = account.total_licenses > 0 ? (account.used_licenses / account.total_licenses) * 100 : 0
  const allocatedPercentage =
    account.total_licenses > 0 ? (account.allocated_licenses / account.total_licenses) * 100 : 0

  const isExpiringSoon = account.license_expires_at
    ? new Date(account.license_expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false

  const isExpired = account.license_expires_at ? new Date(account.license_expires_at) < new Date() : false

  const handleAllocate = async () => {
    if (!selectedAccount || !quantity) {return}
    setIsLoading(true)

    const qty = Number.parseInt(quantity, 10)

    try {
      const response = await fetch("/api/console/licenses/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, userId, toAccountId: selectedAccount, quantity: qty }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to allocate licenses" }))
        throw new Error(payload.error || "Failed to allocate licenses")
      }

      const targetAccount = subAccounts.find((a) => a.id === selectedAccount)

      toast.success(`${qty} licenses allocated to ${targetAccount.name}`)
      setAllocateOpen(false)
      setSelectedAccount("")
      setQuantity("")
      router.refresh()
    } catch (error) {
      console.error("Error allocating licenses:", error)
      toast.error("Failed to allocate licenses")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              License Overview
            </CardTitle>
            <CardDescription>Your current license usage and allocation</CardDescription>
          </div>
          <Badge className={tierColors[account.license_tier?.name as keyof typeof tierColors] || tierColors.free}>
            {account.license_tier?.name?.toUpperCase() || "FREE"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {(isExpiringSoon || isExpired) && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${isExpired ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"}`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>
                {isExpired
                  ? "Your license has expired. Please renew to continue using all features."
                  : `Your license expires ${formatDistanceToNow(new Date(account.license_expires_at!), { addSuffix: true })}`}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>License Usage</span>
              <span className="font-medium">
                {account.used_licenses + account.allocated_licenses} / {account.total_licenses} used
              </span>
            </div>
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-primary transition-all"
                style={{ width: `${usedPercentage}%` }}
              />
              <div
                className="absolute top-0 h-full bg-blue-400 transition-all"
                style={{ left: `${usedPercentage}%`, width: `${allocatedPercentage}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>In Use ({account.used_licenses})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span>Allocated ({account.allocated_licenses})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <span>Available ({availableLicenses})</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t">
            <div>
              <p className="text-3xl font-bold">{account.total_licenses}</p>
              <p className="text-sm text-muted-foreground">Total Licenses</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{account.used_licenses}</p>
              <p className="text-sm text-muted-foreground">In Use</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{availableLicenses}</p>
              <p className="text-sm text-muted-foreground">Available</p>
            </div>
          </div>

          {account.license_expires_at && (
            <div className="text-sm text-muted-foreground border-t pt-4">
              License valid until: <strong>{format(new Date(account.license_expires_at), "PPP")}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subAccounts.length > 0 && availableLicenses > 0 && (
            <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-transparent" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Allocate to Sub-Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Allocate Licenses</DialogTitle>
                  <DialogDescription>
                    Transfer licenses to a sub-account. You have {availableLicenses} licenses available.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Sub-Account</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-account" />
                      </SelectTrigger>
                      <SelectContent>
                        {subAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({acc.total_licenses} licenses)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={availableLicenses}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={`Max: ${availableLicenses}`}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAllocateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAllocate} disabled={isLoading || !selectedAccount || !quantity}>
                    {isLoading ? "Allocating..." : "Allocate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button className="w-full bg-transparent" variant="outline">
            <ArrowRight className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>

          <Button className="w-full bg-transparent" variant="outline">
            Purchase More Licenses
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
