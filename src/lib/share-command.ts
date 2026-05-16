// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * `nemoclaw <name> share mount|unmount|status` — SSHFS-based sandbox file sharing.
 *
 * Mounts the sandbox filesystem on the host via SSHFS, tunneled through
 * OpenShell's existing SSH proxy. Requires `sshfs` on the host and
 * `openssh-sftp-server` in the sandbox image.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { buildShareCommandDeps } from "./share-command-deps";
import type { ShareCommandDeps } from "./share-command-deps";

export class ShareCommandError extends Error {
  readonly lines: readonly string[];
  readonly exitCode: number;

  constructor(lines: string | readonly string[], exitCode = 1) {
    const normalized = Array.isArray(lines) ? lines : [lines];
    super(normalized.join("\n"));
    this.name = "ShareCommandError";
    this.lines = normalized;
    this.exitCode = exitCode;
  }
}

function shareFail(lines: string | readonly string[], exitCode = 1): never {
  throw new ShareCommandError(lines, exitCode);
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Check whether a path is an active mount point.
 * Uses `mountpoint -q` on Linux (reliable), falls back to parsing
 * `mount` output on macOS or when mountpoint is unavailable.
 */
export function isMountPoint(dir: string): boolean {
  const resolved = path.resolve(dir);
  if (process.platform !== "darwin") {
    const mp = spawnSync("mountpoint", ["-q", resolved], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    if (mp.status === 0) return true;
    if (mp.status === 1) return false;
  }
  const result = spawnSync("mount", [], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return false;
  const escaped = resolved.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(` on ${escaped}(?: |$)`);
  return pattern.test(result.stdout || "");
}

export function defaultShareMountDir(sandboxName: string): string {
  return path.join(process.env.HOME || os.homedir(), ".nemoclaw", "mounts", sandboxName);
}

/**
 * Resolve the fusermount binary for Linux. FUSE 3 ships `fusermount3`;
 * older FUSE 2 ships `fusermount`. Probe both, preferring v3.
 */
export function resolveLinuxUnmount(): string | null {
  for (const cmd of ["fusermount3", "fusermount"]) {
    const probe = spawnSync("sh", ["-c", `command -v ${cmd}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (probe.status === 0 && (probe.stdout || "").trim()) {
      return (probe.stdout || "").trim();
    }
  }
  return null;
}

export type ShareMountOptions = {
  sandboxName: string;
  remotePath?: string;
  localMount?: string;
};

export type ShareUnmountOptions = {
  sandboxName: string;
  localMount?: string;
};

export type ShareStatusOptions = {
  sandboxName: string;
  localMount?: string;
};

export async function runShareMount(
  options: ShareMountOptions,
  deps: ShareCommandDeps = buildShareCommandDeps(),
): Promise<void> {
  const { sandboxName } = options;
  const remotePath = options.remotePath || "/sandbox";
  const localMount = options.localMount || defaultShareMountDir(sandboxName);
  const G = deps.colorGreen;
  const R = deps.colorReset;

  // Preflight: check sshfs binary
  const sshfsCheck = spawnSync("sh", ["-c", "command -v sshfs"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (sshfsCheck.status !== 0) {
    shareFail([
      "  sshfs is not installed.",
      process.platform === "darwin"
        ? "  Install with: brew install macfuse && brew install sshfs"
        : "  Install with: sudo apt-get install sshfs  (or: sudo dnf install fuse-sshfs)",
    ]);
  }

  // Check not already mounted
  if (isMountPoint(localMount)) {
    shareFail([
      `  ${localMount} is already mounted.`,
      `  Run '${deps.cliName} ${sandboxName} share unmount' first.`,
    ]);
  }

  // Verify sandbox is running
  await deps.ensureLive(sandboxName);

  // Get SSH config
  const sshConfigResult = deps.getSshConfig(sandboxName);
  if (sshConfigResult.status !== 0) {
    shareFail("  Failed to obtain SSH configuration for the sandbox.");
  }

  // Use a private temp directory to prevent symlink attacks on predictable paths.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-sshfs-"));
  const tmpFile = path.join(tmpDir, `${sandboxName}.conf`);
  fs.writeFileSync(tmpFile, sshConfigResult.output, { mode: 0o600, flag: "wx" });
  fs.mkdirSync(localMount, { recursive: true });

  let mountFailed = false;
  try {
    const result = spawnSync(
      "sshfs",
      [
        "-F",
        tmpFile,
        "-o",
        "sftp_server=/usr/lib/openssh/sftp-server",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=/dev/null",
        "-o",
        "reconnect",
        "-o",
        "ServerAliveInterval=15",
        "-o",
        "ServerAliveCountMax=3",
        `openshell-${sandboxName}:${remotePath}`,
        localMount,
      ],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 },
    );
    if (result.status !== 0) {
      const stderr = (result.stderr || "").trim();
      mountFailed = true;
      const lines = ["  SSHFS mount failed."];
      if (stderr) lines.push(`  ${stderr}`);
      if (/sftp/i.test(stderr)) {
        lines.push("  The sandbox may lack openssh-sftp-server.");
        lines.push(
          `  If this sandbox uses the default base image, rebuild with: ${deps.cliName} ${sandboxName} rebuild --yes`,
        );
        lines.push(
          "  If it was created from a custom `--from` image, add openssh-sftp-server at /usr/lib/openssh/sftp-server and rebuild.",
        );
      }
      shareFail(lines);
    } else {
      console.log(`  ${G}✓${R} Mounted ${remotePath} → ${localMount}`);
      console.log(`  Edit files at ${localMount} — changes appear in the sandbox instantly.`);
    }
  } finally {
    try {
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
  }
  if (mountFailed) shareFail("  SSHFS mount failed.");
}

export function runShareUnmount(
  options: ShareUnmountOptions,
  deps: ShareCommandDeps = buildShareCommandDeps(),
): void {
  const { sandboxName } = options;
  const localMount = options.localMount || defaultShareMountDir(sandboxName);
  const G = deps.colorGreen;
  const R = deps.colorReset;

  let unmountCmd: string;
  let unmountArgs: string[];
  if (process.platform === "darwin") {
    unmountCmd = "umount";
    unmountArgs = [localMount];
  } else {
    const resolved = resolveLinuxUnmount();
    if (!resolved) {
      shareFail([
        "  Could not find fusermount3 or fusermount on this host.",
        "  Install with: sudo apt-get install fuse3  (or: sudo dnf install fuse3)",
      ]);
    }
    unmountCmd = resolved;
    unmountArgs = ["-u", localMount];
  }

  const result = spawnSync(unmountCmd, unmountArgs, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    if (/not mounted|not found|no mount/i.test(stderr)) {
      shareFail(`  ${localMount} is not currently mounted.`);
    }
    const lines = [`  Unmount failed: ${stderr || "unknown error"}`];
    if (process.platform !== "darwin") {
      lines.push(`  Try: ${unmountCmd} -uz ${localMount}`);
    }
    shareFail(lines);
  }
  console.log(`  ${G}✓${R} Unmounted ${localMount}`);
}

export function runShareStatus(
  options: ShareStatusOptions,
  deps: ShareCommandDeps = buildShareCommandDeps(),
): void {
  const { sandboxName } = options;
  const localMount = options.localMount || defaultShareMountDir(sandboxName);
  const G = deps.colorGreen;
  const R = deps.colorReset;
  if (isMountPoint(localMount)) {
    console.log(`  ${G}●${R} Mounted at ${localMount}`);
  } else {
    console.log(`  ○ Not mounted (expected at ${localMount})`);
  }
}

export function printShareUsageAndExit(exitCode = 1): never {
  const { cliName } = buildShareCommandDeps();
  shareFail([
    `  Usage: ${cliName} <name> share <mount|unmount|status>`,
    "    mount   [sandbox-path] [local-mount-point]  Mount sandbox filesystem via SSHFS",
    "    unmount [local-mount-point]                 Unmount a previously mounted filesystem",
    "    status  [local-mount-point]                 Check current mount status",
  ], exitCode);
}
