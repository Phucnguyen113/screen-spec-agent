---
name: screen-spec-setup
description: Use when the developer wants to connect a repository to a Screen-spec server, change which server or projects it uses, or check that an existing connection works
---

# Screen-spec Setup

## Overview

Connect this repository to a Screen-spec server: write `.screen-spec.json` and the project-level MCP config for each harness, then verify the connection. This is the one screen-spec skill that runs in a repository **without** `.screen-spec.json`, because it creates the file. Format and connection rules: **screen-spec-agent:spec-driver**.

**The API key never passes through you.** The developer creates it and sets the environment variable themselves. Never ask for the key, never echo it, and never write the key into any file, shell profile included. Config files name only the environment variable.

## Bootstrap order

The `spec-tool` MCP server is not connected until the config exists **and** the harness was restarted with the environment variable set. So spec-driver's `listProjects` (`list_projects`) cannot help pick projects on a first setup; it is the check at the end:

1. Collect server, key env var name, project ids and harnesses (steps 1–4).
2. Write the config (steps 5–6).
3. Developer sets the env var and restarts or reconnects the harness (step 7).
4. Verify with `listProjects` (step 8), usually in the new session.

Already have `.screen-spec.json` → show it and ask what the developer wants: verify it (go to step 8), or change server or projects (start at step 1). The script overwrites `.screen-spec.json` with exactly what you pass and replaces only the `spec-tool` entry in the MCP configs, so on a reconfigure pass every project id to keep, existing ones included, and every harness whose config should be updated. If `spec-tool` is already connected in this session, you may use `listProjects` in step 3 so they can pick from the list.

## 1. Server URL

Ask for the server's URL, e.g. `https://spec.example.com`, including any subpath (`https://example.com/screen-spec`). The script adds `/api/mcp` itself.

No server yet → to run one locally, follow the Quick Start in the Screen-spec repository's README (`docker compose up` for its services, then the app); the URL is then `http://localhost:3000`.

## 2. API key and env var name

Tell the developer: sign in to the web app, open **Settings → API Keys**, create a key, and copy it. They will set it as an environment variable in step 7; do not ask them for it.

Env var name: `SPEC_TOOL_KEY` by default. Use a different name (`--key-env`) only when they work with several Screen-spec servers and want a key per server. It must be an environment variable name (`^[A-Z_][A-Z0-9_]*$`), never the key itself.

If the developer pastes a key into the chat anyway: do not repeat it, do not use it, do not write it anywhere. Suggest revoking it in Settings → API Keys and creating a new one, since it is now in the chat history.

## 3. Projects

Ask for the project id(s). The id is in the web app's URL when a project is open: `…/projects/<projectId>`. A repository may list several projects (e.g. a monorepo with an admin app and a user app); grounding searches all of them.

## 4. Harnesses

Ask which harnesses the team uses in this repo: `claude` (`.mcp.json`), `codex` (`.codex/config.toml`), `opencode` (`opencode.json`). Suggest the one you are running in. Always pass the choice with `--harness`: without it the script configures `claude` only.

## 5. Write the config

From the repository root (the script writes into the current directory), run the script that ships in this skill's own directory:

```bash
node <this skill's directory>/scripts/config.mjs init --server <url> --project <id> [--project <id> ...] [--key-env <NAME>] --harness <claude,codex,opencode>
```

The script checks every input before writing anything. An error (bad URL, bad env var name, no project, unknown harness) → show the message, fix the input with the developer, run it again.

## 6. Show the result

Show the developer the script's output:

- `written: <file>` lines: the files created or updated. A chosen `codex` harness with no line for `.codex/config.toml` means that file was already up to date.
- `skipped: <file> (<reason>)` lines: the script left that file untouched (not plain JSON, unexpected shape, or a `spec-tool` entry in a form it does not rewrite). Show the snippet it printed and ask the developer to add it by hand. Do not edit the skipped file yourself.
- The final `export <NAME>=<paste key from Settings → API Keys>` line: the developer runs it themselves with their key in place of the placeholder (adding it to their shell profile is their choice). Never run it for them.

`.screen-spec.json` and the MCP config files hold no secret; committing them is up to the developer.

## 7. Restart or reconnect

Tell the developer to set the env var in the shell that starts the harness, then restart the harness or reconnect its MCP servers (in Claude Code, a restart or `/mcp`). The new session picks up `spec-tool`. Ask them to run this skill again afterwards to verify.

Tell them what the harness may ask on that restart:

- **Claude Code** asks the developer to approve the servers in a project `.mcp.json` before it connects them. They must approve `spec-tool` (or enable it later in `/mcp`).
- **Codex** loads `.codex/config.toml` only for a trusted project. If Codex has not marked this repository as trusted, it ignores the file and `spec-tool` stays missing.

## 8. Verify

Run `listProjects`. Every id in `.screen-spec.json` must be in the result.

| Result | Likely cause | Fix |
|---|---|---|
| `spec-tool` tools missing | Env var not set where the harness started, harness not restarted, a skipped config file not added, the project `.mcp.json` server not approved in Claude Code, or the repository not trusted in Codex | Set the var, add the snippet, approve the server (`/mcp`) or trust the project, restart |
| Connection error | Server down, wrong URL, or the host is not allowed by the server (see the Screen-spec repo's `docs/agent-access.md`) | Check the URL in a browser; rerun step 5 with the right one |
| `401` / unauthorized | Key wrong, revoked, or not the one in the env var | New key in Settings → API Keys, set the var again, restart |
| A configured id is missing | Wrong id, or the key's user has no access to that project | Rerun step 5 with the right ids, or ask a project maintainer for access |

All ids present → tell the developer setup is done: grounding, the drift gate and the audit are now on for this repository.

## Red flags

| Thought | Reality |
|---|---|
| "I'll ask for the key so I can put it in the config" | Never ask for it, never write the key. Configs name the env var only. |
| "No `--harness` needed, the default is fine" | The default is `claude` only. Always pass every harness the repo uses. |
| "I'll add the export line to their ~/.zshrc for them" | The developer sets the env var. No file gets the key, shell profiles included. |
| "I'll call `listProjects` so they can pick" | On a first setup it is not connected yet. Ask for the ids; verify with it after the restart. |
| "The script skipped `.mcp.json`, I'll rewrite it" | Skipped files stay untouched. Give the developer the snippet. |
| "Script printed `written`, setup is done" | Done only after `listProjects` returns every configured id. |
