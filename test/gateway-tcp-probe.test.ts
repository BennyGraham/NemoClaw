// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for verifyDockerDriverGatewayListening() — the TCP liveness
// probe that gates the "Docker-driver gateway is healthy" log in
// startDockerDriverGateway against the false-positive class of bug
// reported in #3111.
//
// See: https://github.com/NVIDIA/NemoClaw/issues/3111

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

// Import from the compiled output to match other onboard tests
// (src/lib/onboard.ts uses runtime require() calls that only resolve
// correctly under the built layout).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verifyDockerDriverGatewayListening } = require("../dist/lib/onboard");

const ROOT = path.resolve(import.meta.dirname, "..");

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Start a TCP server that accepts connections on 127.0.0.1:<port> and
 * returns the port + a close() teardown.
 */
function startDummyServer(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      // Accept and immediately close — we only care that the handshake succeeds.
      socket.end();
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res())),
          ),
      });
    });
  });
}

/**
 * Return a port that is unlikely to be listened on at test time. We rely on
 * the OS-assigned port trick: bind a server, capture its port, close it,
 * and use the (now freed) port. Racy in theory, stable in practice for CI.
 */
async function getLikelyClosedPort(): Promise<number> {
  const { port, close } = await startDummyServer();
  await close();
  return port;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("verifyDockerDriverGatewayListening (#3111)", () => {
  let teardown: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (teardown) {
      await teardown();
      teardown = null;
    }
  });

  it("resolves true when something is accepting connections", async () => {
    const { port, close } = await startDummyServer();
    teardown = close;
    const reachable = await verifyDockerDriverGatewayListening(port, 500);
    expect(reachable).toBe(true);
  });

  it("resolves false when nothing is listening (Connection refused)", async () => {
    const port = await getLikelyClosedPort();
    const reachable = await verifyDockerDriverGatewayListening(port, 500);
    expect(reachable).toBe(false);
  });

  it("resolves false on timeout (host unreachable)", async () => {
    // 10.255.255.1 is a non-routable RFC 1918 address that will SYN-drop
    // on most runners, forcing the timeout path rather than immediate
    // ECONNREFUSED. We use a short timeout to keep the test fast.
    const started = Date.now();
    const reachable = await verifyDockerDriverGatewayListening(9, 200, "10.255.255.1");
    const elapsed = Date.now() - started;
    expect(reachable).toBe(false);
    // Allow generous slack for slow CI but guard against the probe
    // accidentally blocking on a multi-second kernel default timeout.
    expect(elapsed).toBeLessThan(2000);
  });

  it("enforces a minimum timeout of 50ms even when caller passes 0", async () => {
    // Regression guard: we clamp timeoutMs to 50 to avoid spinning on
    // synchronous immediate-timeout settings that some net implementations
    // treat as "no timeout".
    const port = await getLikelyClosedPort();
    const started = Date.now();
    const reachable = await verifyDockerDriverGatewayListening(port, 0);
    const elapsed = Date.now() - started;
    expect(reachable).toBe(false);
    // Shouldn't hang — on a closed localhost port ECONNREFUSED is immediate.
    expect(elapsed).toBeLessThan(500);
  });

  it("never throws — always resolves with a boolean", async () => {
    // Feed garbage parameters (port 0 which will be rewritten by OS, etc.)
    // and verify we still resolve instead of rejecting.
    await expect(verifyDockerDriverGatewayListening(0, 100)).resolves.toBeTypeOf(
      "boolean",
    );
    await expect(verifyDockerDriverGatewayListening(65535, 100)).resolves.toBe(false);
  });
});

// ── Source-shape guards — keep the integration in startDockerDriverGateway ──
// consistent with the design in ACCEPTANCE.md so future edits don't silently
// regress the #3111 fix.

describe("startDockerDriverGateway integration (#3111)", () => {
  const content = fs.readFileSync(path.join(ROOT, "src/lib/onboard.ts"), "utf-8");
  // Extract just the startDockerDriverGateway function body so other
  // occurrences of the helpers (e.g., in stale-gateway reuse or module.exports)
  // don't satisfy the source-shape checks.
  const fnMatch = content.match(
    /async function startDockerDriverGateway\([\s\S]*?\n\}\n/,
  );
  if (!fnMatch) {
    throw new Error(
      "Expected 'async function startDockerDriverGateway' block in src/lib/onboard.ts",
    );
  }
  const fnBody = fnMatch[0];

  it("tracks child-exit so zombies don't fool isPidAlive", () => {
    // The fix pattern: a single 'exit' listener on the spawned ChildProcess
    // that flips a flag the poll loop reads instead of relying solely on
    // process.kill(pid, 0). Scope the regex to this function body.
    expect(fnBody).toMatch(/child\.once\(\s*["']exit["']/);
    expect(fnBody).toMatch(/childExited\s*=\s*true/);
  });

  it("breaks the poll loop when the child has exited", () => {
    // The top of the loop body should consult childExited OR isPidAlive,
    // not isPidAlive alone.
    expect(fnBody).toMatch(/childExited\s*\|\|\s*!isPidAlive\(childPid\)/);
  });

  it("gates the 'healthy' log on a real TCP probe", () => {
    // The poll loop must call verifyDockerDriverGatewayListening before
    // console.log("  ✓ Docker-driver gateway is healthy").
    // Check ordering by slicing around the 'healthy' log line.
    const healthyIdx = fnBody.indexOf("Docker-driver gateway is healthy");
    expect(healthyIdx).toBeGreaterThan(0);
    const before = fnBody.slice(0, healthyIdx);
    expect(before).toMatch(/verifyDockerDriverGatewayListening\(GATEWAY_PORT/);
  });

  it("surfaces child-exit details in the final failure message", () => {
    // On failure, the user must see *why* the gateway didn't come up —
    // signal or exit code — not just "failed to start".
    expect(fnBody).toMatch(/childExited/);
    expect(fnBody).toMatch(/childExitSignal|childExitCode/);
  });
});
