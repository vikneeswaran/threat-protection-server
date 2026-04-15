"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react"

type VerificationState = "loading" | "success" | "error"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [state, setState] = useState<VerificationState>("loading")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token || !email) {
        setState("error")
        setError("Invalid verification link. Missing token or email.")
        return
      }

      try {
        const response = await fetch(
          `/api/auth/local/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
        )

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Verification failed" }))
          setState("error")
          setError(data.error || "Verification failed. The link may have expired.")
          return
        }

        const data = await response.json()
        setState("success")
        setMessage(data.message || "Email verified successfully!")

        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          window.location.href = "/securityAgent/dashboard"
        }, 3000)
      } catch (err) {
        console.error("Verification error:", err)
        setState("error")
        setError("An error occurred during verification. Please try again.")
      }
    }

    verifyEmail()
  }, [token, email])

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <Shield className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold text-foreground">KuaminiThreatProtect</span>
            </div>
            <p className="text-sm text-muted-foreground">Email Verification</p>
          </div>

          <Card>
            {state === "loading" && (
              <>
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Verifying Email</CardTitle>
                  <CardDescription className="text-center">Please wait while we verify your email address</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground text-center">
                      Verifying your email and setting up your account...
                    </p>
                  </div>
                </CardContent>
              </>
            )}

            {state === "success" && (
              <>
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl text-center">Email Verified!</CardTitle>
                  <CardDescription className="text-center">Your account is ready to use</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800">{message}</p>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                      <p>You will be redirected to your dashboard in a few seconds...</p>
                    </div>

                    <Link href="/securityAgent/dashboard">
                      <Button className="w-full">Go to Dashboard</Button>
                    </Link>
                  </div>
                </CardContent>
              </>
            )}

            {state === "error" && (
              <>
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <CardTitle className="text-2xl text-center">Verification Failed</CardTitle>
                  <CardDescription className="text-center">Unable to verify your email</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                      <p>Possible reasons:</p>
                      <ul className="list-disc list-inside text-left mt-2 text-xs">
                        <li>The link has expired (valid for 24 hours)</li>
                        <li>The link was already used</li>
                        <li>The link is incorrect or invalid</li>
                      </ul>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link href="/securityAgent/auth/register">
                        <Button variant="outline" className="w-full">
                          Create New Account
                        </Button>
                      </Link>
                      <Link href="/securityAgent/auth/login">
                        <Button className="w-full">Go to Login</Button>
                      </Link>
                    </div>

                    <div className="text-center text-xs text-muted-foreground">
                      <p>If you need help, please contact our support team.</p>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
