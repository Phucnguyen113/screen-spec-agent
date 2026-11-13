---
name: spec-design
description: Use when a screen in a repository with a .screen-spec.json file has no design, or needs designs for more states, and the developer wants the agent to make them as HTML
---

# Spec Design

## Overview

Make a screen's design without a designer or Figma: write it as one HTML document, let the developer preview it, push it to Screen-spec only after the dev approves, then anchor the screen's spec items to the elements the server extracted. Operation names and write rules come from **screen-spec-agent:spec-driver**; this skill does not repeat them. The operations used here are `createDesign`, `listDesignCandidates` and `anchorItem` (server tools `create_design_from_html`, `list_design_candidates`, `anchor_spec_item`), plus `readScreenSpec` and `screenState`. Attribute reference and limits: `references/html-design-rules.md`.

Called by brainstorming when a screen's mockup is approved, and by **screen-spec-agent:spec-grounding** when a screen has no design. The developer decides whether to use it.

## 1. Preconditions

- spec-driver's connection check passed. Not connected → no design push; the mockup stays a brainstorming mockup.
- spec-driver's feature detection found `createDesign` (server tool `create_design_from_html`). Missing → tell the developer "this Screen-spec server cannot create designs from HTML (no create_design_from_html tool)" and stop this flow. Everything else carries on.
- Know the screen (spec-grounding step 2). No screen yet → spec-grounding creates it first.
- `readScreenSpec` and `screenState`. Only a `draft` screen takes a design. `review` or `approved` → say the screen is locked, push nothing, and stop; a missing design on a locked screen is a person's call.
- Read the allowlist of CDN hosts from the `create_design_from_html` tool description (the sentence "External resources ... only over https from: ..."). Never use a host that is not on it, and never assume a list from memory. Empty list → inline everything.

## 2. Write the HTML

One full document per screen (starts with `<!DOCTYPE html>`), following `references/html-design-rules.md`:

- One `[data-design="<label>"]` per state: main, empty, error, loading, a dialog, and so on. Use only the states the spec or the developer calls for. Give each a clear, distinct label. A phone screen sets `data-width="390"` on its sections.
- Every element that is a spec item gets `data-spec-name` = that item's `name` exactly as `readScreenSpec` returns it, and `data-spec-type` = one of the server's item types (listed in the reference), normally the item's `itemType`.
- Items whose name repeats within the screen are ambiguous; annotate them anyway but expect them not to anchor (step 5).
- Decoration (backgrounds, dividers, illustrations, filler text) gets `data-spec-ignore`, so it does not crowd the candidates.
- Items with `specScope: "screen"` are business logic, not on the design; do not annotate them.
- Stay inside the limits: at most 5MB, 20 sections, 8,000 CSS px per section, static HTML only (no fetch, no iframe), CDNs only from the allowlist.
- Use realistic content from the spec (labels, messages, sample data), in the project's source language.

## 3. Preview

Show the document through brainstorming's visual companion (see brainstorming's `visual-companion.md`): write it as a new file in the companion's screen directory. A file that starts with `<!DOCTYPE` is served as a full document, as-is. No companion running → offer to start it as that guide says; the developer declines → give them the file path to open in a browser.

Ask the developer to check every state. Revise with a new file each round (`<screen>-v2.html`, ...). The file is a working copy: do not commit it to the repository unless the developer asks.

## 4. Push

Push only after the dev says yes to this exact version. Re-check `screenState` right before: it must still be `draft`.

`createDesign` with `screenId`, the `html` (the approved file, not what the companion served), and `width` if the sections need one other than the default. Pass `sections` only to push some of the states.

- Success → note each new design's `id`, `label` and `candidateCount`, and pass any `warnings` on to the developer.
- `businessError` that lists problems in the HTML → fix exactly those, keep everything else, and call again. At most two retries; still refused → stop and show the developer the reasons. A fix that changes what the developer saw → show them again before pushing.
- `businessError` that is not about the HTML (rate limited, approved screen, `forbidden:` for a viewer key) → do not edit the HTML; tell the developer and stop.
- Transport failure → the designs may already exist: `readScreenSpec` and look for them before calling again. Never retry blindly.

## 5. Anchor the spec items

For each new design:

1. `listDesignCandidates` with `designDbId` = the design's `id` and `limit: 500` (the default returns fewer). Keep its `poolVersion`.
2. For each spec item that is not yet anchored (no `designId`), not `specScope: "screen"`, and that you annotated in this design: find the candidates whose `figmaName` equals the item's name (= its `data-spec-name`) **and** whose `itemType` equals the `data-spec-type` you set on that element. A candidate with the right name but a different `itemType` is not that element: never anchor to it. Exactly one candidate matches both → anchor it. Several match both → ambiguous. None matches both, but some match the name only (even just one) → ambiguous too: leave the item unanchored and tell the developer.
3. `anchorItem` with `nodeId` = the item's `id`, `designDbId` = the design's `id`, the candidate's `bbox` and `figmaNodeId` (e.g. `html:0.3.1`) verbatim, the `poolVersion`, and the current fingerprint, chaining `expectedFingerprint` → `newFingerprint` as spec-driver says. Skip candidates that have `anchoredByNodeId` set.
4. An item shown in several states is anchored once, on the first design (in section order) where it matches.

Items that match no candidate, or only ambiguously, stay unanchored. Never guess with a hand-drawn bbox. List them for the developer by name, with the reason (no match / ambiguous), so they can anchor them on the web app or rename the element and push again.

## 6. Hand off

Anchors made by the agent are always `suggested`; nothing is confirmed until a person confirms it. Tell the developer:

- which designs were created on which screen (labels, with a pointer to the screen),
- how many items were anchored, and which stayed unanchored and why,
- to confirm the `suggested` anchors on the Screen-spec web app.

## Red flags

| Thought | Reality |
|---|---|
| "They liked the first draft, I'll push it" | Push only after the dev says yes to this exact version. |
| "This CDN is common, it'll be allowed" | Use only hosts the tool description lists right now. |
| "The screen is in review, the server would accept it" | The kit pushes designs to `draft` screens only. |
| "No candidate matches, I'll draw the bbox myself" | Leave it unanchored and tell the developer. |
| "Third refusal, one more small fix" | Two retries, then stop and show the reasons. |
| "The anchors are right, I'll call them confirmed" | Agent anchors are `suggested`; a person confirms them. |
