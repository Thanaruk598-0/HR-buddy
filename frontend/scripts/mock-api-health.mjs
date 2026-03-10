#!/usr/bin/env node

import http from "node:http";
import process from "node:process";

const host = process.env.MOCK_API_HOST ?? "127.0.0.1";
const port = Number(process.env.MOCK_API_PORT ?? 3001);

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/health") {
    sendJson(res, 200, { status: "ok", source: "frontend-ci-mock" });
    return;
  }

  if (method === "GET" && url.startsWith("/reference/departments")) {
    sendJson(res, 200, { items: [] });
    return;
  }

  if (method === "GET" && url === "/geo/provinces") {
    sendJson(res, 200, []);
    return;
  }

  if (method === "GET" && url === "/admin/auth/me") {
    sendJson(res, 401, { statusCode: 401, message: "Unauthorized" });
    return;
  }

  if (method === "GET" && url === "/requests/my") {
    sendJson(res, 401, { statusCode: 401, message: "Unauthorized" });
    return;
  }

  if (method === "POST" && url === "/auth-otp/send") {
    sendJson(res, 400, { statusCode: 400, message: "Validation failed" });
    return;
  }

  if (method === "POST" && url === "/admin/auth/login") {
    sendJson(res, 401, { statusCode: 401, message: "Invalid credentials" });
    return;
  }

  sendJson(res, 404, { message: "Not Found" });
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
