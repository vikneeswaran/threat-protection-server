// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

const { queryMock, requireSessionUserMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  requireSessionUserMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

vi.mock("@/lib/auth/session", () => ({
  requireSessionUser: requireSessionUserMock,
}));

import { PATCH as patchThreat } from "@/app/api/securityagent/threats/[id]/route";

describe("threat details PATCH route", () => {
  beforeEach(() => {
    queryMock.mockReset();
    requireSessionUserMock.mockReset();
    requireSessionUserMock.mockResolvedValue({
      id: "user-1",
      account_id: "account-1",
    });
  });

  it("returns queued=false when the same in-flight command already exists", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "threat-1",
            account_id: "account-1",
            endpoint_id: "endpoint-1",
            file_hash: "hash-1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const response = await patchThreat(
      new Request("http://localhost/api/securityagent/threats/threat-1", {
        method: "PATCH",
        body: JSON.stringify({
          action: "allow",
        }),
      }),
      { params: Promise.resolve({ id: "threat-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      queued: false,
      commandId: null,
      persistForFileHash: false,
      message: "A matching threat action is already pending for this threat.",
    });

    const upsertPolicyCall = queryMock.mock.calls.find(
      ([sql]: [string]) =>
        typeof sql === "string" &&
        sql.includes("INSERT INTO threat_action_policies")
    );
    expect(upsertPolicyCall).toBeUndefined();
  });

  it("persists hash policy only when explicitly requested", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "threat-2",
            account_id: "account-1",
            endpoint_id: "endpoint-2",
            file_hash: "hash-2",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "command-2" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await patchThreat(
      new Request("http://localhost/api/securityagent/threats/threat-2", {
        method: "PATCH",
        body: JSON.stringify({
          action: "quarantine",
          persistForFileHash: true,
        }),
      }),
      { params: Promise.resolve({ id: "threat-2" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      queued: true,
      commandId: "command-2",
      persistForFileHash: true,
    });

    const upsertPolicyCall = queryMock.mock.calls.find(
      ([sql]: [string]) =>
        typeof sql === "string" &&
        sql.includes("INSERT INTO threat_action_policies")
    );
    expect(upsertPolicyCall).toBeDefined();
  });
});
