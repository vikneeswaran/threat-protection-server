import { requireSessionUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/dashboard.service";

export const metadata = {
  title: "Dashboard | Kuamini Security Agent",
};

export default async function SecurityAgentDashboardPage() {
  const user = await requireSessionUser();

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-center text-slate-400">
          User session not found
        </p>
      </div>
    );
  }

  const dashboard = await getDashboardData(user.account_id);

  return (
    <section className="w-full px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
          Dashboard
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
          Overview of endpoint health, threats, policy status, and license
          utilization.
        </p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4">
        {/* Endpoint Health */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 lg:p-6">
          <p className="text-sm text-slate-400 sm:text-base">
            Endpoint Health
          </p>

          <h3 className="mt-2 text-3xl font-bold text-emerald-400 sm:text-4xl lg:text-5xl">
            {dashboard.endpointHealth.online}
          </h3>

          <p className="mt-2 text-sm leading-5 text-slate-300 sm:text-base">
            Online of {dashboard.endpointHealth.total} registered endpoints
          </p>
        </div>

        {/* Threats */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 lg:p-6">
          <p className="text-sm text-slate-400 sm:text-base">
            Threats Detected
          </p>

          <h3 className="mt-2 text-3xl font-bold text-rose-400 sm:text-4xl lg:text-5xl">
            {dashboard.threats.detected}
          </h3>

          <p className="mt-2 text-sm leading-5 text-slate-300 sm:text-base">
            {dashboard.threats.resolved} resolved,{" "}
            {dashboard.threats.quarantined} quarantined
          </p>
        </div>

        {/* Policies */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 lg:p-6">
          <p className="text-sm text-slate-400 sm:text-base">Policies</p>

          <h3 className="mt-2 text-3xl font-bold text-indigo-400 sm:text-4xl lg:text-5xl">
            {dashboard.policies.total}
          </h3>

          <p className="mt-2 text-sm leading-5 text-slate-300 sm:text-base">
            {dashboard.policies.active} active, {dashboard.policies.draft}{" "}
            draft
          </p>
        </div>

        {/* Licenses */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 lg:p-6">
          <p className="text-sm text-slate-400 sm:text-base">
            Licenses Used
          </p>

          <h3 className="mt-2 text-3xl font-bold text-amber-400 sm:text-4xl lg:text-5xl">
            {dashboard.licenses.used}
          </h3>

          <p className="mt-2 text-sm leading-5 text-slate-300 sm:text-base">
            {dashboard.licenses.available} available
          </p>
        </div>
      </div>

      {/* Middle Section */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:mt-8 xl:grid-cols-2 xl:gap-6">
        {/* Endpoint Health */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 lg:p-6">
          <h3 className="mb-5 text-xl font-semibold text-white sm:text-2xl lg:text-3xl">
            1. Endpoint Health
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {/* Total */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">
                Total Registered
              </p>

              <h4 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {dashboard.endpointHealth.total}
              </h4>
            </div>

            {/* Online */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">Online</p>

              <h4 className="mt-2 text-3xl font-bold text-emerald-400 sm:text-4xl">
                {dashboard.endpointHealth.online}
              </h4>
            </div>

            {/* Offline */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">Offline</p>

              <h4 className="mt-2 text-3xl font-bold text-orange-400 sm:text-4xl">
                {dashboard.endpointHealth.offline}
              </h4>
            </div>

            {/* Quarantine */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">
                In Quarantine
              </p>

              <h4 className="mt-2 text-3xl font-bold text-pink-400 sm:text-4xl">
                {dashboard.endpointHealth.quarantined}
              </h4>
            </div>
          </div>

          <p className="mt-5 text-sm text-slate-400 sm:text-base">
            Pending setup: {dashboard.endpointHealth.pending} endpoints
          </p>
        </div>

        {/* Incidents */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 lg:p-6">
          <h3 className="mb-5 text-xl font-semibold text-white sm:text-2xl lg:text-3xl">
            2. Incidents / Threats
          </h3>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm sm:text-base">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="pb-3 text-left font-medium text-slate-400">
                    Status
                  </th>

                  <th className="pb-3 text-right font-medium text-slate-400">
                    Count
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b border-slate-800">
                  <td className="py-3 sm:py-4">Detected</td>
                  <td className="py-3 text-right sm:py-4">
                    {dashboard.threats.detected}
                  </td>
                </tr>

                <tr className="border-b border-slate-800">
                  <td className="py-3 sm:py-4">Resolved</td>
                  <td className="py-3 text-right sm:py-4">
                    {dashboard.threats.resolved}
                  </td>
                </tr>

                <tr className="border-b border-slate-800">
                  <td className="py-3 sm:py-4">Quarantined</td>
                  <td className="py-3 text-right sm:py-4">
                    {dashboard.threats.quarantined}
                  </td>
                </tr>

                <tr className="border-b border-slate-800">
                  <td className="py-3 sm:py-4">Deleted</td>
                  <td className="py-3 text-right sm:py-4">
                    {dashboard.threats.killed}
                  </td>
                </tr>

                <tr>
                  <td className="pt-3 sm:pt-4">Allowed</td>
                  <td className="pt-3 text-right sm:pt-4">
                    {dashboard.threats.allowed}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-8 xl:grid-cols-2 xl:gap-6">
        {/* Policy Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 lg:p-6">
          <h3 className="mb-5 text-xl font-semibold text-white sm:text-2xl lg:text-3xl">
            3. Policy Status
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {/* Total */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">
                Total Policies
              </p>

              <h4 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {dashboard.policies.total}
              </h4>
            </div>

            {/* Active */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">Active</p>

              <h4 className="mt-2 text-3xl font-bold text-emerald-400 sm:text-4xl">
                {dashboard.policies.active}
              </h4>
            </div>

            {/* Draft */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">Draft</p>

              <h4 className="mt-2 text-3xl font-bold text-amber-400 sm:text-4xl">
                {dashboard.policies.draft}
              </h4>
            </div>

            {/* Disabled */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
              <p className="text-sm text-slate-400 sm:text-base">Disabled</p>

              <h4 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {dashboard.policies.disabled}
              </h4>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-400 sm:text-base">
            Endpoints assigned to policies: 236 • Unassigned: 12
          </p>
        </div>

        {/* License Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 lg:p-6">
          <h3 className="mb-5 text-xl font-semibold text-white sm:text-2xl lg:text-3xl">
            4. License Status
          </h3>

          
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

  {/* Total */}
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
    <p className="text-slate-400">
      Total
    </p>

    <h4 className="mt-2 text-4xl font-bold">
      {dashboard.licenses.total}
    </h4>
  </div>



  {/* Allocated */}
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
    <p className="text-slate-400">
      Allocated
    </p>

    <h4 className="mt-2 text-4xl font-bold text-blue-400">
      {dashboard.licenses.allocated}
    </h4>
  </div>

    {/* Used */}
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
    <p className="text-slate-400">
      Used
    </p>

    <h4 className="mt-2 text-4xl font-bold text-rose-400">
      {dashboard.licenses.used}
    </h4>
  </div>

  {/* Available */}
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
    <p className="text-slate-400">
      Available
    </p>

    <h4 className="mt-2 text-4xl font-bold text-emerald-400">
      {dashboard.licenses.available} 
    </h4>
  </div>

</div>

          {/* Utilization */}
          <div className="mt-6 sm:mt-8">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400 sm:text-sm">
              <span>Utilization</span>

              <span className="font-medium text-slate-300">
                {dashboard.licenses.utilization}%
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 sm:h-3">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    Math.max(dashboard.licenses.utilization, 0),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}