import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SecuritySidebar } from "@/components/security-agent/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.info("[app] Dashboard layout auth error:", error.message)
      redirect("/securityAgent/auth/login")
    }
    user = data.user
  } catch (err) {
    console.info("[app] Dashboard layout auth exception:", err)
    redirect("/securityAgent/auth/login")
  }

  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  let profile = null
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        *,
        account:accounts(
          *,
          license_tier:license_tiers(*)
        )
      `)
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      console.info("[app] Dashboard layout profile error:", error.message)
    }
    profile = data
  } catch (err) {
    console.info("[app] Dashboard layout profile exception:", err)
  }

  if (!profile) {
    // Profile doesn't exist - redirect to setup page
    redirect("/securityAgent/auth/setup")
  }

  return (
    <SidebarProvider>
      <SecuritySidebar profile={profile} account={profile.account} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
