# PID Drafter — Product Requirements Document (v2)

**Status:** Draft for review (revised with industry-research pass)
**Author:** Hermes (for Reyhan Prajesa)
**Date:** 2026-09-08, revised 2026-09-12
**Supersedes:** v1 MVP at `~/projects/pid-drafter/` (to be archived, not iterated on)

---

## 0. Revision note (2026-09-12)

Added four new goals/functional requirements after a web-research pass
comparing how established P&ID products (Siemens COMOS, AVEVA Diagrams,
ESAIN ESAPRO P&ID, Hexagon Smart P&ID) differentiate themselves from
generic diagramming tools, cross-checked against user decisions:
auto-generated engineering lists (§4.6), spec-driven soft validation
(§4.1), instrument loop cross-referencing (§4.7), and multi-sheet
diagrams with functional off-page connectors (§4.8, un-deferred from
the original non-goals list). Real revision-tracking/diffing was
considered and explicitly rejected — manual rev-block entry remains
sufficient at this scale. See §2 for the updated goal list and §7,
item 4 for how each open question was resolved.

---

## 1. Problem & Purpose

Reyhan is a Process Engineer at Unilever Oleochemical Indonesia. He wants a
self-hosted P&ID (Piping and Instrumentation Diagram) drafting tool that is
credible enough to use for **real process documentation at work** — not a toy,
not a portfolio piece. It needs to look and behave enough like an actual
engineering tool that colleagues would take an exported diagram seriously.

**Primary user:** Reyhan, solo. He drafts; he shares finished exports
(PDF) with colleagues. No co-editing, no accounts, no multi-user concerns.

**v1 retro — why we're starting over:**
v1 grew reactively (add symbols → add DEXPI export → add more symbols →
patch DEXPI export) with no upfront spec. Result: 15 loosely-motivated
symbols, edge-case-driven feature creep, and a DEXPI export nobody asked
to prioritize. This PRD exists so v2 is built to actual requirements,
not to whatever seemed interesting mid-session.

---

## 2. Goals (priority order)

1. **Real-world validity** — the #1 priority. Diagrams should be
   *structurally correct*, not just visually plausible:
   - Every equipment/instrument tag must be unique (hard validation, not a
     dismissible warning)
   - Every pipe/signal line must have both ends actually connected to a
     valid port on a symbol (no dangling lines)
   - Symbol set and line conventions should visually match how Unilever's
     actual internal documentation looks (see v1's Unilever-style symbol
     work — dome-top columns, tube-bundle condensers, flag-shaped stream
     tags, orthogonal-only routing — that part was good, carry it forward)
   - **Spec-driven soft validation (NEW):** when a component's declared
     material/rating doesn't match the piping spec assigned to the line
     it's placed on, flag it as a soft warning in the validation panel —
     visible, not export-blocking. This mirrors how real "intelligent
     P&ID" tools (industry research, see below) catch spec mismatches
     while drafting rather than after.
2. **PDF export that's actually presentable** — colleagues expect PDF,
   not a raw SVG. This is core scope, not a stretch goal.
3. **Auto-generated engineering lists (NEW, promoted from industry
   research)** — line list, valve list, instrument index, equipment
   list, derived directly from the diagram's actual data (not manually
   maintained), exportable (CSV/Excel at minimum). This is the single
   most universal feature separating a real P&ID tool from a generic
   diagramming tool with process symbols — confirmed by comparing how
   every established P&ID product (COMOS, AVEVA, ESAPRO, Hexagon
   Smart P&ID) markets itself, and it's the most direct payoff of
   having a validity engine at all: once tags/lines are structurally
   correct, generating a list from them is nearly free.
4. **Instrument loop cross-referencing (NEW)** — selecting/hovering an
   instrument tag (e.g. TT-101) highlights other instruments in the
   same control loop elsewhere on the diagram (TIC-101, TV-101, etc.),
   inferred from shared loop number, not a separate manually-maintained
   mapping.
5. **Multi-sheet diagrams with functional off-page connectors (NEW,
   un-deferred)** — previously a non-goal; reconsidered given off-page
   connectors are meaningless without a real target sheet to reference.
   A diagram can span multiple sheets/pages; an off-page/tie-in
   connector references a specific sheet + tag, and following it
   (click-through or at minimum a resolved label showing where it goes)
   works, not just a generic flag placeholder.
