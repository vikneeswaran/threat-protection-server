"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Shield, Mail, CheckCircle } from "lucide-react"

type PageState = "form" | "success" | "error"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [licenseTier, setLicenseTier] = useState("free")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pageState, setPageState] = useState<PageState>("form")
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const response = await fetch("/api/auth/local/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          fullName,
          email,
          password,
          licenseTier,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Registration failed" }))
        const msg = payload.error || "Registration failed"
        if (msg.toLowerCase().includes("already")) {
          setError("Email already registered. Please use a different email or sign in.")
          setIsLoading(false)
          return
        }
        throw new Error(msg)
      }

      // Show success page
      setPageState("success")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setPageState("error")
    } finally {
      setIsLoading(false)
    }
  }

  // Success state - show email verification message
  if (pageState === "success") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2">
                <Shield className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-foreground">KuaminiThreatProtect</span>
              </div>
              <p className="text-sm text-muted-foreground">Account Registration</p>
            </div>
            <Card>
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-center">Account Created!</CardTitle>
                <CardDescription className="text-center">Verify your email to get started</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-blue-900">Verify your email address</p>
                        <p className="text-blue-800 mt-1">
                          We've sent a verification link to <strong>{email}</strong>
                        </p>
                        <p className="text-blue-700 text-xs mt-2">
                          Click the link in the email to verify your account and access the console.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>💡 Tip:</strong> Check your spam/junk folder if you don't see the email within a few minutes.
                    </p>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    <p>The verification link will expire in 24 hours.</p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => {
                        // Redirect to login after they click the email link
                        router.push("/securityAgent/auth/login")
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Go to Login
                    </Button>
                  </div>

                  <div className="text-center text-xs text-muted-foreground">
                    <p>After clicking the verification link, you'll be automatically logged in.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Form state - registration form
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
