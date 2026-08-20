export default async function Server2Page() {

  const response = await fetch(
    "http://localhost:3000/api/server2-data",
    {
      cache: "no-store",
    }
  );

  const data = await response.json();

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] flex items-center justify-center px-6">

    <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
         Server 2 Information
         </h1>

    <div className="space-y-5 text-lg">

  <div className="flex justify-between border-b border-white/20 pb-3">
    <span className="font-semibold text-white">Server</span>
    <span className="text-gray-200">{data.server}</span>
  </div>

  <div className="flex justify-between border-b border-white/20 pb-3">
    <span className="font-semibold text-white">Status</span>
    <span
      className={
        data.status === "Running"
          ? "text-green-400 font-semibold"
          : "text-red-400 font-semibold"
      }
    >
      {data.status}
    </span>
  </div>

  <div className="flex justify-between border-b border-white/20 pb-3">
    <span className="font-semibold text-white">Message</span>
    <span className="text-gray-200">{data.message}</span>
  </div>

  <div className="flex justify-between">
    <span className="font-semibold text-white">Timestamp</span>
    <span className="text-gray-300">{data.timestamp}</span>
  </div>

   </div>

      </div>

    </main>
  );
}