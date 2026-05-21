// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { HermesAuthMethod } from "../hermes-provider-auth";
import * as hermesProviderAuth from "../hermes-provider-auth";

export type { HermesAuthMethod };

export const HERMES_AUTH_METHOD_OAUTH: HermesAuthMethod = "oauth";
export const HERMES_AUTH_METHOD_API_KEY: HermesAuthMethod = "api_key";
export const HERMES_NOUS_API_KEY_CREDENTIAL_ENV =
  hermesProviderAuth.HERMES_NOUS_API_KEY_CREDENTIAL_ENV || "NOUS_API_KEY";
export const HERMES_NOUS_API_KEY_HELP_URL = "https://portal.nousresearch.com/manage-subscription";

export function normalizeHermesAuthMethod(value: string | null | undefined): HermesAuthMethod | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (normalized === "oauth" || normalized === "nous_oauth" || normalized === "nous_portal_oauth") {
    return HERMES_AUTH_METHOD_OAUTH;
  }
  if (
    normalized === "api" ||
    normalized === "key" ||
    normalized === "api_key" ||
    normalized === "apikey" ||
    normalized === "nous_api_key"
  ) {
    return HERMES_AUTH_METHOD_API_KEY;
  }
  return null;
}

export function hermesAuthMethodLabel(method: HermesAuthMethod | null | undefined): string {
  return method === HERMES_AUTH_METHOD_API_KEY ? "Nous API Key" : "Nous Portal OAuth";
}

export function getRequestedHermesAuthMethod(): HermesAuthMethod | null {
  const raw =
    process.env.NEMOCLAW_HERMES_AUTH_METHOD ||
    process.env.NEMOCLAW_HERMES_AUTH ||
    process.env.NEMOCLAW_NOUS_AUTH_METHOD ||
    "";
  const method = normalizeHermesAuthMethod(raw);
  if (!raw || method) return method;
  console.error(`  Unsupported Hermes Provider auth method: ${raw}`);
  console.error("  Valid values: oauth, nous-portal-oauth, api-key, nous-api-key");
  process.exit(1);
}
