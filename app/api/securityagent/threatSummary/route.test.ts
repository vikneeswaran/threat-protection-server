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

import { GET as getThreatSummary } from "@/app/api/securityagent/threatSummary/route";

describe("threatSummary route", () => {
  beforeEach(() => {
    queryMock.mockReset();
    requireSessionUserMock.mockReset();
  });

  it("scopes summary queries to the authenticated account", async () => {
    requireSessionUserMock.mockResolvedValue({
      id: "user-1",
      account_id: "account-1",
    });
    queryMock.mockResolvedValueOnce({
      rows: [{ detected: "1", critical: "0", open_incidents: "1", resolved: "0" }],
    });

    const response = await getThreatSummary();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      summary: { detected: "1" },
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE account_id = $1");
    expect(queryMock.mock.calls[0][1]).toEqual(["account-1"]);
  });

  it("returns unauthorized when there is no session user", async () => {
    requireSessionUserMock.mockResolvedValueOnce(null);

    const response = await getThreatSummary();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "Unauthorized",
    });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
