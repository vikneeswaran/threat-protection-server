"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Shield, Loader2 } from "lucide-react"

export default function SetupPage() {
  const [fullName, setFullName] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [licenseTier, setLicenseTier] = useState("free")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingProfile, setIsCheckingProfile] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const hasRedirected = useRef(false)

  useEffect(() => {
    const checkUserAndProfile = async () => {
      if (hasRedirected.current) {return}

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          console.info("[v0] Auth error:", authError.message)
          setIsCheckingProfile(false)
          setError("Authentication error. Please try logging in again.")
          return
        }

        if (!user) {
          hasRedirected.current = true
          router.push("/securityAgent/auth/login")
          return
        }

        // Pre-fill from user metadata if available
        if (user.user_metadata) {
          setFullName(user.user_metadata.full_name || "")
          setOrganizationName(user.user_metadata.organization_name || "")
          setLicenseTier(user.user_metadata.license_tier || "free")
        }

        // Check if profile already exists
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.info("[v0] Profile check error:", profileError.message)
          setIsCheckingProfile(false)
          return
        }

        if (profile) {
          hasRedirected.current = true
          router.push("/securityAgent/dashboard")
          return
        }

        setIsCheckingProfile(false)
      } catch (err) {
        console.info("[v0] Setup check error:", err)
        setIsCheckingProfile(false)
        setError("Failed to check profile status. Please try again.")
      }
    }

    checkUserAndProfile()
  }, [router, supabase])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/securityAgent/api/setup-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          organizationName,
          licenseTier,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Setup failed")
      }

      router.push("/securityAgent/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingProfile) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !organizationName && !fullName) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="mx-auto h-10 w-10 text-destructive" />
            <CardTitle>Setup Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button onClick={() => router.push("/securityAgent/auth/login")}>Go to Login</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <Shield className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold text-foreground">KuaminiThreatProtect</span>
            </div>
            <p className="text-sm text-muted-foreground">Complete your account setup</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Finish Setup</CardTitle>
              <CardDescription>Set up your organization profile to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      type="text"
                      placeholder="Acme Corporation"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Your Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="licenseTier">License Tier</Label>
                    <Select value={licenseTier} onValueChange={setLicenseTier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free - 5 endpoints (15 day trial)</SelectItem>
                        <SelectItem value="basic">Basic - Up to 50 endpoints ($5/endpoint/mo)</SelectItem>
                        <SelectItem value="pro">Pro - Up to 500 endpoints ($10/endpoint/mo)</SelectItem>
                        <SelectItem value="enterprise">
                          Enterprise - Up to 50,000 endpoints ($10/endpoint/mo)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Setting up..." : "Complete Setup"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
