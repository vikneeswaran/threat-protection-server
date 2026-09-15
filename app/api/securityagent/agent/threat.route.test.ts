// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import { POST as reportThreatPost } from "@/app/api/securityagent/agent/threat/route";

describe("agent threat reporting route", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("queues the admin override threat action ahead of policy defaults", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: "account-1", is_active: true }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "endpoint-1" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "threat-1",
            account_id: "account-1",
            endpoint_id: "endpoint-1",
            agent_id: "agent-1",
            name: "Eicar",
            severity: "high",
            status: "detected",
            detected_at: new Date().toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ action: "allow" }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "cmd-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await reportThreatPost(
      new NextRequest("http://localhost/api/securityagent/agent/threat", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "agent-1",
          account_id: "account-1",
          threat_name: "Eicar",
          threat_type: "Virus",
          severity: "high",
          file_hash: "abc123",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      action: "allow",
    });

    const commandInsertCall = queryMock.mock.calls.find(
      ([sql]: [string]) =>
        typeof sql === "string" &&
        sql.includes("INSERT INTO threat_action_commands")
    );

    expect(commandInsertCall).toBeDefined();
    expect(commandInsertCall?.[1]?.[3]).toBe("allow");
    expect(
      queryMock.mock.calls.some(
        ([sql]: [string]) =>
          typeof sql === "string" &&
          sql.includes("FROM policies p")
      )
    ).toBe(false);
  });

  it("falls back to policy action and normalizes block to kill", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: "account-1", is_active: true }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "endpoint-1" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "threat-2",
            account_id: "account-1",
            endpoint_id: "endpoint-1",
            agent_id: "agent-1",
            name: "Trojan",
            severity: "critical",
            status: "detected",
            detected_at: new Date().toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ action: "Block" }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "cmd-2" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await reportThreatPost(
      new NextRequest("http://localhost/api/securityagent/agent/threat", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "agent-1",
          account_id: "account-1",
          threat_name: "Trojan",
          threat_type: "Malware",
          severity: "critical",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      action: "kill",
    });

    const commandInsertCall = queryMock.mock.calls.find(
      ([sql]: [string]) =>
        typeof sql === "string" &&
        sql.includes("INSERT INTO threat_action_commands")
    );

    expect(commandInsertCall).toBeDefined();
    expect(commandInsertCall?.[1]?.[3]).toBe("kill");
    expect(
      queryMock.mock.calls.some(
        ([sql]: [string]) =>
          typeof sql === "string" &&
          sql.includes("FROM policies p")
      )
    ).toBe(true);
  });

  it("handles duplicate pending action command without re-marking endpoint", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: "account-1", is_active: true }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "endpoint-1" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "threat-3",
            account_id: "account-1",
            endpoint_id: "endpoint-1",
            agent_id: "agent-1",
            name: "Eicar",
            severity: "high",
            status: "detected",
            detected_at: new Date().toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ action: "allow" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await reportThreatPost(
      new NextRequest("http://localhost/api/securityagent/agent/threat", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "agent-1",
          account_id: "account-1",
          threat_name: "Eicar",
          threat_type: "Virus",
          severity: "high",
          file_hash: "abc123",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      action: "allow",
    });

    expect(
      queryMock.mock.calls.some(
        ([sql]: [string]) =>
          typeof sql === "string" &&
          sql.includes("UPDATE endpoints")
      )
    ).toBe(false);
  });
});
