// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Command, Flags } from "@oclif/core";

export type CommandExitResult = {
  exitCode?: number | null;
  message?: string | null;
  status?: number | null;
};

/**
 * Shared oclif base for NemoClaw commands.
 *
 * Keep CLI-wide parser conventions here so individual command classes only
 * describe their own grammar.
 */
export abstract class NemoClawCommand extends Command {
  static baseFlags = {
    help: Flags.help({ char: "h" }),
  };

  protected logJson(json: unknown): void {
    console.log(JSON.stringify(json, null, 2));
  }

  protected setExitCode(code: number): void {
    process.exitCode = code;
  }

  protected applyExitResult(result: CommandExitResult): void {
    const code =
      typeof result.exitCode === "number"
        ? result.exitCode
        : typeof result.status === "number"
          ? result.status
          : 0;
    if (code !== 0 && result.message) console.error(result.message);
    this.setExitCode(code);
  }
}
