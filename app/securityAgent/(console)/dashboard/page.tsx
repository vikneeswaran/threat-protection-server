export const metadata = {
  title: "Dashboard | Kuamini Security Agent",
};

export default function SecurityAgentDashboardPage() {
  return (
    <section className="space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-4xl font-bold text-white">
          Dashboard
        </h2>

        <p className="mt-2 text-slate-400">
          Overview of endpoint health, threats, policy status, and license utilization.
        </p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <p className="text-slate-400">
            Endpoint Health
          </p>

          <h3 className="mt-3 text-5xl font-bold text-emerald-400">
            200
          </h3>

          <p className="mt-2 text-slate-300">
            Online of 148 registered
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <p className="text-slate-400">
            Threats Detected
          </p>

          <h3 className="mt-3 text-5xl font-bold text-rose-400">
            36
          </h3>

          <p className="mt-2 text-slate-300">
            28 resolved, 8 quarantined
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <p className="text-slate-400">
            Policies
          </p>

          <h3 className="mt-3 text-5xl font-bold text-indigo-400">
            18
          </h3>

          <p className="mt-2 text-slate-300">
            15 active, 2 draft
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <p className="text-slate-400">
            Licenses Used
          </p>

          <h3 className="mt-3 text-5xl font-bold text-amber-400">
            248
          </h3>

          <p className="mt-2 text-slate-300">
            52 available
          </p>
        </div>

      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Endpoint Health */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="mb-6 text-3xl font-semibold">
            1. Endpoint Health
          </h3>

          <div className="grid grid-cols-2 gap-4">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Total Registered
              </p>

              <h4 className="mt-2 text-4xl font-bold">
                248
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Online
              </p>

              <h4 className="mt-2 text-4xl font-bold text-emerald-400">
                219
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Offline
              </p>

              <h4 className="mt-2 text-4xl font-bold text-orange-400">
                21
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                In Quarantine
              </p>

              <h4 className="mt-2 text-4xl font-bold text-pink-400">
                5
              </h4>
            </div>

          </div>

          <p className="mt-6 text-slate-400">
            Pending setup: 3 endpoints
          </p>

        </div>

        {/* Incidents */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="mb-6 text-3xl font-semibold">
            2. Incidents / Threats
          </h3>

          <table className="w-full">

            <thead>

              <tr className="border-b border-slate-700">

                <th className="pb-3 text-left text-slate-400">
                  Status
                </th>

                <th className="pb-3 text-right text-slate-400">
                  Count
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-b border-slate-800">
                <td className="py-4">Detected</td>
                <td className="py-4 text-right">42</td>
              </tr>

              <tr className="border-b border-slate-800">
                <td className="py-4">Resolved</td>
                <td className="py-4 text-right">28</td>
              </tr>

              <tr className="border-b border-slate-800">
                <td className="py-4">Quarantined</td>
                <td className="py-4 text-right">9</td>
              </tr>

              <tr className="border-b border-slate-800">
                <td className="py-4">Deleted</td>
                <td className="py-4 text-right">4</td>
              </tr>

              <tr>
                <td className="pt-4">Allowed</td>
                <td className="pt-4 text-right">1</td>
              </tr>

            </tbody>

          </table>

        </div>

      </div>
            {/* Bottom Section */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Policy Status */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="mb-6 text-3xl font-semibold">
            3. Policy Status
          </h3>

          <div className="grid grid-cols-2 gap-4">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Total Policies
              </p>

              <h4 className="mt-2 text-4xl font-bold">
                18
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Active
              </p>

              <h4 className="mt-2 text-4xl font-bold text-emerald-400">
                15
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Draft
              </p>

              <h4 className="mt-2 text-4xl font-bold text-amber-400">
                2
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Disabled
              </p>

              <h4 className="mt-2 text-4xl font-bold">
                1
              </h4>
            </div>

          </div>

          <p className="mt-6 text-slate-400">
            Endpoints assigned to policies: 236 • Unassigned: 12
          </p>

        </div>

        {/* License Status */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="mb-6 text-3xl font-semibold">
            4. License Status
          </h3>

          <div className="grid grid-cols-3 gap-4">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Total
              </p>

              <h4 className="mt-2 text-4xl font-bold">
                300
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Used
              </p>

              <h4 className="mt-2 text-4xl font-bold text-rose-400">
                248
              </h4>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-slate-400">
                Available
              </p>

              <h4 className="mt-2 text-4xl font-bold text-emerald-400">
                52
              </h4>
            </div>

          </div>

          <div className="mt-8">

            <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
              <span>Utilization</span>
              <span>83%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-800">

              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: "83%" }}
              />

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}