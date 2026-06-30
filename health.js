// Tiny HTTP health server. Required by hosting platforms (Hugging Face
// Spaces, Fly.io, Render) that expect a container to expose a port for
// liveness probes. The Telegram bot itself runs via long polling and
// doesn't use this — it just keeps the platform happy.
//
// Endpoints:
//   GET /         -> "ok"
//   GET /health   -> JSON { ok: true, uptime: <seconds> }
//   GET /ping     -> "pong"

import http from "node:http";

const PORT = Number(process.env.PORT || 8080);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(req.url === "/ping" ? "pong" : "ok");
});

server.listen(PORT, () => {
  console.log(`[health] listening on :${PORT}`);
});