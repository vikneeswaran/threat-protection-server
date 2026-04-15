import { SecurityHeader } from "@/components/security-agent/header"
import { SettingsForm } from "@/components/security-agent/settings-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Bell } from "lucide-react"
import { requireConsoleContext } from "@/lib/auth/console"
import { query } from "@/lib/db"

type AccountSettingsRow = {
  settings: Record<string, unknown>
  locked_settings: string[] | null
}

export default async function SettingsPage() {
  const { user, profile } = await requireConsoleContext({ redirectTo: "/securityAgent/auth/login" })

  const accountSettingsResult = await query<AccountSettingsRow>(
    `SELECT settings, locked_settings FROM account_settings WHERE account_id = $1 LIMIT 1`,
    [profile.account.id],
  )
  const accountSettings = accountSettingsResult.rows[0]

  return (
    <>
      <SecurityHeader title="Settings" subtitle="Configure your organization's settings" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization
              </CardTitle>
              <CardDescription>Your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organization Name</span>
                <span className="font-medium">{profile.account.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Level</span>
                <span className="font-medium">Level {profile.account.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">License Tier</span>
                <span className="font-medium capitalize">{profile.account.license_tier?.name || "Free"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure alert preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm
                accountId={profile.account.id}
                settings={accountSettings?.settings || {}}
                lockedSettings={accountSettings?.locked_settings || []}
                userRole={profile.role}
                userId={user.id}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
