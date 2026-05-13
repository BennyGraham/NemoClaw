// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";

import { gpuPassthroughRecoveryLines } from "./onboard/gpu-recovery";

describe("gpuPassthroughRecoveryLines", () => {
  it("suggests uninstall when no sandboxes are registered (no actionable destroy target)", () => {
    const lines = gpuPassthroughRecoveryLines([]);
    expect(lines).toEqual([
      "  Existing gateway was started without GPU passthrough.",
      "  No sandboxes are registered, so there is nothing for `nemoclaw <name> destroy` to act on.",
      "  To enable GPU, clear the stale gateway state and re-onboard:",
      "    nemoclaw uninstall && nemoclaw onboard --gpu",
    ]);
  });

  it("names the registered sandbox in the destroy command (singular form)", () => {
    const lines = gpuPassthroughRecoveryLines(["my-assistant"]);
    expect(lines).toEqual([
      "  Existing gateway was started without GPU passthrough.",
      "  To enable GPU, destroy the registered sandbox (`my-assistant`) and re-onboard:",
      "    nemoclaw my-assistant destroy --yes",
      "    nemoclaw onboard --gpu",
    ]);
  });

  it("lists every registered sandbox (plural form)", () => {
    const lines = gpuPassthroughRecoveryLines(["alpha", "beta"]);
    expect(lines).toEqual([
      "  Existing gateway was started without GPU passthrough.",
      "  To enable GPU, destroy the registered sandboxes (`alpha`, `beta`) and re-onboard:",
      "    nemoclaw alpha destroy --yes",
      "    nemoclaw beta destroy --yes",
      "    nemoclaw onboard --gpu",
    ]);
  });

  it("never emits the literal `<name>` placeholder in any suggestion", () => {
    expect(gpuPassthroughRecoveryLines([]).every((l) => !l.includes("nemoclaw <name> destroy --yes"))).toBe(true);
    expect(gpuPassthroughRecoveryLines(["x"]).every((l) => !l.includes("nemoclaw <name> destroy --yes"))).toBe(true);
  });
});