6. **Self-hosted permanently on apollopi**, reachable over Tailscale,
   same operational pattern as the DWSIM MCP service (systemd, no
   external dependency).
7. **Extensible architecture** — adding a new symbol type later should
   be a small, contained change (new file/entry), not a scavenger hunt
   across the codebase.
8. **DEXPI (Proteus XML) export** — kept, but explicitly **low-priority /
   stretch goal**. Only build this after 1–7 are solid. Do not let it
   drive architecture decisions.

**Explicitly decided NOT to build (keeps scope from creeping into
enterprise-PLM territory):**
- Real revision-tracking/diffing between named revisions with
  auto-generated revision clouds — a manually-typed rev letter +
  description in the title block (already in §6) is sufficient; this
  is standard real drafting practice at small/solo scale and matches
  how Reyhan actually works, not a gap.

## 3. Non-Goals (explicit, to prevent v1's scope drift)

- No multi-user / real-time collaboration
- No accounts, auth, or cloud sync
- No mobile/touch support (desktop browser only)
- No full ISA-5.1 or DEXPI standard compliance — "close enough to be
  credible," not certified
- No AutoCAD/DWG export
- No undo/redo (nice-to-have, explicitly deferred past v2.0)
- No 3D / isometric anything
- No automated revision-diffing/revision-cloud generation — manual rev
  block entry is sufficient (see Goal 1 sidebar above)

---

## 4. Functional Requirements

### 4.1 Validity engine (NEW — did not exist meaningfully in v1)
- **Tag uniqueness is a hard constraint.** Duplicate tags block export
  (not just a dismissible warning banner like v1). User must resolve
  before PDF/any export succeeds.
- **Connection validity.** A pipe/signal line is only valid if both ends
  are attached to a defined connection port on a symbol. Free-floating
  line ends are flagged and block export.
- **Symbols must expose defined ports**, not just generic "attach
  anywhere on the shape" behavior. Each symbol type declares its valid
  connection points (e.g. a vessel has top/bottom/side nozzle points, not
  an arbitrary click-anywhere edge). This is a real architectural change
  from v1 (which used react-flow's generic 4-direction handles for every
  symbol regardless of real equipment geometry).
- Validation panel/sidebar shows all current errors (duplicate tags,
  unconnected lines) live, not just on-demand.
- **Spec-driven soft validation (NEW).** A line carries an assigned
  piping spec (material of construction + pressure class — see the line
  data sheet fields already shipped: `MATERIAL_OF_CONSTRUCTION_OPTIONS`).
  When a component placed on that line has an incompatible declared
  material/rating, surface it as a **soft warning** in the validation
  panel (visible, listed, non-blocking) — distinct from the hard
  tag-uniqueness/dangling-line errors, which still block export.
  Real "intelligent P&ID" tools catch this class of error at
  draft-time rather than after — worth doing here even at solo/single-
  user scale, since it's cheap once the validity engine and line data
  sheet already exist.

### 4.2 Symbol library (extensible core set)
- Carry forward the Unilever-style visual language validated in v1:
  process column/stripper, tall/short tube-bundle condensers, steam
  ejector, scale tank, stream flag in/out, transfer pump, plus the
  original ISA-ish basics (vessels, centrifugal pump, control/gate
  valve, instrument bubble, heat exchanger).
- **New: instrument bubble split convention (real ISA-5.1 accuracy).**
  Circle bubble split by a horizontal line — top half = function
  letters (e.g. FT, LIC, TE), bottom half = loop number. Two bubble
  variants: **circle** (field-mounted device) vs **square** (DCS/logic/
  shared-display function) — these are visually and semantically
  distinct symbol types, not a single generic bubble.
- **New: add Agitator as a core symbol** (explicitly requested — vessel-
  mounted mixer, typically a motor block + shaft + blade glyph inside
  or atop a vessel).
- **Symbol palette panel: right-hand side of the canvas**, not left
  (matches Reyhan's mental model / how he expects to scan for
  components). **Categorized, not a flat list** — group by type:
  Vessels, Pumps, Valves, Instruments, Agitators, Heat Exchangers,
  Piping Accessories, Off-page Connectors, etc. Collapsible category
  sections so the palette doesn't become an undifferentiated wall of
  15+ items like v1.
