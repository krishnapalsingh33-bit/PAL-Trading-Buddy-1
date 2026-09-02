const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 4173;
let backendProcess = null;
let server = null;

function resourcePath(...parts) {
  return path.join(process.resourcesPath, ...parts);
}

function mime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
  const root = resourcePath("frontend");
  server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || "/").split("?")[0]);
    const relative = raw === "/" ? "/index.html" : raw;
    const candidate = path.resolve(root, `.${relative}`);
    if (!candidate.startsWith(path.resolve(root))) {
      res.writeHead(403); return res.end("Forbidden");
    }
    fs.readFile(candidate, (err, data) => {
      if (!err) {
        res.writeHead(200, { "Content-Type": mime(candidate), "Cache-Control": "no-cache" });
        return res.end(data);
      }
      // SPA fallback for hash/history routes.
      fs.readFile(path.join(root, "index.html"), (fallbackErr, html) => {
        if (fallbackErr) { res.writeHead(404); return res.end("PAL frontend not found"); }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(html);
      });
    });
  });
  server.listen(FRONTEND_PORT, "127.0.0.1");
}

function waitForBackend(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const request = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry();
      });
      request.on("error", retry);
      request.setTimeout(1500, () => { request.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error("PAL backend did not start in time."));
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

function startBackend() {
  const exe = resourcePath("backend", process.platform === "win32" ? "PALBackend.exe" : "PALBackend");
  if (!fs.existsSync(exe)) throw new Error(`Backend executable not found: ${exe}`);
  backendProcess = spawn(exe, [], {
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, PAL_DESKTOP: "1" },
  });
  backendProcess.on("error", (error) => console.error("PAL backend error", error));
}

async function createWindow() {
  startBackend();
  await waitForBackend();
  startStaticServer();
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1150,
    minHeight: 760,
    backgroundColor: "#05080b",
    title: "PAL Trading Buddy — Market Intelligence",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await window.loadURL(`http://127.0.0.1:${FRONTEND_PORT}/#/dashboard`);
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("PAL renderer failed", code, description);
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error(error);
    dialog.showErrorBox("PAL Trading Buddy could not start", String(error.message || error));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  if (server) server.close();
});
