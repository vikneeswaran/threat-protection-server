import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { InstallersPage } from "@/components/security-agent/installers-page"

export default async function Installers() {
  const supabase = await createClient()

  let user = null
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.info("[app] Installers page auth error:", error.message)
      redirect("/securityAgent/auth/login")
    }
    user = authUser
  } catch (err) {
    console.info("[app] Installers page auth exception:", err)
    redirect("/securityAgent/auth/login")
  }

  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  let profile = null
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, account:accounts(*, license_tier:license_tiers(*))")
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      console.info("[app] Installers page profile error:", error.message)
    }
    profile = data
  } catch (err) {
    console.info("[app] Installers page profile exception:", err)
  }

  if (!profile) {
    redirect("/securityAgent/auth/setup")
  }

  return <InstallersPage profile={profile} account={profile.account} />
}
