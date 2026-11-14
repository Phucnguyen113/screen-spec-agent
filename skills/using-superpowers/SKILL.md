---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. Brainstorming and systematic-debugging are Superpowers' most common process skills, but the rule holds for any of them.

- "Let's build X" → screen-spec-agent:brainstorming first, then implementation skills.
- "Fix this bug" → screen-spec-agent:systematic-debugging first, then domain skills.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Platform Adaptation

If your harness appears here, read its reference file for special instructions:

- Claude Code: `references/claude-code-tools.md`
- Codex: `references/codex-tools.md`
- Pi: `references/pi-tools.md`
- Antigravity: `references/antigravity-tools.md`
- Hermes Agent: `references/hermes-tools.md`
- Muse: `references/muse-tools.md`

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, etc, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.

<!-- screen-spec:begin -->
## Screen-spec

If the repository has no .screen-spec.json, ignore this block entirely and do not mention Screen-spec.

**Working context.** On the design path (the UI decision chose design), this team works the way product teams with a customer usually do: the spec and the design come first and the customer approves them; developers build to them and QA tests against them. The design is part of the contract. Something users will see (a field, column, section, state, dialog or label) is not done until the design shows it too, and UI that differs from the design comes back from QA as a bug. When the design does not show what you are asked to build, say so before coding that UI; even after "just implement it", ask one short question ("the design doesn't show X yet: draw it first, or code it now?") and do what they answer. This is about what users see only: backend logic, data, performance and refactors do not involve the design. A repository that chose code-first has no design contract; do not push designs there.

If it has one, specs live in Screen-spec:
- Before brainstorming or planning work on a screen → screen-spec-agent:spec-grounding.
- Writing the spec itself (overview, flows, screens, items, designs, AC), including "just propose an MVP" → screen-spec-agent:spec-authoring.
- Before changing how a screen behaves → screen-spec-agent:spec-drift-guard.
- New or changed screens with no design → ask the UI decision (brainstorming), then screen-spec-agent:spec-design before UI code.
- Before declaring work done → screen-spec-agent:spec-audit.
- Screen decisions go to Screen-spec, not to design docs.
<!-- screen-spec:end -->
