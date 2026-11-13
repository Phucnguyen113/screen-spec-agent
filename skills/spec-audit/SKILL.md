---
name: spec-audit
description: Use when finishing work, verifying it, or preparing a review on a branch in a repository with a .screen-spec.json file, to check that the screens the branch touched still match their spec
---

# Spec Audit

## Overview

Compare the code of every screen the branch touched with that screen's spec, and report where they differ. The audit is advisory: it never blocks verification, review, merge or anything else. Each finding goes back to the developer through **screen-spec-agent:spec-drift-guard**'s three options; the audit itself never decides who is right and never writes on its own.

Operation names and write rules come from **screen-spec-agent:spec-driver**. Screen resolution comes from **screen-spec-agent:spec-grounding** step 2. The options and the `[spec-drift]` comment format come from spec-drift-guard. This skill does not repeat them.

## When to use

- Before declaring work done (verification-before-completion), before requesting code review, and when finishing a development branch.
- When the developer asks for an audit, for the branch or for named screens.

spec-drift-guard catches drift while the agent changes code. The audit catches what got past it: edits made by hand outside the agent, sessions where the spec server was not reachable, and older code.

## 1. Opt-in and connection check

Run spec-driver's connection check first. No `.screen-spec.json` → do nothing; the calling skill carries on as plain superpowers. Not connected → say "spec audit skipped: screen-spec not reachable; not checked against spec" and return. The audit never blocks.

Already audited this branch in this session (e.g. before code review) and nothing changed since, neither the code nor your human partner's decisions on its findings → do not run it again; reuse that result and its open findings.

## 2. Find the touched screens

1. Get the branch diff: committed changes since the merge base with the base branch (`git merge-base HEAD <base>`; base = the branch the work will merge into, usually the default branch) plus uncommitted changes. The developer named screens instead → use those and skip the diff.
2. Drop files that cannot change screen behavior: tests only, docs, build config, pure renames or refactors.
3. Map the rest to screens with spec-grounding step 2 (code, route, component, UI text; text search; every project in `.screen-spec.json`). Backend, API or validation changes count for every screen where their effect shows.
4. Before comparing anything, show the developer the list: each screen (code, name, project) with the files that map to it, and the files that matched no screen. They can correct the list. Files that match no screen and that the developer cannot place are reported as "not audited"; never invent a screen.

## 3. Compare code with spec, per screen

Follow the approach of the server's `audit_spec` prompt in its codebase mode, adapted:

- **Read-only.** No spec writes and no code edits during the comparison. Changes happen only in step 6, after the developer chooses.
- `readScreenSpec` live, and `screenState`. Compare against **all** of the screen's spec content, as spec-drift-guard step 3 says: every item and acceptance criterion, draft items, and items whose anchor is `suggested` or `stale`.
- `readFlows` for the flows the screen belongs to, so you judge the screen in its journey, not on its own.
- `readSharedSpec` for the shared specs its items link to. A shared rule implemented differently here than the spec says is a finding.
- Read the implementing files, not only the diff: the question is what the screen does now.
- Pair each spec item with the code that implements it and label the pairing `certain`, `probable` or `could not pair`. Never present a probable pairing as a fact.

Sort what you find:

- **Spec item not implemented** → finding.
- **Implemented differently** (required-ness, limits, wording, states, permissions, behavior) → finding. Say what differs.
- **Shared rule applied inconsistently** → finding.
- **Code does something the spec says nothing about** → not drift; list it as a spec gap. The developer may record it with spec-grounding.

## 4. Skip drift that was already accepted

`listDriftNotes` for each screen. A finding is already accepted when its item (or, for new behavior on a locked screen, the closest related item spec-drift-guard used) has an unresolved `[spec-drift]` comment whose second line (`Code now: …`) describes what the code does now. Leave it out of the findings and only count it ("2 accepted deviations awaiting review"); a reviewer resolves it, not the audit.

The comment says something different from what the code does now (the code changed again) → it does not cover the finding; report it.

## 5. Report

Per screen: its state, the findings (spec says / code does / files / pairing confidence), the spec gaps, and the count of accepted deviations skipped. Then the files not audited, and a confidence line: which pairings were probable and what could not be checked at all.

No findings → say so in one line and return to the calling skill.

## 6. Findings go through spec-drift-guard

Ask the developer whether to go through the findings now. Not now → list them as open in the handoff (plan, review request or branch summary) and return; nothing is blocked.

Now → take the findings one at a time, each through spec-drift-guard step 4, with `Request` = what the code currently does: (1) keeps the code and updates the spec, (2) changes the code to match the spec, (3) stops and asks BrSE/PM. Apply each choice as spec-drift-guard step 5 says, including its locked-screen, shared-spec and viewer-key rules. Wait for each answer; never pick an option for the developer.

If you cannot ask the developer (for example, you are a subagent), return the report and the unanswered drift blocks to whoever dispatched you.

## Red flags

| Thought | Reality |
|---|---|
| "The audit found drift, so the branch can't be finished" | The audit never blocks. Report it and let the developer decide. |
| "The code is clearly right, I'll update the spec to match" | That is option (1), and only the developer picks it. Show the block. |
| "I'll fix these small mismatches while auditing" | The comparison is read-only. Changes come after a choice, one finding at a time. |
| "This deviation shows up every time, I'll report it again" | An unresolved `[spec-drift]` comment that matches the current code means it was accepted. Skip it. |
| "Couldn't map this file to a screen, I'll guess" | List it as not audited. Never invent a screen. |
| "The diff looks fine, so the screen matches" | Compare what the screen does now with the whole spec, not the diff. |
