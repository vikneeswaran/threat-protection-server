// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalizeAgentIdentity,
  normalizeOperatingSystem,
  normalizeSystemInfo,
  normalizeThreat,
} from "@/lib/agent/agent-request";

/*
 * The payloads below are the ones the shipped agent sends.
 */
const AGENT_HEARTBEAT_PAYLOAD = {
  agent_id: "agent-1",
  endpoint_id: null,
  account_id: "22222222-2222-2222-2222-222222222222",
  agent_version: "1.0.30",
  status: "online",
  system_info: {
    os: "windows",
    hostname: "DESKTOP-1",
    agent_version: "1.0.30",
    ip: "10.0.0.5",
    local_ip: "10.0.0.5",
    public_ip: "203.0.113.7",
    mac: "aa:bb:cc:dd:ee:ff",
  },
};

const AGENT_THREAT_PAYLOAD = {
  agent_id: "agent-1",
  account_id: "22222222-2222-2222-2222-222222222222",
  endpoint_id: "33333333-3333-3333-3333-333333333333",
  threat_name: "EICAR test file",
  threat_type: "malware",
  severity: "high",
  file_path: "C:/temp/eicar.com",
  file_hash: "abc123",
  process_name: "explorer.exe",
  process_id: 4242,
  detection_engine: "signature",
};

describe("normalizeAgentIdentity", () => {
  it("reads the identity from a snake_case agent payload", () => {
    expect(normalizeAgentIdentity(AGENT_HEARTBEAT_PAYLOAD)).toEqual({
      installationInstanceId: null,
      endpointId: null,
      agentId: "agent-1",
      accountId: "22222222-2222-2222-2222-222222222222",
      installationToken: null,
    });
  });

  it("still reads the camelCase console payload", () => {
    expect(
      normalizeAgentIdentity({
        installationInstanceId:
          "44444444-4444-4444-4444-444444444444",
        agentId: "agent-2",
        installationToken: "token",
      })
    ).toMatchObject({
      installationInstanceId: "44444444-4444-4444-4444-444444444444",
      agentId: "agent-2",
      installationToken: "token",
    });
  });

  it("ignores identifiers that are not valid UUIDs", () => {
    expect(
      normalizeAgentIdentity({
        installation_instance_id: "not-a-uuid",
        endpoint_id: "None",
        account_id: "",
      })
    ).toMatchObject({
      installationInstanceId: null,
      endpointId: null,
      accountId: null,
    });
  });
});

describe("normalizeSystemInfo", () => {
  it("reads the machine details from system_info", () => {
    expect(normalizeSystemInfo(AGENT_HEARTBEAT_PAYLOAD)).toEqual({
      hostname: "DESKTOP-1",
      os: "windows",
      osVersion: null,
      agentVersion: "1.0.30",
      ipAddress: "10.0.0.5",
      macAddress: "aa:bb:cc:dd:ee:ff",
      publicIp: "203.0.113.7",
    });
  });

  it("reads the machine details from a flat payload", () => {
    expect(
      normalizeSystemInfo({
        hostname: "mac-1",
        os: "macos",
        osVersion: "14.4",
        agentVersion: "1.0.30",
        ipAddress: "10.0.0.9",
        macAddress: "11:22:33:44:55:66",
        publicIp: "203.0.113.8",
      })
    ).toEqual({
      hostname: "mac-1",
      os: "macos",
      osVersion: "14.4",
      agentVersion: "1.0.30",
      ipAddress: "10.0.0.9",
      macAddress: "11:22:33:44:55:66",
      publicIp: "203.0.113.8",
    });
  });
});

describe("normalizeOperatingSystem", () => {
  it("maps the values reported by the agent", () => {
    expect(normalizeOperatingSystem("Windows")).toBe("windows");
    expect(normalizeOperatingSystem("darwin")).toBe("macos");
    expect(normalizeOperatingSystem("macOS")).toBe("macos");
    expect(normalizeOperatingSystem("Linux")).toBe("linux");
    expect(normalizeOperatingSystem(null)).toBeNull();
  });
});

describe("normalizeThreat", () => {
  it("reads a snake_case threat report", () => {
    expect(normalizeThreat(AGENT_THREAT_PAYLOAD)).toEqual({
      name: "EICAR test file",
      description: null,
      severity: "high",
      type: "malware",
      filePath: "C:/temp/eicar.com",
      fileHash: "abc123",
      processName: "explorer.exe",
      processId: 4242,
      detectionEngine: "signature",
      detectionSource: null,
    });
  });

  it("still reads a camelCase threat report", () => {
    expect(
      normalizeThreat({
        name: "Suspicious process",
        severity: "critical",
        type: "behaviour",
        filePath: "/tmp/x",
        detectionSource: "agent",
      })
    ).toMatchObject({
      name: "Suspicious process",
      severity: "critical",
      type: "behaviour",
      filePath: "/tmp/x",
      detectionSource: "agent",
      processId: null,
    });
  });
});
