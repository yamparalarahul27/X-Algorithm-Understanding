/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, dialog, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProcess = null;
let quitting = false;

function getDevIconPath() {
  return path.join(app.getAppPath(), "build", "icon.png");
}

function applyDockIcon() {
  if (process.platform !== "darwin" || app.isPackaged) {
    return;
  }

  const iconPath = getDevIconPath();

  if (!fs.existsSync(iconPath)) {
    return;
  }

  const icon = nativeImage.createFromPath(iconPath);

  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

function refreshMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reloadIgnoringCache();
    mainWindow.focus();
  }
}

function createApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Refresh Dashboard",
                accelerator: "CommandOrControl+R",
                click: refreshMainWindow,
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : [
          {
            label: "File",
            submenu: [
              {
                label: "Refresh Dashboard",
                accelerator: "CommandOrControl+R",
                click: refreshMainWindow,
              },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Refresh Dashboard",
          accelerator: "CommandOrControl+R",
          click: refreshMainWindow,
        },
        ...(process.env.NODE_ENV === "development" || process.env.ELECTRON_RENDERER_URL
          ? [{ role: "toggleDevTools" }]
          : []),
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: isMac
        ? [
            { role: "close" },
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
          ]
        : [{ role: "minimize" }, { role: "close" }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function findOpenPort(preferredPort = 3310) {
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

function waitForUrl(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }

        scheduleRetry();
      });

      request.on("error", scheduleRetry);
      request.setTimeout(1000, () => {
        request.destroy();
        scheduleRetry();
      });
    };

    const scheduleRetry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(check, 250);
    };

    check();
  });
}

function getStandaloneServerPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app",
      "standalone",
      "apps",
      "desktop",
      "server.js",
    );
  }

  return path.join(
    app.getAppPath(),
    ".next",
    "standalone",
    "apps",
    "desktop",
    "server.js",
  );
}

async function startBundledNextServer() {
  const port = await findOpenPort();
  const serverEntry = getStandaloneServerPath();

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: path.dirname(serverEntry),
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
    },
    stdio: app.isPackaged ? "ignore" : "inherit",
  });

  serverProcess.once("exit", (code) => {
    serverProcess = null;

    if (!quitting && code !== 0) {
      dialog.showErrorBox(
        "Localhost Status",
        "The embedded server stopped unexpectedly. Try rebuilding the desktop app.",
      );
      app.quit();
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForUrl(url);
  return url;
}

async function getAppUrl() {
  if (process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL;
  }

  return startBundledNextServer();
}

async function createMainWindow() {
  const url = await getAppUrl();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: "Localhost Status",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f8fafc",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl !== url) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
}

function stopBundledServer() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  serverProcess.kill("SIGTERM");
  serverProcess = null;
}

app.setName("Localhost Status");

app.whenReady().then(async () => {
  try {
    app.setAboutPanelOptions({
      applicationName: "Localhost Status",
      applicationVersion: "Alpha 0.1v",
      copyright: "Copyright © 2026 Yamparala Rahul",
      credits:
        "Built by Yamparala Rahul, Design Engineer. Localhost process management with graceful terminate and force kill fallback.",
      version: `${app.getVersion()} · Alpha 0.1v`,
    });
    applyDockIcon();
    createApplicationMenu();
    await createMainWindow();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start the desktop app.";
    dialog.showErrorBox("Localhost Status", message);
    app.quit();
  }
});

app.on("before-quit", () => {
  quitting = true;
  stopBundledServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length > 0) {
    mainWindow?.show();
    return;
  }

  try {
    await createMainWindow();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reopen the desktop app.";
    dialog.showErrorBox("Localhost Status", message);
  }
});
