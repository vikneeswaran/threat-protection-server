export type AgentPlatform = "windows" | "macos" | "linux";

export const AGENT_PLATFORMS: AgentPlatform[] = [
  "windows",
  "macos",
  "linux",
];

export const AGENT_PLATFORM_LABELS: Record<AgentPlatform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};
