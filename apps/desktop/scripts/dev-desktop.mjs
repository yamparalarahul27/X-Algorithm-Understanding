import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import waitOn from "wait-on";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");

function findOpenPort(preferredPort = 3002) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on("error", () => {
      const fallback = net.createServer();
      fallback.unref();
      fallback.on("error", reject);
      fallback.listen(0, "127.0.0.1", () => {
        const address = fallback.address();
        const port = typeof address === "object" && address ? address.port : 0;
        fallback.close(() => resolve(port));
      });
    });

    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
  });
}

function shutdown(processes) {
  for (const child of processes) {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }
}

const port = await findOpenPort();
const nextBinary = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const nextProcess = spawn(process.execPath, [nextBinary, "dev", "-p", String(port)], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});

try {
  await waitOn({
    resources: [`tcp:127.0.0.1:${port}`],
    timeout: 30000,
    interval: 250,
  });
} catch (error) {
  shutdown([nextProcess]);
  throw error;
}

const electronProcess = spawn(electronBinary, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_RENDERER_URL: `http://127.0.0.1:${port}`,
  },
});

electronProcess.on("exit", (code) => {
  shutdown([nextProcess]);
  process.exit(code ?? 0);
});

nextProcess.on("exit", (code) => {
  shutdown([electronProcess]);
  process.exit(code ?? 1);
});

process.on("SIGINT", () => {
  shutdown([electronProcess, nextProcess]);
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown([electronProcess, nextProcess]);
  process.exit(0);
});
