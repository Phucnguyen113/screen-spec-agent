---
name: spec-grounding
description: Use when brainstorming or planning work that touches one or more screens in a repository with a .screen-spec.json file
---

# Spec Grounding

## Overview

Before brainstorming or planning for a screen, read what the screen spec already decides, ask only about what it leaves open, and record new answers back into Screen-spec. Operation names and write rules come from **screen-spec-agent:spec-driver**; this skill decides *when* to use them and does not repeat the rules.

## 1. Opt-in and connection check

Run spec-driver's connection check first. No `.screen-spec.json` → do nothing; return to the calling skill as plain superpowers. Not connected → spec-driver's one warning, then continue without spec (the plan says "not checked against spec").

## 2. Resolve the screens

- Screen named → find it with `listScreens`.
- Not named → infer it from the code being changed, the route, the component, or UI text, and match against `listScreens`. Ask the developer only if inference fails.
- Search every project listed in `.screen-spec.json`, not just the first.
- No match by code → also search by text with `listScreens` (its text search) before concluding anything. Still nothing → ask the developer whether this is a new screen or one you missed. Treat it as absent (step 4) only after they confirm it is new.

## 3. Screen has a spec

`readScreenSpec` (items and design image) and `screenState`. Summarize the decided points to the developer, and do not ask again about anything the spec already decides. Interview only the gaps the task needs: errors, permissions, edge cases, empty and loading states, and similar. Record the answers as in step 4 (`draft`) or step 5 (`review`/`approved`).

## 4. Screen missing or spec thin

Thin = the spec says nothing about the behavior this task touches. Interview the developer, read your summary of their answers back, and record them only after they confirm. Afterwards, tell them what was written and where.

- Screen in `draft` → `writeSpecItem`: new items unanchored, in a fitting section; a rule with no place on the design gets `specScope: "screen"`.
- Screen absent → `writeSpecItem` (`create_screen`), then write the items. Create it in the project the task belongs to; if more than one listed project fits, ask which.
- Write in the project's source language; never translate existing text. Other languages the project requires: follow spec-driver.

## 5. Locked screens and shared specs

- Screen in `review` or `approved` → do not write. A gap or conflict becomes a `noteDrift` comment on the related item, and a **risk assumption** in the design doc and plan.
- Item linked to a shared spec → never edit it, on any screen; comment with `noteDrift`.

## 6. What goes in the design doc

- Per screen: its code and project, its state, and a pointer to it. Do not copy spec content into the design doc; the spec stays the source.
- A list of what was written to Screen-spec (screen and item, with a pointer to each), never the written content itself; plus the risk assumptions from step 5.
- Parts that belong to no screen (cross-screen logic, APIs, batch jobs, technical decisions) stay in the design doc, linking to the screens they affect.

## 7. Screen has no design

A design can come from `figma`, `html` or `image`; any of them counts. Check this for every screen in scope, including screens you create with `create_screen` during the session, not only the ones that existed when you grounded.

A screen with none (and spec-driver's feature detection found `createDesign`):
- The UI decision (brainstorming) is already made → follow it: design path → **screen-spec-agent:spec-design** before its UI is coded; code-first → nothing to do.
- Not made yet → ask it now, as brainstorming words it, before any UI code for that screen. The developer decides; record the answer in the design doc (or the plan, outside brainstorming).

## Red flags

| Thought | Reality |
|---|---|
| "I'll confirm the spec's rules with them to be safe" | It is decided. Summarize it; do not ask again. |
| "This approved screen is missing a rule, I'll add it" | Comment and record a risk assumption. Locked screens are comment-only. |
| "I'll paste the spec into the design doc for context" | Point to the screen. Copies go stale. |
| "I'll tidy the wording of this existing item while I'm here" | Never rewrite or translate existing text. Add only what is missing. |
