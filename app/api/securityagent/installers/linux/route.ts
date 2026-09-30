import { downloadUnixInstaller } from "@/lib/installers/unix-download";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return downloadUnixInstaller(request, "linux");
}
