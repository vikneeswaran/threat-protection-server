import { InstallersPage } from "@/components/security-agent/installers-page"
import { requireConsoleContext } from "@/lib/auth/console"

export default async function Installers() {
  const { profile } = await requireConsoleContext()

  return <InstallersPage profile={profile} account={profile.account} />
}
