/**
 * Serveur de dev local : sert les fichiers statiques + /api/lead
 * via le même handler que Vercel. Usage : node dev-server.mjs [port]
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import handler from "./api/lead.js";

const PORT = Number(process.argv[2] || process.env.PORT || 3600);
const ROOT = new URL(".", import.meta.url).pathname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Adaptateur minimal : donne à req/res Node l'API attendue par le handler Vercel
function wrapRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/lead") {
    try {
      await handler(req, wrapRes(res));
    } catch (e) {
      console.error("handler error:", e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify({ ok: false, error: "server" }));
    }
    return;
  }

  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = normalize(file).replace(/^(\.\.[/\\])+/, "");
  try {
    const data = await readFile(join(ROOT, file));
    res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Silex Guide — http://localhost:${PORT}`);
});
