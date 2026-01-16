"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { Shield } from "lucide-react"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [licenseTier, setLicenseTier] = useState("free")
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
    const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            // Prefer explicit redirect URL env var (set this to your production callback URL).
            process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ||
            // Fallback to production domain callback. No localhost defaults kept in repo.
            "https://kuaminisystems.com/securityAgent/auth/callback",
          data: {
            full_name: fullName,
            organization_name: organizationName,
            license_tier: licenseTier,
            role: "super_admin",
          },
        },
      })

      if (error) {
        // If the user already exists, attempt to attach this registration (organization) to the
        // existing auth user via a server-side admin endpoint. This allows using the same
        // email across multiple organizations (profiles/accounts) by linking the existing
        // auth user to a new `accounts`/`profiles` row.
        const msg = error.message || ""
        if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already exists") || msg.toLowerCase().includes("duplicate")) {
          try {
            const res = await fetch("/api/auth/register-existing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, full_name: fullName, organization_name: organizationName, license_tier: licenseTier }),
            })

            if (res.ok) {
                // Show a dismissible toast informing the user and linking to sign in
                toast({
                  title: "Organization attached",
                  description:
                    "An account already exists for this email — your new organization has been attached.",
                  action: (
                    <ToastAction altText="Sign in" asChild>
                      <a href="/securityAgent/auth/login">Sign in</a>
                    </ToastAction>
                  ),
                })
              setIsLoading(false)
              return
            }
            const body = await res.json().catch(() => ({}))
            throw new Error(body?.message || "Failed to register existing user")
          } catch (e: unknown) {
            throw e instanceof Error ? e : new Error("Registration failed")
          }
        }
        throw error
      }

      // Handle linked accounts: if signup succeeds but user already existed with a different provider
      // (e.g., GitHub + email), we need to create the profile for this new organization.
      if (data?.user) {
        try {
          const res = await fetch("/api/auth/register-existing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, full_name: fullName, organization_name: organizationName, license_tier: licenseTier }),
          })

          if (res.ok) {
            // User already existed (linked account), show success message
            toast({
              title: "Organization created",
              description:
                "Your organization has been created. Please sign in to access your console.",
              action: (
                <ToastAction altText="Sign in" asChild>
                  <a href="/securityAgent/auth/login">Sign in</a>
                </ToastAction>
              ),
            })
            setIsLoading(false)
            return
          }
        } catch (e) {
          // If creating profile fails, continue to email verification flow
          console.warn("Profile creation attempt failed, proceeding to email verification:", e)
        }
      }

      router.push("/securityAgent/auth/verify-email")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
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
            <p className="text-sm text-muted-foreground">Register your organization</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Create Account</CardTitle>
              <CardDescription>Set up your organization&apos;s security console</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister}>
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@company.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <Link href="/securityAgent/auth/login" className="text-primary underline underline-offset-4">
                    Sign in
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
