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

import { GET as threatsGet } from "@/app/api/securityagent/threats/route";

describe("threat listing route", () => {
  beforeEach(() => {
    queryMock.mockReset();
    requireSessionUserMock.mockReset();
  });

  it("filters threats by account and returns successful payload", async () => {
    requireSessionUserMock.mockResolvedValue({
      id: "user-1",
      account_id: "account-1",
    });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: "threat-1", hostname: "Unknown Endpoint" }],
    });

    const response = await threatsGet();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      threats: [{ id: "threat-1" }],
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("LEFT JOIN endpoints");
    expect(queryMock.mock.calls[0][0]).toContain("WHERE t.account_id = $1");
    expect(queryMock.mock.calls[0][1]).toEqual(["account-1"]);
  });

  it("returns unauthorized when there is no session user", async () => {
    requireSessionUserMock.mockResolvedValueOnce(null);

    const response = await threatsGet();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "Unauthorized",
    });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
