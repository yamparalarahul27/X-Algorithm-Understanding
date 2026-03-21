export type ListenerExposure = "loopback" | "all-interfaces" | "network";
export type ServerCategory = "web" | "tooling" | "desktop" | "system";

export interface LocalListener {
  id: string;
  address: string;
  host: string;
  port: number;
  exposure: ListenerExposure;
}

export interface LocalServerProcess {
  pid: number;
  ppid: number | null;
  user: string;
  command: string;
  executable: string;
  args: string;
  displayName: string;
  category: ServerCategory;
  isLikelyWebApp: boolean;
  isCurrentApp: boolean;
  canTerminate: boolean;
  browserUrl: string | null;
  listeners: LocalListener[];
}

export interface ServerSnapshot {
  generatedAt: string;
  currentPid: number;
  currentUser: string;
  servers: LocalServerProcess[];
}

export interface TerminateServerResult {
  pid: number;
  signal: "SIGTERM";
  terminated: boolean;
  message: string;
}
