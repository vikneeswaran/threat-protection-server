// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import { POST as heartbeatPost } from "@/app/api/securityagent/agent/heartbeat/route";
import { POST as deregisterPost } from "@/app/api/securityagent/agent/deregister/route";

describe("agent lifecycle routes", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns a useful failure when heartbeat is sent for an uninstalled instance", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "instance-1",
          account_id: "account-1",
          platform: "windows",
          status: "UNINSTALLED",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          endpoint_id: "endpoint-1",
        },
      ],
    });

    const response = await heartbeatPost(
      new NextRequest("http://localhost/api/securityagent/agent/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          installation_instance_id: "instance-1",
          os: "windows",
        }),
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
  });

  it("rejects malformed deregistration payloads instead of throwing server errors", async () => {
    const response = await deregisterPost(
      new NextRequest("http://localhost/api/securityagent/agent/deregister", {
        method: "POST",
        body: JSON.stringify({
          endpoint_id: "not-a-uuid",
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