- **Architecture requirement:** each symbol is a self-contained module
  (geometry + connection ports + category + DEXPI class mapping if
  applicable) in its own file under a `symbols/` directory, registered
  via a single index/registry file that also declares which category
  each symbol belongs to (drives the palette grouping in 4.2 above).
  Adding a symbol = add one file + one registry line. No touching
  unrelated files to add a symbol (this was fine in v1 already via the
  `EquipmentKind` union + symbols dict — keep that pattern, formalize
  it as a documented convention).

### 4.3 Drafting canvas
- Drag-drop from palette (right-hand, categorized — see 4.2), connect
  via defined ports only (see 4.1), orthogonal (right-angle) routing
  by default, snap-to-grid.
- **Seamless pipe connectors (core novelty, explicitly requested).**
  When a pipe connects to a symbol's port, the connection must look
  physically continuous — no visible gap, no awkward line-into-shape
  overlap, no floating junction dot unless that's a deliberate tee/
  branch symbol. The connector should visually read as "this pipe
  enters/exits this equipment" the way a real drafted P&ID does, not
  as "a generic diagram-tool arrow pointing at a box." This likely
  means: ports have a defined direction/normal (not just a point), and
  the pipe's terminal segment snaps to align with that normal before
  touching the symbol boundary (no connecting at an angle that doesn't
  match how pipe would physically run out of that nozzle).
- **Configurable line/tag numbering (explicitly requested).** A
  settings panel where Reyhan can define/adjust the numbering scheme
  for line numbers and tags — e.g. prefix conventions, auto-increment
  behavior, numbering start value — rather than every tag/line number
  being purely free-text with no system behind it. Exact scheme is
  configurable, not hardcoded to one house style.
- Editable tags, line numbers, and piping specs (material, piping
  class, nominal diameter, design pressure, fluid code) — this existed
  in v1, keep it, but only meaningful once wired to the validity engine
  and PDF export.

### 4.3.1 Product identity — this is a P&ID tool, not a diagramming tool
Explicitly stated per Reyhan's direction: this app must feel and behave
like a dedicated P&ID generator, not a general-purpose flowchart/block-
diagram tool that happens to have process symbols bolted on. Concretely:
- No generic "shape" abstraction exposed to the user — everything in
  the palette is a real, named piece of process equipment/instrumentation,
  categorized as such (see 4.2), never presented as an interchangeable
  "box" or "arrow" the way flowchart tools do.
- Connections are "pipes"/"signal lines" with real piping semantics
  (line numbers, specs, seamless port connections — see above), not
  generic "edges" or "connectors" in the UI language, tooltips, or
  exported artifacts.
- This constrains scope creep: no swimlanes, no generic flowchart
  shape libraries, no BPMN/UML-adjacent features ever get added,
  regardless of how easy react-flow makes them to bolt on.

### 4.4 Export
- **Paper template (explicitly requested, core to PDF export).**
  Reyhan wants a real drawing-sheet template — border, title block,
  revision block — set up once, so finishing a diagram means it's
  already "framed" for print, not something assembled ad hoc at export
  time. Concretely: a fixed page template (e.g. A3 landscape engineering
  drawing border with title block cells: drawing title, drawing number,
  date, drawn-by, revision, scale) that the canvas content is composed
  into at export/print time. The canvas is the drafting area; the
  template is the fixed frame around it — Reyhan draws the process,
  the sheet furniture is already there.
- **PDF export (core, must-have):** renders the diagram into the paper
  template described above — real vector output, not a screenshot.
  This is what makes an export look like an actual issued drawing
  instead of an app screenshot with a logo slapped on.
- **JSON save/load (core, carry forward from v1):** full diagram
  serialization for continuing work later.
- **SVG export (keep, cheap to retain):** already works, low cost to
  carry forward as a secondary export option.
- **DEXPI/Proteus XML export (stretch, low priority):** v1's clean-room
  implementation (nozzle-level connectivity, real RDL URI mapping,
  line-spec attributes) was reasonably solid — if/when this gets
  revisited, port that logic rather than re-deriving from scratch, but
  do not schedule it before 4.1–4.4 (PDF) are done and solid.

### 4.5 Hosting
- Self-hosted on apollopi (Raspberry Pi), same pattern as v1: build →
  static file server → systemd unit → reachable over Tailscale only
  (not public internet).
