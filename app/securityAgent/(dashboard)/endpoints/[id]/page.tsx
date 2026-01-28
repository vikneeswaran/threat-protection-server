import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { SecurityHeader } from "@/components/security-agent/header"
import { EndpointDetails } from "@/components/security-agent/endpoint-details"
import { EndpointThreats } from "@/components/security-agent/endpoint-threats"
import { EndpointPolicies } from "@/components/security-agent/endpoint-policies"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { withComputedStatus } from "@/lib/endpoint-status"

export default async function EndpointDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/securityAgent/auth/login")
  }

  // Get endpoint details
  const { data: endpoint } = await supabase.from("endpoints").select("*").eq("id", id).single()

  if (!endpoint) {
    notFound()
  }

  // Add computed status
  const _endpointWithComputedStatus = withComputedStatus(endpoint)

  // Get endpoint threats
  const { data: threats } = await supabase
    .from("threats")
    .select("*")
    .eq("endpoint_id", id)
    .order("detected_at", { ascending: false })
    .limit(20)

  // Get assigned policies
  const { data: assignedPolicies } = await supabase
    .from("endpoint_policies")
    .select(`
      *,
      policy:policies(*)
    `)
    .eq("endpoint_id", id)

  // Get user profile for role check
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  return (
    <>
      <SecurityHeader title={endpoint.hostname} subtitle={`${endpoint.os} endpoint`} />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="threats">Threats ({threats?.length || 0})</TabsTrigger>
            <TabsTrigger value="policies">Policies ({assignedPolicies?.length || 0})</TabsTrigger>
          </TabsList>WithComputedStatus

          <TabsContent value="details" className="mt-6">
            <EndpointDetails endpoint={endpoint} />
          </TabsContent>

          <TabsContent value="threats" className="mt-6">
            <EndpointThreats threats={threats || []} endpointId={id} userRole={profile?.role || "viewer"} />
          </TabsContent>

          <TabsContent value="policies" className="mt-6">
            <EndpointPolicies
              assignedPolicies={assignedPolicies || []}
              endpointId={id}
              userRole={profile?.role || "viewer"}
            />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
