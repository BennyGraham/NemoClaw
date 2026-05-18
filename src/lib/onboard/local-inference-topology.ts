// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { dockerInfo } from "../adapters/docker/info";
import {
  containerCanReachHostLoopback,
  type ContainerRuntime,
  inferContainerRuntime,
} from "../platform";

export function getContainerRuntime(): ContainerRuntime {
  return inferContainerRuntime(dockerInfo({ ignoreError: true }));
}

// True when the sandbox container needs the local Ollama auth proxy in front
// of raw Ollama. False only under Docker Desktop on WSL, where the docker-
// desktop VM publishes the host's 127.0.0.1 back into containers through
// host.docker.internal. (#3695)
export function shouldFrontOllamaWithProxy(): boolean {
  return !containerCanReachHostLoopback(getContainerRuntime());
}
