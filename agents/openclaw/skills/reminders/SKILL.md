---
name: reminders
description: Read macOS Reminders through the NemoClaw/OpenShell host bridge.
---

# Reminders

Use this skill when the user asks to read, check, list, view, or summarize macOS Reminders.

OpenClaw runs inside a Linux sandbox in NemoClaw/OpenShell, so do not call `remindctl` directly from inside the sandbox.

Reminders is a macOS host capability. Use the approved read-only host bridge.

## Bridge route

Use the named host route:

```bash
http://reminders.local:8765
```

Do not use `host.docker.internal` in normal skill execution. The policy preset for this skill allows `reminders.local:8765` only.

## Available commands

Check bridge health:

```bash
curl http://reminders.local:8765/health
```

Check Reminders status:

```bash
curl http://reminders.local:8765/status
```

List reminder lists:

```bash
curl http://reminders.local:8765/list
```

Show today's reminders:

```bash
curl http://reminders.local:8765/today
```

## Response format

The bridge returns TOON-formatted `text/plain` output for all routes.

Treat the response as structured data optimized for LLM reading.

Expected payload keys:

- `/health` returns bridge metadata.
- `/status` returns `status`.
- `/list` returns `reminderLists`.
- `/today` returns `reminders`.

## Rules

- Read-only mode only.
- Do not create reminders.
- Do not update reminders.
- Do not complete reminders.
- Do not delete reminders.
- Do not rename reminder lists.
- Do not call `remindctl` directly.
- Do not use routes other than `/health`, `/status`, `/list`, and `/today`.
- If the bridge request fails, explain that the Reminders host bridge may not be running or the `reminders.local` host alias/policy may not be configured.