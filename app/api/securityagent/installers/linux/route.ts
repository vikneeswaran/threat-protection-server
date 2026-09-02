import { downloadAgentPackage } from "@/lib/installers/installer-download";

export async function GET() {
  return downloadAgentPackage("linux");
}
