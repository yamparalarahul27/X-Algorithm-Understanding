import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ListenerExposure,
  LocalListener,
  LocalServerProcess,
  ServerCategory,
  ServerSnapshot,
  TerminationSignal,
  TerminateServerResult,
} from "@/lib/localhost-types";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 4_000;
const COMMAND_BUFFER_BYTES = 10 * 1024 * 1024;
const CATEGORY_ORDER: Record<ServerCategory, number> = {
  web: 0,
  tooling: 1,
  desktop: 2,
  system: 3,
};

type ProcessMeta = {
  pid: number;
  command: string;
  loginName: string;
};

type ProcessDetails = {
  ppid: number | null;
  executable: string;
  args: string;
};

type ParsedSocket = ProcessMeta & {
  address: string;
  host: string;
  port: number;
  exposure: ListenerExposure;
};

export class LocalhostServerError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "LocalhostServerError";
  }
}

async function runCommand(command: string, args: string[]) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_BUFFER_BYTES,
    });

    return stdout;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new LocalhostServerError(
        `Required local command '${command}' is not available on this machine.`,
        503,
      );
    }

    const message =
      error instanceof Error ? error.message : `Failed to run '${command}'.`;
    throw new LocalhostServerError(message, 500);
  }
}

function parseListenerAddress(address: string) {
  if (address.startsWith("[")) {
    const end = address.indexOf("]");
    const host = address.slice(1, end);
    const port = Number.parseInt(address.slice(end + 2), 10);
    return { host, port };
  }

  const lastColon = address.lastIndexOf(":");
  const host = address.slice(0, lastColon);
  const port = Number.parseInt(address.slice(lastColon + 1), 10);
  return { host, port };
}

function getExposure(host: string): ListenerExposure {
  if (host === "127.0.0.1" || host === "::1" || host === "localhost") {
    return "loopback";
  }

  if (host === "*" || host === "0.0.0.0" || host === "::") {
    return "all-interfaces";
  }

  return "network";
}

function parseLsof(stdout: string) {
  const rows: ParsedSocket[] = [];
  const lines = stdout.split("\n").filter(Boolean);
  let current: ProcessMeta = { pid: 0, command: "", loginName: "" };
  let protocol = "";

  for (const line of lines) {
    const prefix = line[0];
    const value = line.slice(1);

    if (prefix === "p") {
      current = {
        pid: Number.parseInt(value, 10),
        command: "",
        loginName: "",
      };
      protocol = "";
      continue;
    }

    if (prefix === "c") {
      current.command = value;
      continue;
    }

    if (prefix === "L") {
      current.loginName = value;
      continue;
    }

    if (prefix === "P") {
      protocol = value;
      continue;
    }

    if (prefix !== "n" || protocol !== "TCP" || !current.pid) {
      continue;
    }

    const { host, port } = parseListenerAddress(value);

    if (!Number.isFinite(port)) {
      continue;
    }

    rows.push({
      ...current,
      address: value,
      host,
      port,
      exposure: getExposure(host),
    });
  }

  return rows;
}

async function getProcessDetails(pids: number[]) {
  if (pids.length === 0) {
    return new Map<number, ProcessDetails>();
  }

  const stdout = await runCommand("ps", [
    "-p",
    pids.join(","),
    "-o",
    "pid=",
    "-o",
    "ppid=",
    "-o",
    "comm=",
    "-o",
    "args=",
  ]);

  const details = new Map<number, ProcessDetails>();

  for (const line of stdout.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, pidValue, ppidValue, commandPath, args] = match;
    const pid = Number.parseInt(pidValue, 10);

    details.set(pid, {
      ppid: Number.parseInt(ppidValue, 10),
      executable: path.basename(commandPath),
      args,
    });
  }

  return details;
}

function isLikelyWebApp(executable: string, args: string, listeners: LocalListener[]) {
  const signature = `${executable} ${args}`.toLowerCase();
  const hasCommonDevPort = listeners.some(
    (listener) =>
      listener.port === 80 ||
      listener.port === 443 ||
      (listener.port >= 3000 && listener.port <= 9999),
  );

  return (
    /\b(next|vite|webpack|astro|nuxt|remix|parcel|react-scripts|serve|preview|uvicorn|gunicorn|flask|django|rails|php -s|http\.server)\b/.test(
      signature,
    ) ||
    (/\b(node|bun|deno|python|ruby|php|go|java)\b/.test(signature) &&
      hasCommonDevPort)
  );
}

function getCategory(executable: string, args: string, webApp: boolean): ServerCategory {
  if (webApp) {
    return "web";
  }

  const signature = `${executable} ${args}`.toLowerCase();

  if (
    /\b(controlcenter|rapportd|sharingd|launchd|mdnsresponder|coreaudiod|distnoted)\b/.test(
      signature,
    )
  ) {
    return "system";
  }

  if (
    /\b(figma|electron|chrome|safari|firefox|arc|slack|discord|spotify|antigravity)\b/.test(
      signature,
    )
  ) {
    return "desktop";
  }

  return "tooling";
}

