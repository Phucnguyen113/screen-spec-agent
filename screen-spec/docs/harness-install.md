# Harness install mechanics

Commands below come from `--help` output and upstream's install docs in this repo
(`.opencode/INSTALL.md`, `.codex-plugin/`, `.agents/plugins/marketplace.json`,
`.claude-plugin/`). They are **from help/docs, not verified by a real install**:
no plugin was installed, uninstalled, enabled or disabled while writing this, and
no user-level harness config was edited. Only read-only listing commands were run.

Versions inspected: Claude Code 2.1.323, Codex CLI 0.167.1, OpenCode 1.18.27.

`<name>` is `kit.config.json` `name`, `<repo>` is the mirror git URL (`distRepo`).
The dist build names both the marketplace and the plugin `<name>`.

| Harness | Install | List installed (read-only) |
| --- | --- | --- |
| Claude Code | `claude plugin install <name> --marketplace <repo>` (adds the marketplace first if missing; user scope by default, `--scope project` adds `--scope project`) | `claude plugin list --json` (array of `{ id: "plugin@marketplace", ... }`) |
| Codex | `codex plugin marketplace add <repo>` then `codex plugin add <name>@<name>` | `codex plugin list --json` (`{ installed: [{ name, pluginId, ... }] }`) |
| OpenCode | no CLI install for git specs: merge `"<name>@git+<repo>.git"` into the `plugin` array of `~/.config/opencode/opencode.json` (honours `XDG_CONFIG_HOME`) | read that config file |

OpenCode V2 (2.0.4+) uses the `plugins` key instead of `plugin`; the installer
writes `plugin` (V1 form, the installed 1.18.27 uses it). `opencode plugin <module>`
exists but takes an npm module name, so the installer edits the config directly.
If the file is not plain JSON (for example JSONC with comments) the installer
prints the snippet instead of editing it.

## Scope and prompts

The installer never installs silently. It prints what goes where and that the kit
replaces upstream superpowers (same skill names), then asks `Install into <harness>
(<scope>)? [y/N]` per harness. Without a TTY it installs nothing and exits 1 unless
`--yes` is given. `--only claude,codex,opencode` limits harnesses, `--scope user|project`
picks the scope (default `user`).

| Harness | `--scope user` | `--scope project` (run in the repo root) |
| --- | --- | --- |
| Claude Code | `claude plugin install <name> --marketplace <repo>` | same with `--scope project`, run in the current directory |
| Codex | `codex plugin marketplace add <repo>`, `codex plugin add <name>@<name>` | skipped: `codex plugin add` has no scope option, Codex is global only |
| OpenCode | entry in `~/.config/opencode/opencode.json` | entry in `./opencode.json` in the current directory |

Project scope warns when the current directory has no `.git`.

## Uninstall

- Claude Code: `claude plugin uninstall <name>@<name>` and `claude plugin marketplace remove <name>`
  (for the default name: `claude plugin uninstall screen-spec-agent@screen-spec-agent`,
  `claude plugin marketplace remove screen-spec-agent`).
- Codex: `codex plugin remove <name>@<name>` and `codex plugin marketplace remove <name>`
  (`codex plugin remove screen-spec-agent@screen-spec-agent`, `codex plugin marketplace remove screen-spec-agent`).
- OpenCode: remove the `<name>@git+<repo>.git` entry from the `plugin` list of the config file you edited.

Upstream removal hints printed on a conflict (never run automatically):
`claude plugin uninstall superpowers`, `codex plugin remove superpowers`, and for
OpenCode removing the upstream entry from the config plugin list.

## Subdirectory installs

- Claude Code: `claude plugin marketplace add --sparse <paths...>` and Codex:
  `codex plugin marketplace add --sparse <PATH>` only limit what is checked out.
  A marketplace still has to sit at the repo root (`.claude-plugin/marketplace.json`,
  `.agents/plugins/marketplace.json`), and a plugin entry can point at a relative
  subdirectory `source`. So both harnesses can install a plugin that lives in a
  subdirectory, provided the repo root carries a marketplace file.
- OpenCode: the `pkg@git+<url>` spec clones the repo and treats its root as the
  npm package (root `package.json`, `main`). It cannot point at a subdirectory.

Conclusion: the monorepo root (Screen-spec) is not a package root, so the
separate mirror repo (`distRepo`) stays; it is what OpenCode needs, and one repo
then serves all three harnesses.
