#!/usr/bin/env node

import http from "node:http";
import process from "node:process";

const host = process.env.MOCK_API_HOST ?? "127.0.0.1";
const port = Number(process.env.MOCK_API_PORT ?? 3001);

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";

  if (url === "/health") {
    const body = JSON.stringify({ status: "ok", source: "frontend-ci-mock" });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(body);
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ message: "Not Found" }));
});

server.listen(port, host, () => {
  process.stdout.write(`[mock-api] listening on http://${host}:${port}\n`);
});

function shutdown(signal) {
  process.stdout.write(`[mock-api] received ${signal}, shutting down\n`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
