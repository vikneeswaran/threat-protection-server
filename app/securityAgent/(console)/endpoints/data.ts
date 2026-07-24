export interface Endpoint {
  id: string;
  name: string;
  user: string;
  localIp: string;
  publicIp: string;
  os: "Windows" | "Linux" | "macOS";
  version: string;
  status: "Online" | "Offline";
  infected: boolean;
  securedByKuamini: boolean;
}

export const endpoints: Endpoint[] = [
  {
    id: "1",
    name: "Desktop-001",
    user: "John Doe",
    localIp: "192.168.1.15",
    publicIp: "103.45.67.21",
    os: "Windows",
    version: "Windows 11 Pro 24H2",
    status: "Online",
    infected: false,
    securedByKuamini: true,
  },
  {
    id: "2",
    name: "Laptop-002",
    user: "Alice",
    localIp: "192.168.1.20",
    publicIp: "49.204.123.56",
    os: "Windows",
    version: "Windows 10 Pro",
    status: "Offline",
    infected: true,
    securedByKuamini: false,
  },
  {
    id: "3",
    name: "Ubuntu-01",
    user: "David",
    localIp: "192.168.1.30",
    publicIp: "182.74.10.15",
    os: "Linux",
    version: "Ubuntu 24.04 LTS",
    status: "Online",
    infected: false,
    securedByKuamini: true,
  },
  {
    id: "4",
    name: "MacBook-Pro",
    user: "Steve",
    localIp: "192.168.1.40",
    publicIp: "122.164.98.32",
    os: "macOS",
    version: "macOS Sequoia",
    status: "Online",
    infected: false,
    securedByKuamini: true,
  },
];