- Repo stays clean/scalable: standard Vite+React+TS project layout,
  no stray reference/debug artifacts committed (v1's gitignored DEXPI
  reference file convention was correct, keep that discipline).

### 4.6 Auto-generated engineering lists (NEW)
- Derived views over the diagram's existing structured data — **not**
  a separate hand-maintained dataset. If a list and the diagram ever
  disagree, the diagram is the source of truth and the list is stale/
  needs regenerating, never the other way around.
- **Line list:** one row per pipe/signal line — line number, size,
  service, spec/MoC, jacketed flag, source tag, destination tag.
- **Valve list:** one row per valve instance — tag, type (gate/ball/
  check/control/relief/solenoid), line it's on, size.
- **Instrument index:** one row per instrument — tag, loop number,
  function (from the tag prefix, e.g. TT/LIC/PSV), service description.
- **Equipment list:** one row per non-instrument, non-valve node —
  tag, type, service/description, key data-sheet fields (design P/T,
  material, etc.).
- Each list is a real UI view (e.g. a modal/tab, not just an export
  format) so Reyhan can sanity-check it before exporting, plus a CSV
  export button per list.
- Regenerates live as the diagram changes — no manual "refresh" step
  that can go stale.

### 4.7 Instrument loop cross-referencing (NEW)
- Instruments sharing the same loop number (parsed from the tag, e.g.
  "101" in "TT-101"/"TIC-101"/"TV-101") are considered one loop.
- Selecting or hovering an instrument highlights every other instrument
  in the same loop, wherever it is on the current sheet (and, once
  multi-sheet exists per 4.8, across sheets too).
- This is inferred automatically from tag/loop-number parsing — no
  separate manually-maintained loop-membership list to keep in sync.

### 4.8 Multi-sheet diagrams (NEW — un-deferred from v2's original scope)
- A project can contain multiple sheets/pages, each using the same
  paper template (4.4) with its own sheet number in the title block
  (e.g. "SH. 2/3").
- **Off-page/tie-in connectors reference a real target**: a specific
  sheet + tag (not a generic unresolved flag glyph). At minimum, the
  connector's label resolves and displays where it goes (e.g. "TO
  SHEET 2, LINE 1½"-LPS2-126.02"); ideally, clicking it navigates to
  that sheet/location.
- Tag uniqueness (4.1) is enforced **project-wide across all sheets**,
  not just per-sheet — this is what makes cross-sheet references
  actually trustworthy rather than a labeling convention with no
  teeth.
- Sheet management (add/rename/reorder/delete sheets) lives in a
  simple sheet-tabs UI, similar in spirit to spreadsheet tabs.

---

## 5. Technical Approach

- **Stack:** Vite + React + TypeScript (proven in v1, no reason to
  change). React Flow remains the canvas engine, but symbol/port
  architecture needs rework (see 4.1/4.2) — this is the main structural
  change from v1, not a technology change.
- **New `symbols/` module convention:**
  ```
  src/symbols/
    vessel-vertical.ts       <- geometry, ports, category, DEXPI mapping (optional)
    pump-centrifugal.ts
    ...
    index.ts                 <- registry, single source of truth, drives
                                 palette categorization (Vessels, Pumps,
                                 Valves, Instruments, Agitators, etc.)
  ```
  Each symbol module exports: SVG geometry, list of named connection
  ports **with direction/normal** (not just a point — needed for
  seamless connector alignment per 4.3), category, default size, and
  (optionally) a DEXPI ComponentClass/URI mapping consumed only by the
  stretch-goal export.
- **Palette UI:** right-hand panel, categorized/collapsible sections,
  driven directly from each symbol module's declared category — no
  separate manually-maintained category list to keep in sync.
- **Seamless connector rendering:** pipe terminal segments must snap to
  the port's declared normal direction before touching the symbol
  boundary; no default "closest point on shape" free-form line-to-box
  connection behavior.
- **Numbering settings:** a small config module (prefix, auto-increment,
  start value per tag/line-number category) that the tag/line-number
  editing UI reads from, rather than every field being pure free text.
- **Validity engine** lives as a separate pure-function module
  (`src/validation/`), decoupled from the canvas UI, so it's testable
  independently and doesn't entangle with react-flow internals.
