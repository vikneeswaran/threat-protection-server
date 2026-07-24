// Import reusable UI components for the Threats dashboard
import ThreatSummaryCards from "@/app/securityAgent/(console)/threats/components/threatSummaryCards";
import ThreatTable from "@/app/securityAgent/(console)/threats/components/threatTable";
import ResponseQueue from "@/app/securityAgent/(console)/threats/components/responseQueue";
import PolicyRecommendation from "@/app/securityAgent/(console)/threats/components/policyRecommendation";

// Main page component for displaying threat monitoring information
export default function ThreatsPage() {
  return (
        //  Full-page container with dark theme styling
    <div className="min-h-screen bg-[#020617] text-white">
       {/* Centers the page content and limits maximum width */}
      <main className="mx-auto max-w-[1600px]">
         {/* Displays the page title */}
        <h1 className="text-3xl font-semibold">
          Threats
        </h1>
        {/* Description of the Threats dashboard */}

        <p className="mt-2 text-slate-400">
          Review detected threats, severities, and response actions.
        </p>

         {/* Displays the list of detected threats */}
        <div className="mt-2">
          <ThreatSummaryCards />
        </div>

        {/* Displays the list of detected threats */}
        <div className="mt-6">
          <ThreatTable />
        </div>

        {/* Displays response queue and policy recommendations side by side */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Shows pending response actions for detected threats */}
          <ResponseQueue />
          {/* Displays recommended security policies based on threats */}
          <PolicyRecommendation />
        </div>
      </main>
    </div>
  );
}