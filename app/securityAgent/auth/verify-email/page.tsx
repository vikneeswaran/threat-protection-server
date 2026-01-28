"use client"

import { useState } from "react"
import Link from "next/link"
import { Shield, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyEmailPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleResend = async () => {
    if (!email) {
      toast({ title: "Email required", description: "Enter your email to resend the link." })
      return
    }
    setIsSending(true)
    try {
      // Supabase resend API: send the sign-up confirmation again
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ||
            "https://kuaminisystems.com/securityAgent/auth/callback",
        },
      })
      if (error) {throw error}
      toast({ title: "Verification sent", description: "Please check your inbox and spam folder." })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resend verification"
      toast({ title: "Resend failed", description: msg })
    } finally {
      setIsSending(false)
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
          </div>
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription>We&apos;ve sent you a verification link</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Please check your email inbox and click the verification link to activate your account. Once verified,
                you&apos;ll be able to access your security console.
              </p>
              <div className="mt-4 grid gap-2 text-left">
                <Label htmlFor="email">Didn&apos;t get it? Resend to:</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button type="button" onClick={handleResend} disabled={isSending}>
                    {isSending ? "Sending..." : "Resend"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Or {" "}
                  <Link href="/securityAgent/auth/register" className="text-primary underline underline-offset-4">
                    try again
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
