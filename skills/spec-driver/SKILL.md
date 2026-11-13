---
name: spec-driver
description: Use when a screen-spec skill needs to read or write spec data, or before calling any Screen-spec MCP tool
---

# Spec Driver

## Overview

Screen-spec skills (spec-grounding, spec-drift-guard, spec-audit, spec-design, screen-spec-setup) talk about **operations**, never raw tools. This skill is the one place that maps each operation to the backend. v1 has one driver: the Screen-spec MCP server (entry `spec-tool`), configured by `.screen-spec.json` at the repository root:

```json
{ "version": 1, "server": "<url>", "keyEnv": "SPEC_TOOL_KEY", "projects": ["<id>", "..."] }
```

No `.screen-spec.json` → no automatic spec steps: no grounding, drift gate or audit; work exactly as plain superpowers. If the user asks directly to use the spec tools anyway (and `spec-tool` is connected), do what they ask under the write rules below.

## Connection check (once per session)

Connected = `.screen-spec.json` is readable **and** the `spec-tool` tools are present **and** the first MCP call succeeds. That is enough; you do not need to look at the env var.

If you do check the env var named by `keyEnv`, check only whether it is set, never its value: `[ -n "${SPEC_TOOL_KEY:-}" ] && echo set || echo unset` (with the configured name). Never echo, print or log the key, and never dump the environment (`env`, `printenv`, `set`, `export -p`) where it would show.

Otherwise warn once per session — "screen-spec not reachable — working without spec; plans will note 'not checked against spec'" — then skip every spec operation for the rest of the session (no retries). Never block work on the spec server. Never write a key value into any file.

## Failures mid-session

The connection check passed but a later call fails (internal error, timeout, transport failure):

1. A write that fails may still have landed. Re-read (`readScreenSpec` or `listScreens`) before calling again; never retry a write blindly.
2. Retry a read or a re-checked write once. Still failing → stop the spec work and tell the developer which operations fail and what is waiting to be written (screen and items, not the content).
3. Offer three choices and wait: (a) wait while they fix the server, then retry; (b) carry on with the content they already confirmed kept in a local pending file, to write to Screen-spec once it is back; (c) stop. Never pick (b) yourself: the spec must not quietly move into a local file.
4. On (b): name the file (outside committed docs unless they ask), treat it as unwritten spec, retry the writes when the server responds, and list every pending write in each handoff until it lands. Code built from pending content is "not checked against spec".

## Feature detection (once per session)

Read the server's tool list once. A missing tool disables only the operation that needs it (no `create_design_from_html` → no `createDesign`, so no design creation); everything else runs. Do not check the server version.

## Operations

| Operation | MCP tools | Notes |
|---|---|---|
| `listProjects` | `list_projects` | Projects the key's user can access, with each project's `id` and languages. |
| `listScreens` | `list_screens`, `search_spec` | Call `list_screens` for every id in `projects`. Use `search_spec` to find a screen or rule by text. |
| `readScreenSpec` | `get_screen_spec`, `get_design_image_annotated`, `list_acceptance_criteria` | Read live every time. Keep `contentFingerprint` for writes. |
| `readFlows` | `get_flow`, `list_flows` | The flows a screen belongs to: `flows[].flowId` on `get_screen_spec`, then `get_flow({ flowId })` for the steps around it. `list_flows({ projectId })` lists a project's flows. |
| `readSharedSpec` | `list_shared_specs`, `get_shared_spec` | `get_shared_spec({ sharedSpecId })` for an item's `sharedSpecId`; `list_shared_specs({ projectId })` lists a project's shared specs. Read-only here; shared specs are never edited (write rules). |
| `screenState` | `get_screen_spec` (`screen.status`) | `draft` = writable. `review` or `approved` = comment-only. |
| `writeSpecItem` | `create_section`, `create_spec_item`, `update_spec_item`, `create_screen` | Rules below. Chain `expectedFingerprint` → `newFingerprint`. |
| `noteDrift` | `add_node_comment` | Body starts with `[spec-drift]`. Comments attach to an item, not a screen: pick the item the drift is about. No such item (e.g. a new rule on a locked screen) → comment on the closest related item and state the new behavior in the comment. The screen has no item at all → no comment is possible: tell the developer what drifted and record it as a risk in the plan or handoff. |
| `listDriftNotes` | `list_node_comments` | Keep comments that are unresolved (`resolvedAt` null) and whose body starts with `[spec-drift]`. |
| `createDesign` | `create_design_from_html` | Only after the developer approves the HTML, only on a `draft` screen. |
| `listDesignCandidates` | `list_design_candidates` | Gives each element's `bbox` and `figmaNodeId`. |
| `anchorItem` | `anchor_spec_item` | Pass `designDbId`, the candidate's `bbox` and `figmaNodeId` (e.g. `html:0.3.1`), and the `poolVersion` returned by `list_design_candidates`. Agent anchors stay suggested until a person confirms. |

## Write rules

- Only `writeSpecItem` on a `draft` screen. On `review`/`approved`, use `noteDrift` instead.
- Never call `submit_screen_for_review`; submitting for review is the person's decision.
- An item linked to a shared spec (it has `sharedSpecId`) is never edited — editing would spread to every screen using that rule. Use `noteDrift` on it.
- New items are created unanchored. Put each into an existing section that fits; create a section only when none fits. A rule with no place on the design is business logic (`specScope: "screen"`). No screen yet → `create_screen`.
- Fill every language the project is configured for, as the write tools require (check the tool schema / project). Never rewrite or re-translate text that already exists.
- Key with only the `viewer` role (writes fail with `forbidden:`) → `writeSpecItem` is unavailable; use `noteDrift`. This is normal, not an error to report.

## Designs

Designs have source `figma`, `html` or `image`; do not assume Figma. Read every design's image the same way. The `verify_anchors` prompt checks drift against Figma only — skip it for `html` and `image` designs.

## Snapshots

Do not save the spec to `suggestedSnapshotPath` unless the user asks for it.