- **Paper template + PDF export:** a fixed drawing-sheet template
  (border + title block layout) that the canvas content is composed
  into at render time — likely via SVG composition (canvas content SVG
  placed inside a template SVG frame) then converted to vector PDF
  (e.g. `jspdf` + `svg2pdf.js`, or an equivalent proven approach).
  Needs genuinely clean vector output, not a screenshot-quality raster
  dump.

---

## 6. Reference Template — Real Unilever Drawing (Ground Truth)

Reyhan supplied a real, issued Uniqema/Unilever P&ID drawing
(`X-21039-121-01`, Continuous Saponification Plant, Rev. 3) as the
authoritative template reference. This replaces the earlier open
question about title-block format — **match this, not a generic
default.**

**Sheet layout (landscape, rotated title block convention):**
- Outer thin border + inner heavy double-line drawing frame, ~15-20mm
  margin
- Title block bottom-left corner, rotated 90° (read by rotating sheet —
  a European/Italian drafting convention). Fields: company logo +
  name, project title (bilingual EN/FR in the reference — Reyhan's
  version can drop the French), process/unit designation, Job number,
  Item number, Scale, Contr./Draw initials, date rows, revision number,
  drawing number (large/prominent), sheet designation (SH. 1/1)
- Revision block directly above title block: Rev. | Description
  columns, rows tied to date/initials in title block
- Legend box (upper-left of drawing area, not in title block):
  manual valve symbol, inside/outside battery limit line conventions,
  customer-supply notes
- Confidentiality/ownership notice as a small separate box

**Symbol conventions confirmed from the real drawing (adopt these
exactly, supersedes earlier assumptions where they differ):**
- **Vessel:** horizontal cylinder = long rectangle with semicircular
  end caps, heaviest line weight on the whole drawing (~2-3x normal
  process line weight) — vessel boundary should visually dominate
- **Instrument bubbles:** perfect circles, thin uniform line weight,
  2-letter stacked tag inside (e.g. TT, LT, PI, LSH), loop number
  below/beside the circle (not inside it) in small text, no box
- **Signal-type tags (AI/AO/DI/DO etc.):** small square/rectangle boxes
  — visually and semantically distinct from round instrument bubbles
  (square = signal/system reference, circle = field instrument — this
  confirms and refines the circle-vs-square distinction already in
  section 4.2)
- **Valves:** bowtie (two triangles point-to-point), hollow/unfilled;
  control valves add an actuator stem + square/circle actuator symbol
  connected via dashed signal line up to the controlling instrument
  bubble; check valves get an internal solid arrow; PSVs use a bent/
  elbow bowtie feeding a vertical vent line
- **Line weight hierarchy (adopt as a real spec, not guesswork):**
  1. Heaviest — vessel outlines, main process pipe run
  2. Medium — branch/secondary process piping
  3. Thin — instrument leader/capillary lines
  4. Thin dashed — pneumatic/electric signal lines
  5. Thin dash-dot or fine dashed — battery-limit/scope boundary lines
- **Line number format:** `{size}"-{service-code}-{line-number}-{spec}-
  {insulation-suffix}`, e.g. `1½"-LPS2-126.01A-300-HC` — this is a real,
  usable numbering scheme to seed the configurable numbering feature
  (4.3) with a sensible default pattern rather than inventing one

This drawing should be kept as a permanent reference asset for the
rebuild (gitignored, not redistributed, same handling as the DEXPI
sample file in v1) — treat it as the primary visual/structural source
of truth over any generic P&ID software reference material.

## 7. Open Questions / Decisions Needed Before Build

1. Exact symbol port geometry per type — reasonable defaults can be
   assumed and iterated, doesn't need to block starting the build.
2. ~~Title block content/format~~ — **Resolved**, see Section 6 above.
3. No hard deadline given — build proceeds at normal pace, no crunch.
4. ~~Auto-generated lists / spec validation / loop cross-reference /
   multi-sheet — worth building?~~ — **Resolved** (2026-09-12, industry
   research + user confirmation): yes to all four except revision
   tracking, which stays out of scope. See Goals (§2) and §4.6–4.8.

---

## 8. Out of Scope for v2.0 (explicitly deferred, may revisit later)

- Undo/redo
- DEXPI export (until 4.1–4.8 solid)
- Real ISA-5.1/DEXPI standard certification-level compliance
- Any collaboration/multi-user feature
- Automated revision-diffing / auto revision-cloud generation (manual
  rev block entry is sufficient — see §2 and §3)

