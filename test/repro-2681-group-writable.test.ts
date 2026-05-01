// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..");

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf-8");
}

function dockerRunCommandBetween(
  fileParts: string[],
  startMarker: string,
  endMarker: string,
): string {
  const dockerfile = readRepoFile(...fileParts);
  const start = dockerfile.indexOf(startMarker);
  const end = dockerfile.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Expected Dockerfile block between ${startMarker} and ${endMarker}`);
  }
  const runIndex = dockerfile.indexOf("RUN ", start);
  if (runIndex === -1 || runIndex > end) {
    throw new Error(`Expected RUN instruction after ${startMarker}`);
  }
  return dockerfile
    .slice(runIndex, end)
    .trim()
    .replace(/^RUN\s+/, "")
    .replace(/\\\n/g, " ");
}

function shellFunctionFromFile(
  fileParts: string[],
  functionName: string,
  replaceSandboxWith?: string,
): string {
  const source = readRepoFile(...fileParts);
  const start = source.indexOf(`${functionName}()`);
  const nextSection = source.indexOf("\n# ──", start + functionName.length);
  if (start === -1 || nextSection === -1 || nextSection <= start) {
    throw new Error(`Expected shell function ${functionName}`);
  }
  const body = source.slice(start, nextSection).trim();
  return replaceSandboxWith ? body.replaceAll("/sandbox", replaceSandboxWith) : body;
}

function runScript(
  tmpDir: string,
  lines: string[],
  env: NodeJS.ProcessEnv = {},
): { result: ReturnType<typeof spawnSync>; log: string } {
  const logPath = path.join(tmpDir, "calls.log");
  const scriptPath = path.join(tmpDir, "run.sh");
  fs.writeFileSync(
    scriptPath,
    ["#!/usr/bin/env bash", "set -euo pipefail", `CALL_LOG=${JSON.stringify(logPath)}`, ...lines]
      .join("\n"),
    { mode: 0o700 },
  );
  const result = spawnSync("bash", [scriptPath], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
    timeout: 5000,
  });
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf-8") : "";
  return { result, log };
}

function rewriteSandbox(command: string, sandboxRoot: string): string {
  return command.replaceAll("/sandbox", sandboxRoot);
}

function mode(pathname: string): number {
  return fs.statSync(pathname).mode & 0o7777;
}

describe("Issue #2681 group-writable mutable-default contract", () => {
  it("executes base-image user and layout setup with shared sandbox-group access", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-2681-base-"));
    const sandboxRoot = path.join(tmpDir, "sandbox");

    try {
      fs.mkdirSync(sandboxRoot, { recursive: true });
      const users = runScript(tmpDir, [
        'groupadd() { printf "groupadd %s\\n" "$*" >> "$CALL_LOG"; }',
        'useradd() { printf "useradd %s\\n" "$*" >> "$CALL_LOG"; }',
        'usermod() { printf "usermod %s\\n" "$*" >> "$CALL_LOG"; }',
        'chown() { printf "chown %s\\n" "$*" >> "$CALL_LOG"; }',
        rewriteSandbox(
          dockerRunCommandBetween(
            ["Dockerfile.base"],
            "# Create sandbox user",
            "# Create .openclaw",
          ),
          sandboxRoot,
        ),
      ]);
      expect(users.result.status).toBe(0);
      expect(users.log).toContain("usermod -aG sandbox gateway");

      const layout = runScript(tmpDir, [
        'chown() { printf "chown %s\\n" "$*" >> "$CALL_LOG"; }',
        rewriteSandbox(
          dockerRunCommandBetween(
            ["Dockerfile.base"],
            "# Create .openclaw with all state subdirs directly",
            "# Pre-create shell init files",
          ),
          sandboxRoot,
        ),
      ]);
      const openclawDir = path.join(sandboxRoot, ".openclaw");
      expect(layout.result.status).toBe(0);
      expect(mode(openclawDir) & 0o020).not.toBe(0);
      expect(mode(openclawDir) & 0o2000).not.toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("executes production-image fallback setup without losing group-writable config files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-2681-prod-"));
    const sandboxRoot = path.join(tmpDir, "sandbox");
    const openclawDir = path.join(sandboxRoot, ".openclaw");

    try {
      fs.mkdirSync(openclawDir, { recursive: true });
      fs.writeFileSync(path.join(openclawDir, "openclaw.json"), "{}\n");

      const fallback = runScript(tmpDir, [
        'id() { if [ "${1:-}" = "-nG" ]; then printf "gateway\\n"; return 0; fi; return 0; }',
        'usermod() { printf "usermod %s\\n" "$*" >> "$CALL_LOG"; }',
        dockerRunCommandBetween(
          ["Dockerfile"],
          "# Stale-base fallback for the gateway-in-sandbox-group setup",
          "# Keep the image readable",
        ),
      ]);
      expect(fallback.result.status).toBe(0);
      expect(fallback.log).toContain("usermod -aG sandbox gateway");

      const layout = runScript(tmpDir, [
        'chown() { printf "chown %s\\n" "$*" >> "$CALL_LOG"; }',
        rewriteSandbox(
          dockerRunCommandBetween(
            ["Dockerfile"],
            "# `chmod g+w` + setgid",
            "# Pin config hash",
          ),
          sandboxRoot,
        ),
      ]);
      expect(layout.result.status).toBe(0);
      expect(mode(openclawDir) & 0o020).not.toBe(0);
      expect(mode(openclawDir) & 0o2000).not.toBe(0);

      const hash = runScript(tmpDir, [
        'chown() { printf "chown %s\\n" "$*" >> "$CALL_LOG"; }',
        'sha256sum() { printf "hash  %s\\n" "$1"; }',
        rewriteSandbox(
          dockerRunCommandBetween(
            ["Dockerfile"],
            "# Pin config hash",
            "# DAC-protect .nemoclaw directory",
          ),
          sandboxRoot,
        ),
      ]);
      expect(hash.result.status).toBe(0);
      expect((mode(path.join(openclawDir, ".config-hash")) & 0o777).toString(8)).toBe("664");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("normalizes mutable config permissions only when the config dir is not locked", () => {
    const runCase = (owner: "root" | "sandbox") => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `nemoclaw-2681-normalize-${owner}-`));
      const sandboxRoot = path.join(tmpDir, "sandbox");
      const openclawDir = path.join(sandboxRoot, ".openclaw");
      try {
        fs.mkdirSync(path.join(openclawDir, "workspace"), { recursive: true });
        fs.chmodSync(openclawDir, 0o755);
        fs.chmodSync(path.join(openclawDir, "workspace"), 0o755);
        const script = shellFunctionFromFile(
          ["scripts", "nemoclaw-start.sh"],
          "normalize_mutable_config_perms",
          sandboxRoot,
        );
        const { result } = runScript(
          tmpDir,
          [
            'id() { if [ "${1:-}" = "-u" ]; then printf "0"; return 0; fi; command id "$@"; }',
            'stat() { if [ "${1:-}" = "-c" ] || [ "${1:-}" = "-f" ]; then printf "%s\\n" "$CONFIG_OWNER"; return 0; fi; command stat "$@"; }',
            script,
            "normalize_mutable_config_perms",
          ],
          { CONFIG_OWNER: owner },
        );
        return { result, openclawDir, tmpDir };
      } catch (err) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        throw err;
      }
    };

    const locked = runCase("root");
    try {
      expect(locked.result.status).toBe(0);
      expect(mode(locked.openclawDir) & 0o020).toBe(0);
      expect(mode(locked.openclawDir) & 0o2000).toBe(0);
    } finally {
      fs.rmSync(locked.tmpDir, { recursive: true, force: true });
    }

    const unlocked = runCase("sandbox");
    try {
      expect(unlocked.result.status).toBe(0);
      expect(mode(unlocked.openclawDir) & 0o020).not.toBe(0);
      expect(mode(unlocked.openclawDir) & 0o2000).not.toBe(0);
    } finally {
      fs.rmSync(unlocked.tmpDir, { recursive: true, force: true });
    }
  });
});