function getDisplayName(executable: string, args: string) {
  const signature = `${executable} ${args}`.toLowerCase();

  if (/\bnext\b/.test(signature)) {
    return "Next.js server";
  }

  if (/\bvite\b/.test(signature)) {
    return "Vite server";
  }

  if (/\buvicorn\b/.test(signature)) {
    return "Uvicorn server";
  }

  if (/\bgunicorn\b/.test(signature)) {
    return "Gunicorn server";
  }

  if (/\bbun\b/.test(signature)) {
    return "Bun server";
  }

  if (/\bpython\b/.test(signature) && /http\.server/.test(signature)) {
    return "Python HTTP server";
  }

  return executable;
}

function getBrowserUrl(listeners: LocalListener[], webApp: boolean) {
  if (!webApp) {
    return null;
  }

  const preferred =
    listeners.find((listener) => listener.exposure === "loopback") ??
    listeners.find((listener) => listener.exposure === "all-interfaces") ??
    listeners[0];

  return preferred ? `http://localhost:${preferred.port}` : null;
}

function dedupeListeners(sockets: ParsedSocket[]) {
  const seen = new Set<string>();
  const listeners: LocalListener[] = [];

  for (const socket of sockets) {
    const id = `${socket.host}:${socket.port}`;

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    listeners.push({
      id,
      address: socket.address,
      host: socket.host,
      port: socket.port,
      exposure: socket.exposure,
    });
  }

  return listeners.sort((left, right) => left.port - right.port);
}

function buildServerProcess(
  pid: number,
  sockets: ParsedSocket[],
  details: Map<number, ProcessDetails>,
) {
  const [firstSocket] = sockets;
  const processDetails = details.get(pid);
  const executable =
    processDetails?.executable && processDetails.executable.length > 2
      ? processDetails.executable
      : firstSocket.command;
  const args = processDetails?.args ?? firstSocket.command;
  const listeners = dedupeListeners(sockets);
  const webApp = isLikelyWebApp(executable, args, listeners);
  const category = getCategory(executable, args, webApp);

  return {
    pid,
    ppid: processDetails?.ppid ?? null,
    user: firstSocket.loginName || os.userInfo().username,
    command: firstSocket.command,
    executable,
    args,
    displayName: getDisplayName(executable, args),
    category,
    isLikelyWebApp: webApp,
    isCurrentApp: pid === process.pid,
    canTerminate: pid !== process.pid,
    browserUrl: getBrowserUrl(listeners, webApp),
    listeners,
  } satisfies LocalServerProcess;
}

export async function listLocalhostServers(): Promise<ServerSnapshot> {
  const currentUser = os.userInfo().username;
  const stdout = await runCommand("lsof", [
    "-nP",
    "-iTCP",
    "-sTCP:LISTEN",
    "-F",
    "pcLnP",
  ]);

  const sockets = parseLsof(stdout);
  const details = await getProcessDetails(
    Array.from(new Set(sockets.map((socket) => socket.pid))),
  );

  const grouped = new Map<number, ParsedSocket[]>();

  for (const socket of sockets) {
    const existing = grouped.get(socket.pid) ?? [];
    existing.push(socket);
    grouped.set(socket.pid, existing);
  }

  const servers = Array.from(grouped.entries())
    .map(([pid, group]) => buildServerProcess(pid, group, details))
    .sort((left, right) => {
      const categoryDifference =
        CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category];

      if (categoryDifference !== 0) {
        return categoryDifference;
      }

      const leftPort = left.listeners[0]?.port ?? Number.MAX_SAFE_INTEGER;
      const rightPort = right.listeners[0]?.port ?? Number.MAX_SAFE_INTEGER;

      if (leftPort !== rightPort) {
        return leftPort - rightPort;
      }

      return left.displayName.localeCompare(right.displayName);
    });

  return {
    generatedAt: new Date().toISOString(),
    currentPid: process.pid,
    currentUser,
    servers,
  };
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ESRCH"
    ) {
      return false;
    }

    throw error;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function terminateLocalhostServer(
  pid: number,
  signal: TerminationSignal = "SIGTERM",
): Promise<TerminateServerResult> {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new LocalhostServerError("A valid process id is required.", 400);
  }

  if (pid === process.pid) {
    throw new LocalhostServerError(
      "Refusing to terminate the dashboard process itself.",
      409,
    );
  }

  if (!isProcessAlive(pid)) {
    return {
      pid,
      signal,
      terminated: true,
      message: "The process has already stopped.",
    };
  }

  try {
    process.kill(pid, signal);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EPERM"
    ) {
      throw new LocalhostServerError(
        "Permission denied while trying to terminate that process.",
        403,
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to terminate the process.";
    throw new LocalhostServerError(message, 500);
  }

  await sleep(signal === "SIGKILL" ? 200 : 500);
  const terminated = !isProcessAlive(pid);

  return {
    pid,
    signal,
    terminated,
    message:
      signal === "SIGKILL"
        ? terminated
          ? "Process force killed."
          : "SIGKILL sent. The process is still running."
        : terminated
          ? "Process terminated."
          : "SIGTERM sent. The process is still running.",
  };
}
