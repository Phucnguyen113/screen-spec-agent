# HTML Design Rules

What `create_design_from_html` accepts and how it turns the HTML into designs and anchor candidates. Source: `docs/superpowers/specs/2026-11-13-html-design-import-design.md` §1 (input format) and §3 (render and extraction). Every number below was checked against the server code, cited next to it.

The CDN allowlist is **not** in this file on purpose: it is server configuration. Read it from the tool description at runtime (the sentence "External resources ... only over https from: ...").

## The file

- One complete HTML document, UTF-8, starting with `<!DOCTYPE html>`.
- At most **5MB** (`HTML_MAX_BYTES`, `apps/web/src/lib/design-ingest/html/limits.ts`). Big inline `data:` images are the usual cause of going over.
- Static only: no fetch/XHR/WebSocket, no iframe, no form `action`, no eval or other script APIs. Inline scripts that only shape the page are fine. Never call history.pushState or change location.hash: any navigation aborts the render. (Tool description, `apps/web/src/lib/mcp/design-tools.ts`.)
- External scripts, styles, fonts and images only over https from the allowlisted hosts. Inline `data:` images are fine.
- At most 20,000 elements and nesting depth 256 (`HTML_MAX_ELEMENTS`, `HTML_MAX_DEPTH`, `limits.ts`). A screen design never gets near this; if it does, split it.

## Attributes

| Attribute | On | Meaning |
|---|---|---|
| `data-design="Label"` | A top-level block | That element is one design. Label is trimmed; empty → "Design n". Labels at most 200 characters (`HTML_LABEL_MAX`, `limits.ts`). Duplicate labels are allowed but warned about; avoid them. |
| `data-width="390"` | A `data-design` element | That design's viewport width in CSS px, overriding the call's `width`. |
| `data-spec-name="Name"` | Any element | The candidate's name (`figmaName`). Use the spec item's name exactly. |
| `data-spec-type="Button"` | Any element | The candidate's type. Must be one of the item types below; any other value is ignored with a warning. |
| `data-spec-ignore` | Any element | Leaves the element and all its children out of the candidates. Use on decoration. |

- At most **20** `data-design` sections per file (`HTML_MAX_SECTIONS`, `limits.ts`).
- A `data-design` inside another `data-design` is an error; the whole file is refused.
- No `data-design` at all → the whole `<body>` is one design labelled with `<title>` (or "HTML design").

### Item types

From `ITEM_TYPES` in `packages/shared/specbundle.schema.ts`:

`Icon`, `Text`, `Dropdown`, `Textbox`, `Button`, `Checkbox`, `Radio`, `Link`, `Image`, `Tab`, `Tag`, `Datepicker`, `Switch`, `Other`

## Width and height

- Width: whole CSS px from **320** to **2560**, default **1440** (`HTML_WIDTH_MIN`, `HTML_WIDTH_MAX`, `HTML_WIDTH_DEFAULT`, `limits.ts`). 390 is the usual phone width.
- Each section at most **8,000** CSS px tall (`HTML_MAX_SECTION_CSS_HEIGHT`, `limits.ts`). Taller, or zero size, fails the whole render; split a long page into several sections.
- Rendered at device scale 2 (`HTML_DEVICE_SCALE`).

## How candidates are extracted (per section)

- Taken: `button`, `[role=button]` → Button; `a[href]` → Link; `input` by type (checkbox → Checkbox, radio → Radio, date/datetime-local → Datepicker, others → Textbox); `textarea` → Textbox; `select` → Dropdown; `img` → Image; `svg` → Icon; `[role=tab]` → Tab; `[role=switch]` → Switch; any element with its own non-empty text → Text. `data-spec-type` overrides the type.
- Dropped: hidden (`display:none`, `visibility:hidden`, `opacity:0`, zero size), outside the section's box, or inside `data-spec-ignore`.
- `figmaName` = `data-spec-name`, else `aria-label`, else the text (cut to 200 characters), else the tag name. Keep `data-spec-name` values at most 200 characters.
- `figmaNodeId` = `html:` + the DOM index path from the section, e.g. `html:0.3.1`. Unique only within one upload; a new upload gives new ids.
- `bbox` is in fractions of the section's box, the unit `anchor_spec_item` takes.
- At most **500** candidates per design (`HTML_MAX_CANDIDATES`, `packages/shared/html-extract.ts`); past that the first 500 in reading order are kept, with a warning. `list_design_candidates` returns 200 by default, so pass `limit: 500`.

## Results and errors

- All or nothing: a refused file creates nothing. The refusal lists each problem, with its line where known.
- Success returns the new designs (`id`, `label`, `width`, `height`, `candidateCount`) and `warnings`.
- Refused on an approved screen; needs the editor role; renders are rate limited.
- If the call fails in transport, the designs may already exist: re-read the screen before retrying.
