---
name: spec-drift-guard
description: Use when about to change the behavior of a screen in a repository with a .screen-spec.json file - a plan task, a bug fix, or a plain chat request - before editing code
---

# Spec Drift Guard

## Overview

Before code changes how a screen behaves, check the result against the screen's spec. If they disagree, stop and let the developer choose. The developer decides whether the change goes ahead, and BrSE/PM decide the spec through the review gate. The agent never decides that the spec is wrong.

Operation names and write rules come from **screen-spec-agent:spec-driver**. Screen resolution comes from **screen-spec-agent:spec-grounding**. This skill does not repeat them.

## When to use

Use it for every request that changes the behavior of a screen with a spec: plan tasks (executing-plans, subagent-driven-development), bug fixes (systematic-debugging), and plain chat requests ("make this button disabled"), including backend, API or validation changes whose effect shows on a screen. spec-audit also sends each finding here.

Skip it for changes that leave screen behavior the same, such as a refactor, renames, tests only, or build config.

## 1. Opt-in and connection check

Run spec-driver's connection check first. No `.screen-spec.json` → do nothing and work as plain superpowers. Not connected → no gate: make the change, and tell the developer it was not checked against the spec.

## 2. Resolve the screen

Follow spec-grounding step 2: use the name or code if given, otherwise infer from the code, route, component or UI text, then search by text, and ask the developer only if inference fails. Never invent a screen.

- Still unresolved and the developer does not know → go ahead without the gate, and say the change was not checked against the spec.
- Screen has no spec → nothing to drift from; go ahead.

## 3. Compare the expected result with the spec

`readScreenSpec` live and `screenState`. Work out the **expected result after the change**: what a user sees and what the screen does once the change is in. Compare that with the spec, not the code diff.

Compare against **all** of the screen's spec content: every item and acceptance criterion, on `draft` screens too, including items whose anchor is `suggested` or `stale`. A draft or unconfirmed item is still the spec.

- Matches the spec, or the spec says nothing about it → go ahead.
- Contradicts any item → drift. Go to step 4.

## 4. Drift: stop and ask

Stop **before editing code**. Do not make a partial change first. Show the developer this block, with one `Spec` line per item that drifts:

```
⚠ This request drifts from the spec of <SCREEN_CODE> (<screen name>):
  Spec [<item ref>]: <what the spec says>
  Request         : <what was asked>
→ (1) Do the request and update the spec
  (2) Follow the spec, drop the request
  (3) Stop and ask BrSE/PM first
```

For a spec-audit finding, `Request` is what the code currently does; (1) keeps the code and updates the spec, (2) changes the code to match the spec.

Then wait. Do not pick an option, assume a default, or carry on with other edits to the same behavior while waiting. If you cannot ask the developer (for example, you are a subagent), stop and hand the block, unanswered, to whoever dispatched you.

## 5. Apply the developer's choice

**(1) Do the request and update the spec**

Every `noteDrift` comment has two lines:

```
[spec-drift] Changed per dev request: <reason>. Needs review.
Spec: <what the spec says>. Code now: <new behavior>.
```

`<reason>` comes from what the developer said (ask in one line if they gave none). The marker `[spec-drift]` and the labels `Changed per dev request:`, `Needs review.`, `Spec:` and `Code now:` stay verbatim, in English, whatever the project language; only the content you fill in (`<reason>`, `<what the spec says>`, `<new behavior>`) follows spec-driver's language rule. On a locked screen the comment is the only record of the change, so the second line is never optional.

- Screen in `review` or `approved`, item linked to a shared spec, or key with only the `viewer` role → `noteDrift` only; do not edit the spec.
- Otherwise (screen in `draft`, item not shared, key can write) → `writeSpecItem` to change the item (or add one for new behavior) **and** `noteDrift` on that item. Both, every time: the comment is what puts the change in front of a reviewer.
- On a locked screen, new behavior may have no item to attach to → comment on the screen's closest related item, add to the second line that the new behavior has no item of its own, and tell the developer which item you used.

Then make the code change. Afterwards, tell the developer what you wrote to Screen-spec and where.

The change can make other parts of the screen's spec stale: acceptance criteria that test the old value or behavior, and designs that show it. Read them (`readScreenSpec` gives both) and, on a `draft` screen, update the criteria with `writeAC`; on a locked screen, or for a design, put them in the `noteDrift` comment. Then list them for the developer: which AC and designs were updated, and which still show the old behavior.

**(2) Follow the spec, drop the request**

Make the code match the spec and leave out the part that drifted. Write nothing to Screen-spec. Tell the developer what was left out.

**(3) Stop and ask BrSE/PM first**

Stop work on this change: no code edits, no spec writes. Tell the developer to ask the BrSE/PM who owns the screen's spec (its reviewer), and give them the drift block to ask with. Continue only once the developer comes back with an answer.

## Red flags

| Thought | Reality |
|---|---|
| "The spec is obviously wrong here, I'll just fix the code" | You never decide that the spec is wrong. Show the block and ask. |
| "It's a small fix, no need to check" | Any change in behavior gets the check, including one-line fixes and chat requests. |
| "I'll make the change and ask afterwards" | Ask before editing code. A change already made takes the choice away from the developer. |
| "The dev said 'just do it', so that's option (1)" | Only an answer to the block counts. Show it and wait. |
| "That item is only a draft / its anchor is stale, so it doesn't count" | Every item counts, including draft screens and `suggested`/`stale` anchors. |
| "Draft screen, I updated the item, the comment is redundant" | Option (1) on `draft` means `writeSpecItem` **and** `noteDrift`. |
