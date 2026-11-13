# Screen-spec Agent

Powered by [superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

Screen-spec's agent workflow, built on superpowers. Needs a Screen-spec server (flows whose MCP tools the server lacks turn themselves off); without `.screen-spec.json` it behaves like upstream superpowers.

This kit is one part of Screen-spec, next to the web app, the Figma plugin and the MCP server. It is a fork of superpowers (MIT, Copyright (c) 2025 Jesse Vincent); upstream's `LICENSE` is kept as is.

## Install

```sh
npx github:{{distRepoSlug}}
```

{{distRepo}} is the distribution repo. Its name comes from `distRepo` in `screen-spec/kit.config.json`, which the release build fills in here. The installer never installs silently. It prints what will be installed where and asks `Install into <harness> (<scope>)? [y/N]` for each supported harness found on your PATH (default No). Without a terminal it installs nothing unless you pass `--yes`. It does not write any MCP configuration.

- `--yes`: skip the prompts (the notice is still printed).
- `--only claude,codex,opencode`: only these harnesses.
- `--scope user|project`: default `user`. `project` installs into the current repo (Claude Code and `./opencode.json`); Codex has no project scope and is skipped.
- `--dry-run`: print the plan only.

This kit replaces upstream superpowers: it ships skills with the same names, so running both duplicates them. If the installer detects upstream, it prints the uninstall command and leaves it alone. To remove the kit, see [`screen-spec/docs/harness-install.md`](screen-spec/docs/harness-install.md).

The install commands it runs come from each harness's `--help` output and docs. They have not been verified by a real install. See [`screen-spec/docs/harness-install.md`](screen-spec/docs/harness-install.md) for the exact commands per harness.

## Setup

In a project repo, ask your agent to run the `screen-spec-setup` skill. It writes `.screen-spec.json` (server URL, name of the env var that holds your API key, project ids) and a project-level MCP config for your harness. The key itself is never written to a file; export it in the env var (default `SPEC_TOOL_KEY`).

## Supported harnesses

Claude Code, Codex and OpenCode. Other harnesses that upstream superpowers supports are inherited from upstream and untested here.

## Evals

Scenario evals run a headless agent against a fake Screen-spec server. They are manual, cost model tokens, and are not part of the test suite. See [`screen-spec/evals/README.md`](screen-spec/evals/README.md) (in the Screen-spec monorepo; evals are not shipped in this repo).

## Upstream sync

Which superpowers version this is based on, and how to pull a newer one, is in [`screen-spec/UPSTREAM.md`](screen-spec/UPSTREAM.md).

## Releasing (maintainers)

Pushing a tag `agent-kit-v<version>` to the Screen-spec monorepo runs `.github/workflows/agent-kit-release.yml`. It runs the kit tests, builds `dist/` with `screen-spec/release/build-dist.mjs`, and pushes it as a commit and a `v<version>` tag to the distribution repo. It needs:

- repository variable `AGENT_KIT_DIST_REPO`: the distribution repo as `owner/name`;
- repository secret `AGENT_KIT_DIST_DEPLOY_KEY`: private half of a deploy key with write access to that repo.

If either is missing the workflow fails with a message and pushes nothing.
