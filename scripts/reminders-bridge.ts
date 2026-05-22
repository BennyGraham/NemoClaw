#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createServer, ServerResponse } from "node:http";
import { promisify } from "node:util";
import { encode } from "@toon-format/toon";

const execFileAsync = promisify(execFile);

const port = Number(process.env.NEMOCLAW_REMINDERS_BRIDGE_PORT || "8765");
const host = process.env.NEMOCLAW_REMINDERS_BRIDGE_HOST || "127.0.0.1";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

const routes = {
  "/status": { args: ["status"], key: "status" },
  "/list": { args: ["list"], key: "reminderLists" },
  "/today": { args: ["today"], key: "reminders" },
} as const;

type BridgeBody = Record<string, unknown>;
type RoutePath = keyof typeof routes;

if (!loopbackHosts.has(host)) {
  console.error(
    [
      "Refusing to start Reminders bridge on a non-loopback host.",
      `Requested bind host: ${host}`,
      "This bridge is loopback-only. Use NEMOCLAW_REMINDERS_BRIDGE_HOST=127.0.0.1.",
    ].join("\n")
  );
  process.exit(1);
}

function sendToon(res: ServerResponse, statusCode: number, body: BridgeBody): void {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });

  res.end(`${encode(body)}\n`);
}

async function runRemindctl(args: readonly string[], key: string): Promise<BridgeBody> {
  const command = ["remindctl", ...args, "--json"];
  const result = await execFileAsync(command[0], command.slice(1), {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });

  const body: BridgeBody = {
    [key]: JSON.parse(result.stdout || "null"),
  };

  if (process.env.NEMOCLAW_REMINDERS_BRIDGE_INCLUDE_DEBUG === "1") {
    body.command = command;
  }

  const stderr = result.stderr.trim();
  if (stderr) {
    body.stderr = stderr;
  }

  return body;
}

createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
  const allowedRoutes = ["/health", ...Object.keys(routes)];

  try {
    if (req.method !== "GET") {
      return sendToon(res, 405, { ok: false, error: "Only GET is allowed. This bridge is read-only." });
    }

    if (pathname === "/health") {
      return sendToon(res, 200, {
        ok: true,
        service: "reminders-bridge",
        mode: "read-only",
        bindHost: host,
        loopbackOnly: true,
        port,
        responseFormat: "toon",
        remindctlJson: true,
        routePayloads: { status: "status", list: "reminderLists", today: "reminders" },
        allowedRoutes,
      });
    }

    const route = routes[pathname as RoutePath];
    if (!route) {
      return sendToon(res, 404, { ok: false, error: "Unknown route", allowedRoutes });
    }

    return sendToon(res, 200, await runRemindctl(route.args, route.key));
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };

    return sendToon(res, 500, {
      ok: false,
      error: err.message,
      code: err.code || null,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
    });
  }
}).listen(port, host, () => {
  console.log(`Reminders bridge listening on http://${host}:${port}`);
  console.log(`Read-only routes: /health ${Object.keys(routes).join(" ")}`);
});