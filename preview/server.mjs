#!/usr/bin/env node
/**
 * Local docs preview for Rows.
 * Serves markdown from /docs and the preview UI from /preview.
 *
 *   node preview/server.mjs
 *   # → http://127.0.0.1:4173/
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function safeJoin(base, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(base, cleaned);
  if (!full.startsWith(base)) return null;
  return full;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  let pathname = url.pathname;

  if (pathname === "/" || pathname === "") {
    pathname = "/preview/index.html";
  }

  let filePath = null;
  if (pathname.startsWith("/docs/")) {
    filePath = safeJoin(ROOT, pathname);
  } else if (pathname.startsWith("/preview/")) {
    filePath = safeJoin(ROOT, pathname);
  } else {
    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }

  if (!filePath) {
    return send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const status = err.code === "ENOENT" ? 404 : 500;
      return send(res, status, status === 404 ? "Not found" : "Error", {
        "Content-Type": "text/plain; charset=utf-8",
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Rows docs preview → http://${HOST}:${PORT}/`);
  console.log(`Serving docs from ${path.join(ROOT, "docs")}`);
});
