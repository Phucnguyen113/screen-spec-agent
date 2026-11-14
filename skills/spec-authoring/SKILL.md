---
name: spec-authoring
description: Use when building or extending the spec itself in a repository with a .screen-spec.json file (a product or feature's overview, actors, flows, screen list, screen items, designs or acceptance criteria), including when the developer says "just propose it yourself" or "do an MVP"
---

# Spec Authoring

## Overview

The process for writing the spec, the way brainstorming is the process for building code. Whoever writes it (PM, BrSE, or a developer doing it themselves) goes through the same steps, in order, one at a time. Operation names and write rules come from **screen-spec-agent:spec-driver**; screen resolution from **screen-spec-agent:spec-grounding** step 2; designs from **screen-spec-agent:spec-design**. This skill does not repeat them.

Use it when:
- a product or feature has little or no spec yet and the work starts by writing it;
- the developer asks to write or finish the spec of screens, flows or acceptance criteria;
- brainstorming hands off here because the work is mainly writing the spec.

Changing code for a screen that already has a spec is not this skill: that is brainstorming, spec-grounding and spec-drift-guard.

**"Just propose it yourself" hands you the content, not the process.** Make the calls for them, then still go through the steps below; each read-back is where they correct your calls.

## The steps

### 1. Read what exists

`listProjects`, `readOverview`, `listScreens` and `readFlows` for every project in `.screen-spec.json`. Never rebuild what exists; extend it. A project with nothing in it → step 2.

### 2. Scope, as one read-back

Propose (or play back what they said): what the product is for, the actors, what is out of scope, the flows, and the screen list (code and name per screen). Mark what you decided yourself, with a short reason. One message, then wait. Write nothing to Screen-spec before their yes.

A yes with changes ("ok, but add X") is not yet a yes to write. Work the change into the scope and read back what changed: screens, flows or actors added or removed, and anything you had to decide to make the change. Write after their yes to that. Only a pure wording change or rename is applied without another read-back.

### 3. Write the skeleton

After the yes: `writeOverview` (overview, actors), the screens (`writeSpecItem` → `create_screen`, after `listScreens` to avoid duplicates), and `writeFlow` (flows and their steps). Report what was written in a few lines, with a pointer to each.

### 4. UI decision, right after the screen list is written

Ask it now, alone in its own message, in brainstorming's words: should the UI follow a design on Screen-spec (each screen drawn as HTML with spec-design and approved before UI code), or go code-first with no design? Recommend the design path and say why. Never put it into a list of next steps as one option among others: it is a decision about every later step.

Record the answer in the design doc (`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`; create it if there is none). The design doc holds what belongs to no screen: the UI decision, the visual system, cross-screen rules, technical choices. Writing it is part of this process: write it and say where; do not ask for permission to write it.

Skip the question only when every screen already has a design, or spec-driver found no `createDesign` (say so instead).

### 5. Each screen, in flow order

Recommend the order (usually the order the flows run) and go one screen at a time unless the developer asks for a batch.

1. **Items.** Draft the sections, items and business rules (`specScope: "screen"` for rules with no place on the design), with the states, messages and limits. Read them back in one message: what they told you, and what you decided (each with its reason). Write with `writeSpecItem` only after their yes. A batch of screens gets one read-back per screen, still before any write.
2. **Design** (design path): spec-design for this screen. The first screen settles the visual system, which goes into the design doc once approved.
3. **Acceptance criteria.** `writeAC` for the screen's business rules: the main path, the edges and the failures. They land as suggested; a person confirms them.
4. **Check.** `readScreenSpec` once, then report in a few lines: items, designs, AC, anything left open. Recommend the next screen.

### 6. Hand over to building

All screens in scope done, or the developer says it is enough → recommend the next phase: screen-spec-agent:writing-plans for the code, from the design doc and the screens. Never submit a screen or flow for review; that is a person's call.

## How every step ends

End with **one** recommended next step and the reason for it. Alternatives get one line at most ("or, if you prefer, X"). Never a numbered menu of next steps: a menu turns a decided order into a free choice, and steps get skipped.

## Red flags

| Thought | Reality |
|---|---|
| "They said propose it yourself, so I'll write the whole spec now" | You make the calls; they still see each read-back before anything is written. |
| "I'll list design as option 2 of the next steps" | The UI decision is its own question, asked right after the screen list. |
| "Three good next steps, I'll let them pick" | Recommend one, with the reason. |
| "The design doc is in their repo, I should ask first" | Writing it is part of the process. Write it and say where. |
| "This screen is simple, I'll skip its AC" | Every business rule gets acceptance criteria. |
| "The spec is done, I'll submit it for review" | Submitting is a person's call. |
