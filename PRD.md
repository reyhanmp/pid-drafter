# PID Drafter — Product Requirements Document (v2)

**Status:** Draft for review (revised with industry-research pass)
**Author:** Hermes (for Reyhan Prajesa)
**Date:** 2026-09-08, revised 2026-09-12, 2026-09-13, 2026-09-14 (four passes)
**Supersedes:** v1 MVP at `~/projects/pid-drafter/` (to be archived, not iterated on)

---

## 0. Revision note (2026-09-13, for public release)

**Client identifiers redacted.** This document and the source tree were
prepared for publication, and §6's reference drawing is a real issued client
document. Every identifier that could serve as a search key back to that
document has been replaced with a placeholder.

The drawing number, the client name, and the real area codes have been
replaced with placeholders. The specific originals are deliberately not
reproduced anywhere in this document — including here, in the note that
describes the redaction, since restating them would put back exactly the
searchable strings the redaction removes.

The *structure* is untouched, because the structure is what this tool
encodes: the dotted area form and the 4-digit undotted form are still both
present and still distinct, a neighbouring area still does NOT advance the
area under test, and every gate still asserts the same distinctions it did
before. The redaction is a
find-and-replace over test data, not a change in behaviour — which is
itself the point. The drawing's own conventions (line-number grammar, the
area.seq tag form, ISA-5.1 bubble layout, `ø1 1/2" ANSI 150#` nozzles)
are industry practice and remain fully documented; a placeholder for the
document that happened to be the reference costs the reader nothing.

**Scope of the redaction — the whole history.** Published history was
rewritten (`git filter-branch` over every commit, tree and message), then the
pre-rewrite objects were dropped and garbage-collected, and the result was
force-pushed. Public history was replaced rather than amended.

This means the identifiers are gone from **every commit**, not just the tip.
The one deliberate exception is the sentence in §1 stating the author's own
employment — that is a fact about the author, not a reference to a client
document, and blanking it would misstate his own CV.

**What this cost.** Force-pushing rewrites every commit hash, so any SHA in
an existing reference, fork, or clone is now invalid. Two things follow, and
both are worth knowing before contributing:

- **Pre-existing forks and clones still hold the old objects.** A force-push
  cannot reach into someone else's clone. There were no forks at the time of
  writing; if that changes, those copies are not covered by this.
- **GitHub may retain the old objects** for some time after a force-push,
  reachable by SHA, until its own garbage collection runs. This is not
  something the repository can control from the client side. If that
  exposure matters, the reliable remedy is to **delete and re-create the
  repository from the current tree**, which starts from clean history
  rather than asking the host to forget.

**Verification.** The published clone was fetched fresh and every commit
scanned, tree and message, for both the document identifier and the real area
codes: 0 hits. The tip tree is byte-identical to the pre-rewrite tip, so the
history rewrite changed no file content — only the identifier strings inside
it.

## 0a. Revision note (2026-09-13, three commits)

Landed after the first 2026-09-13 pass, in three commits:

- **`eda55e6` — §4.3 configurable numbering is BUILT.** The original explicit
  request, previously missing entirely. Both real tag forms are supported
  (`V-101` and the reference drawing's area form `P-710.01A`); the line
  sequence is per-AREA and shared across services, matching the real drawing.
- **`6834d7a` — five false claims corrected.** See §0b. The document asserted
  features were "already basically done" that did not exist in the code at all.
- **`cdccd2c` — §4.10 undo/redo built**, the §8 deferral re-taken, with a
  mutation-tested gate. See §4.10 and §8.

## 0b. Revision note (2026-09-13) — correcting false claims

Measuring the build against this document found five assertions that were
simply not true of the code, all corrected in place and struck through rather
than deleted so the error stays visible: **§4.4 SVG export** ("already works"
— no export code existed), **§4.9.3 nozzle size** (claimed to feed the §4.1
spec check and to appear in the equipment list — it does neither),
**§6 line-weight hierarchy** (declared "a real spec" while every pipe draws at
one weight), and **§4.5 hosting** (recorded as unbuilt; actually already
done). The pattern is worth naming: four of the five were "this already
works", which is exactly the assumption that lets an unbuilt requirement
keep slipping. A spec of record that misdescribes the build is worse than no
spec.

## 0c. Revision note (2026-09-13, first pass)

Records two changes made after the 2026-09-12 pass, both closing gaps
between the document and the built artifact rather than adding scope:

**1. The free-line carve-out is documented (§4.1).** The build shipped a
mode where a line released over empty canvas draws without requiring a
nozzle on either end. That contradicts §4.1's original absolute rule
("free-floating line ends are flagged and block export"), so the
document was silently wrong about its own product. The carve-out is now
written down with its tradeoff stated plainly, including that it
deliberately weakens the engine's "structurally correct, not just
visually plausible" promise. Recording a known hole is the point — a
reviewer who finds an undocumented carve-out reads it as an oversight,
which is a worse failure than the carve-out itself.

**2. §4.2 now reflects the real library size (67 symbols / 161 ports,
up from 30).** The 37-symbol expansion was locked earlier the same day
and is now committed. §4.2 also gains the port-conformance acceptance
gate (`scripts/verify-port-outline.cjs`, must print
`PORT_OUTLINE_PASS`), promoted from an ad-hoc probe to a repo-kept,
reproducible check that every new symbol is expected to satisfy before
commit. The gate measures distance to *drawn ink*, not to the bounding
box — a distinction that has already caught two real defects.

**3. A new §4.9 records the chemical-engineering depth pass.** Measured
against the real issued drawing in §6, three areas were thinner than the
tool's own product identity claim (§4.3.1) allows: data-sheet fields
covered only 6 of 11 categories, tags and line numbers were free text
with no ISA-5.1 / piping-class semantics, and nozzles carried no size or
rating. All three are now requirements with acceptance gates rather than
aspirations.

**4. §4.3 configurable numbering SHIPPED, and five claims in this
document measured against the source rather than assumed.** The numbering
settings panel was the one explicitly-requested item from the original
brief that had never been built; it is now built (`eda55e6`) for both tag
shapes and the drawing's own line format. The review that produced it
also found the document asserting five things that were not true of the
code — an export path that does not exist, a nozzle-spec link that is not
wired, an equipment-list surface that does not carry nozzle size, a line
weight hierarchy declared as a spec while every pipe is drawn at one
weight, and hosting listed as outstanding when the service is live. Each
is corrected in place and kept visible rather than quietly deleted,
because a requirements document that overstates the build is worse than
one that admits a gap: it hides work. §4.9.3 and §4.5 in particular now
record *measured* status, and the two remaining unbuilt areas — the paper
template/PDF export (§4.4) and the live nozzle-vs-line reconciliation —
are stated as unbuilt rather than implied done.

---

## 0d. Revision note (2026-09-12)

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

## 0e. Revision note (2026-09-14) — connectivity soundness

Closes §7a items **1 and 2**, the two it ranked cheapest and most
fundamental, in one decision recorded as §4.12. One commit.

**1. The engine asserted a property it did not hold.** §4.1 claims the
validity check enforces "structurally correct, not just visually
plausible". Nothing limited how many pipes could attach to one nozzle —
three runs could converge on one flange and the engine reported nothing.
A nozzle is a hole in a vessel wall with a flange on it; that drawing is
not of anything buildable. Graph validity without this rule is not
structural correctness, so the document was describing a stronger tool
than the one that existed — the same class of error as §0b, found by
taking §7a's own list seriously rather than by a user complaint.

Refused in two places on purpose: **during the drag** (`isValidConnection`,
so the edge is never created — create-then-delete is indistinguishable
from a broken drag) and **in the validator** (`port-overloaded`, so data
that never went through a drag is still condemned). If the canvas refused
a connection that the panel then blessed, one of the two would be lying
and the user could not tell which.

**2. Branching is a fitting, and the fitting is drawn.** §7a item 2
noted the library had no junction symbol, so the most ordinary
arrangement in process piping — a header with branches — could not be
drawn the normal way. The rule above would have made that permanent
rather than merely awkward, which is why the two items are one decision.
`tee-branch` (68th symbol, Piping Accessories) declares its run ports as
`multiBranchPorts` — the **only** place in the library where a port
carries more than one pipe. Its branch port takes one pipe like every
other nozzle, so the exception is per-port rather than per-symbol; an
unrecognised symbol gets the strict rule, so a symbol that fails to load
cannot become a place pipes pile up. Where a line becomes two is now a
physical fitting on the drawing, not an invisible property of a port.

**3. A refusal must offer the legal alternative.** Blocking a connection
with no way forward is an obstacle, not a rule. The refusal names the
blocked nozzle and offers to place a branch fitting on equipment that
still has a free nozzle. Spent nozzles render filled, so the rule is
visible before you meet it by being refused.

**4. Two real defects were found by the new gate, in the remediation
path the gate was written to protect.** The tee offer followed the wrong
end of the refused connection (`target ?? source`), so dragging from a
spent nozzle into a free one offered to fix the vessel that was never the
problem; and the tee dropped 4px *under* the equipment it branched from,
because the offset was a fixed 24px from a port sitting on the boundary.
Both were found only after the checks were rewritten to be geometric —
the first version of the port test dragged onto a **free** tee port, which
any port accepts, so it passed with the branch-fitting exception deleted
entirely. A check that passes against the defect it exists to catch is
worse than no check, because it certifies the defect.

**5. Two gate-quality problems fixed rather than worked around.** The
geometry gate read each symbol's declared size out of its source and
**used to guess 80x80 when that read failed**, so a symbol whose size is a
computed expression was reported as having every port 28px off the drawn
ink — a gate inventing a defect. It now throws and names the symbol
(`scripts/mutate-size-reader.cjs` pins that). And the §4.9 tag fixture had
all 7 of its real reference line numbers attached to one vessel nozzle and
one pump nozzle — seven pipes on one flange. It had been wrong since it
was written and only surfaced when this rule arrived; the fixture was
corrected, not the rule.

**6. `npx tsc --noEmit` at the repo root is a no-op and was reporting
false clean.** The root `tsconfig.json` is solution-style (`"files": []`
plus project references), so the check type-checked nothing while printing
no errors, and reported a broken build as clean twice. `tsc -b` is the
real check and is what `npm run build` runs. Worth recording because the
failure mode is a green light, not a red one.

**Gate:** `scripts/verify-connections.cjs` (9 checks, real mouse input) —
must print `CONNECTIONS_PASS`. `scripts/mutate-connections.cjs`
deliberately reintroduces each defect this section claims to catch (guard
bypassed, rule made permissive, exception removed, exception applied
per-symbol, tee placed under the equipment, offer following the wrong
end, validator check dropped, refusal gone silent) and requires the
matching check to fail; all 8 mutations are caught. Written because the
gate's own first version passed against the mutation it existed to catch.

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
   - Symbol set and line conventions should visually match how a client's
     actual internal documentation looks (see v1's industry-standard symbol
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
- ~~No undo/redo~~ — **BUILT 2026-09-13 (`cdccd2c`).** Removed from the
  non-goals: §8 deferred it when this was a 30-symbol single-sheet tool, and
  that premise no longer holds. Undo/redo now covers every user-visible
  mutation (drop, connect, delete, drag, tag/nozzle edits, sheet operations,
  numbering config). Buttons in the top bar; see §4.10. **Not yet done:**
  keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) are not wired.
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
- **Carve-out: free lines (SHIPPED — explicit user decision).** A line
  drawn by the user that is released over empty canvas is stored as an
  ordinary edge carrying `data.freePipe: true` plus its two canvas-space
  endpoints (`data.freeStart` / `data.freeEnd`). Such a line is
  **exempt from connection validity by definition** — it has no nozzles,
  so it cannot dangle. The exemption is *targeted*: it keys off the
  explicit flag, never off "missing handles", so a genuinely
  unconnected process pipe is still reported as `unconnected-pipe` and
  still blocks export.
  - **Known tradeoff, accepted deliberately.** The engine's core promise
    is "structurally correct, not just visually plausible." Free lines
    introduce a hole in that promise: a line that terminates nowhere is
    legal ink. Rationale: engineers sketching a P&ID need to draw a
    tie-in or a future/erection line without inventing a fake nozzle to
    host it, and forcing that produces *worse* drawings than allowing a
    plainly unconnected one. The hole is bounded — free lines are one
    boolean flag, they are excluded from the connected-edge set passed
    to react-flow and rendered in their own overlay, and they never
    satisfy a port. A reviewer can enumerate every one of them with a
    single filter on `data.freePipe`.
  - Rationale for storing them as real edges rather than a separate
    array: they round-trip through the same versioned JSON envelope,
    autosave, and undo path as everything else, with no second
    persistence format to keep in sync.
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
- Carry forward the industry-standard visual language validated in v1:
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
- **SHIPPED STATUS (2026-09-14): the library holds 68 symbols across
  11 categories, 164 declared ports.** (67/161 on 2026-09-13; +1 symbol and
  its 3 ports on 2026-09-14 — the `tee-branch` branch fitting, §4.12.) The original 30-symbol core set is
  complete, plus a 37-symbol expansion authored against ISA-5.1 / ISO
  10628: storage tanks (cone/floating roof), knock-out drum, 3-phase
  separator, silo, complete distillation column, absorber tower,
  fixed-bed + fluidized-bed reactors, gear/diaphragm/screw/vacuum pumps,
  centrifugal compressor, blower, globe/butterfly/3-way/motor-operated/
  regulator valves, FT/PT/TT/LT/PDT/AT transmitters, DCS controller,
  local indicator, kettle reboiler, condenser, air cooler, fired heater,
  evaporator, spectacle blind, expansion joint, steam trap, pipe support.
  - **Acceptance gate (objective, reproducible):**
    `node scripts/verify-port-outline.cjs http://127.0.0.1:5199/` must
    print `PORT_OUTLINE_PASS`. It mounts every registered kind as a real
    node in headless Chromium and measures each declared port's distance
    to the symbol's actual *drawn ink* — not to its bounding box. A port
    on the bounding box can still float in empty space beside the shape
    (the "nozzle floats off the vessel" defect), so box-vs-shape is the
    thing that must be measured. Any new symbol is expected to pass this
    before it is committed.
  - **`pipe-support` declares zero ports on purpose.** It is a drawing
    annotation (like draw.io's non-connectable stencils), not equipment.
    The validity engine has no isolated-node rule, so a zero-port node is
    legal and reports no error.

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
- **Configurable line/tag numbering (explicitly requested). — SHIPPED 2026-09-13
  (`eda55e6`).** A settings panel (top bar → *Numbering*) where the numbering
  scheme for line numbers and tags is defined once for the project: tag shape,
  area/unit, sequence start, zero-pad width, suffix, step, and a per-type
  starting number; plus the line-number format fields. Exact scheme is
  configurable, not hardcoded to one house style.
  - **Two tag shapes, because both are real house standards.** `plain`
    (`V-101`, `P-102`) and `area` (`P-710.01A`, `D-710.2.01A`). The area form
    is not invented — the reference drawing in §6 tags its equipment
    `P-710.01A/B` and `D-710.2.01A`, carrying the *same area* as its line
    numbers. A feature that could only emit `V-101` could not reproduce the
    drawing it was measured against. Two-level sequences (`2.01`) are handled
    because that drawing uses them.
  - **The line sequence runs per AREA, across services.** On the reference
    sheet `710.01` carries DIC2, `710.20` carries JAC, and LPS2 also uses
    `710.01A`. A per-service model would emit duplicate numbers on a real
    drawing, so per-area is the implemented rule.
  - **Bulk numbering fills blanks only, in reading order.** Renumbering a line
    that already carries a number is destructive and is not done on the user's
    behalf. Unnumbered runs are numbered top-of-sheet first.
  - **Backward compatible by construction.** A project saved before this
    feature has no `numbering` block; it loads unchanged and still tags its
    first vessel `V-101`. Deliberately NO version bump — the envelope check is
    strict (`!== PROJECT_VERSION` rejects), so bumping it would reject every
    saved file.
  - **Auto-numbering never proposes an existing tag.** Tag uniqueness is a
    hard error (§4.1), so a collision would make the tool generate the very
    error it refuses to export. The check keys off how the candidate was
    derived, not merely the output.
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
- **SVG export — CORRECTED 2026-09-13: this does NOT exist.** Earlier
  revisions of this PRD claimed it "already works, cheap to retain". A full
  search of `src/` for any export path (`download`, `createObjectURL`,
  `toBlob`, `XMLSerializer`, `svg` serialisation) returns nothing. There is no
  export of any kind in the build, and there never was in this codebase. It is
  therefore NOT a cheap carry-forward — it is unbuilt work, like PDF. The claim
  was inherited from v1 and never checked against v2's source. Recorded here
  rather than silently deleted, because the same wrong assumption ("export is
  basically done") is what would let §4.4 keep slipping.
- **DEXPI/Proteus XML export (stretch, low priority):** v1's clean-room
  implementation (nozzle-level connectivity, real RDL URI mapping,
  line-spec attributes) was reasonably solid — if/when this gets
  revisited, port that logic rather than re-deriving from scratch, but
  do not schedule it before 4.1–4.4 (PDF) are done and solid.

### 4.5 Hosting — DONE (verified 2026-09-13)
- Self-hosted on apollopi (Raspberry Pi), same pattern as v1: build →
  static file server → systemd unit → reachable over Tailscale only.
  **Status: this is already in place, not pending.** `pid-drafter.service` is
  `active` **and** `enabled` (boot-persistent), serving
  `~/projects/pid-drafter/dist/` on `0.0.0.0:5173`, HTTP 200. Earlier PRD
  wording listed it as outstanding alongside the genuinely-unbuilt §4.4.
  Caveat worth stating: the unit serves `dist/`, so **any `npm run build`
  swaps the live site** — a build is a deploy.
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
  SHEET 2, LINE 1½"-LPS2-710.02"); ideally, clicking it navigates to
  that sheet/location.
- Tag uniqueness (4.1) is enforced **project-wide across all sheets**,
  not just per-sheet — this is what makes cross-sheet references
  actually trustworthy rather than a labeling convention with no
  teeth.
- Sheet management (add/rename/reorder/delete sheets) lives in a
  simple sheet-tabs UI, similar in spirit to spreadsheet tabs.

### 4.9 Chemical-engineering depth (NEW — 2026-09-13)

The product identity claim in §4.3.1 ("this is a P&ID tool, not a
diagramming tool") is only as strong as how much process engineering the
tool actually knows. Measured against the real issued drawing in §6,
three areas did not clear that bar. Each is a requirement with an
acceptance gate, not an aspiration.

**4.9.1 Data sheets cost the real engineering, per symbol type.**
- Every symbol category has a real field set; no category may fall
  through to a lone "Service / Description". Coverage was 6 of 11
  categories; Columns and Reactors — the two most important equipment
  types in the table — were among the missing.
- A **kind-level override sits above the category layer**, because a
  category's members often share nothing but a filing label. Piping
  Accessories is the clear case: a strainer, a restriction orifice, a
  steam trap and a spectacle blind want four different sheets. Heat
  Exchangers likewise — an air cooler needs fan data, a fired heater
  needs firing rate and efficiency, a kettle reboiler needs boil-up.
- Reactors capture conversion, selectivity, residence time, space
  velocity, heat of reaction, phase, catalyst type/loading/life, jacket
  medium and duty, mixing power per volume. Columns capture internals,
  inside diameter, tangent-to-tangent height, theoretical stages, actual
  trays, tray spacing, packed height, reflux ratio, feed stage, reboiler
  and condenser duty. Full field inventory in
  `src/dataSheet/fieldSchemas.ts`.
- Fields carry a **group** (Process / Reaction / Design / Performance /
  Mechanical / Instrumentation) and render sectioned, so a 28-field
  reactor sheet reads as a data sheet rather than one undifferentiated
  column of inputs.
- **Field ids are a compatibility surface.** A saved project stores
  values keyed by field id, so renaming or removing one silently blanks
  that column of every existing drawing. Adding is free; renaming is a
  migration. Gate: `scripts/verify-datasheets.cjs` check (g) diffs id
  literals against the previous commit's source, **not** through the DOM
  — the DOM only shows ids reachable from whatever the fixture mounts,
  so a dropped id on an unmounted category would pass unnoticed.

**4.9.2 Tags and line numbers carry real semantics, not free text.**
- Instrument tags validate against **ISA-5.1** function codes with
  autocomplete; an unrecognised code is a warning, not a hard block
  (house standards legitimately add codes).
- Equipment tags validate prefix against symbol type — a `V-` on a pump
  or an instrument tagged `QQ-101` is a warning.
- Line numbers follow the **§6 format** —
  `{size}"-{service-code}-{area}.{seq}{suffix}-{class}-{insulation}`
  (e.g. `1½"-LPS2-710.01A-300-HC`) — parsed into structured parts rather
  than stored as one opaque string. Service code and piping class are
  constrained fields; the parser back-fills from existing free text so
  already-drawn lines are not orphaned.
- Gate: `scripts/verify-tags.cjs`.

**4.9.3 Nozzles carry size and rating. — SHIPPED 2026-09-13 (`2c2dd8b`)**
- Every port may declare a nominal size and an ANSI/ASME class, shown in
  the data sheet's nozzle editor. The real drawing sizes every nozzle
  (`ø1 1/2" ANSI 150#`); bare geometry is not a nozzle schedule.
- Nozzle sizes are deliberately **not defaulted** in the 68 symbol
  definitions (67 when this shipped; §0e adds the branch fitting). A vessel has no inherent nozzle size — it is a project
  decision. Field, suggestions and schedule are provided; the numbers come
  from the engineer. Defaulting them would put fabricated values into a real
  engineering document.
- Unconnected nozzles read **`SPARE — no connection`**, not a blank cell: the
  panel's `—` is the generic empty-cell placeholder, so blank was ambiguous
  with "not filled in yet".
- Size is per **nozzle**, not per line — a reducer means a 4" line can leave
  a 3" nozzle. Verified.
- **CORRECTED 2026-09-13:** an earlier revision of this PRD claimed nozzle
  size "feeds the existing spec check (§4.1)" and is "surfaced in the
  equipment list". Neither is true:
  - `specValidation.ts` never reads `ports` — it validates the pipe **line**
    spec (size / class / material) only. There is no nozzle-vs-line
    reconciliation. That is real engineering value and remains **unbuilt**
    (see the "Live engineering" backlog item); it is not a wording tweak.
  - The size is surfaced in the **nozzle schedule** — a 6th engineering list
    added with this work — not in the equipment list.
- Gate: `scripts/verify-nozzles.cjs` (NOZZLES_PASS 9/9).

**Standing requirement for all three:** the acceptance gates live in
`scripts/` and are run before commit, same discipline as the symbol
port-conformance gate (§4.2). A feature whose gate does not exist is not
done.

### 4.10 Undo / redo (NEW — 2026-09-13, `cdccd2c`)

Re-taken from §8's deferral; see §8 for why the premise expired.

- **Scope:** every user-visible mutation is undoable — equipment drop, pipe
  connect, delete, node drag, tag / data-sheet / nozzle edits, free lines,
  sheet add / rename / reorder / delete, project rename, and the numbering
  configuration. Two things deliberately are NOT:
  - **Selection and node-measurement changes.** They are applied (the canvas
    behaves exactly as before) but create no undo step. Recording them would
    bury real edits under entries whose undo does nothing visible, and a
    measurement change arrives when a node mounts — so on a freshly-opened
    sheet the first Ctrl+Z would appear dead.
  - **Loading a file.** History is CLEARED, not extended. Undo steps from a
    closed document would restore nodes belonging to a file no longer open,
    which is worse than having no undo. Loading is a new starting point.
- **One gesture = one step.** A drag emits a change per mousemove; typing a
  tag emits one per keystroke. Both must collapse to a single step, or undo
  becomes unusable exactly when it is needed. Gestures are grouped by a merge
  key that stays open for a short window and is sealed by any different key.
- **A delete is one step for the whole cascade.** Deleting a node with pipes
  produces two React Flow callbacks — **the pipe removal first**, then the node
  removal. Recorded separately, the first undo restores the node while its pipe
  stays gone: a state the user never created, with no undo path back to the
  intact drawing.
- **Depth:** bounded (oldest entries dropped), surfaced in the button tooltip.
- **UI:** Undo / Redo buttons in the project top bar, disabled when empty.
  Keyboard shortcuts are NOT yet wired (see §7a item 7).
- **Gate:** `scripts/verify-undo.cjs`, 19 checks, real mouse input. Assertions
  compare **positions numerically** and **depth deltas**, not node counts — a
  no-op undo leaves the node count unchanged and satisfies a lax test. The gate
  was itself mutation-tested: each fix was reverted in turn to confirm the gate
  fails, and one mechanism that no mutation could break was deleted as dead
  code rather than kept as insurance.

### 4.11 Acceptance gates (the definition of "done")

Every functional requirement above is backed by an executable gate. A feature
whose gate does not exist is not done — that rule is why the numbering feature
and undo/redo were treated as unbuilt until their suites existed. Run the dev
server, then:

```
node scripts/verify-port-outline.cjs http://127.0.0.1:5199/   # 4.2  symbol ports on drawn ink
node scripts/verify-datasheets.cjs   http://127.0.0.1:5199/   # 4.9  data-sheet depth
node scripts/verify-lists.cjs        http://127.0.0.1:5199/   # 4.6  derived engineering lists
node scripts/verify-tags.cjs         http://127.0.0.1:5199/   # 4.9  ISA-5.1 tags + line numbers
node scripts/verify-nozzles.cjs      http://127.0.0.1:5199/   # 4.9  nozzle schedule
node scripts/verify-numbering.cjs    http://127.0.0.1:5199/   # 4.3  configurable numbering
node scripts/verify-undo.cjs         http://127.0.0.1:5199/   # 4.10 undo / redo
node scripts/verify-freeline.cjs     http://127.0.0.1:5199/   # 4.1  free-line carve-out
node scripts/verify-bug3.cjs         http://127.0.0.1:5199/   # 4.3  connection preview router
node scripts/verify-connections.cjs  http://127.0.0.1:5199/   # 4.12 one pipe per nozzle + branch fittings
```

Each prints a `*_PASS` line and exits 0. They are driven by real browser input
(Playwright/CDP), never synthetic DOM events: React Flow's drag handling binds
move listeners on `window`, so a gate that faked input would pass while the
feature was broken in the user's hands. Those gates have themselves been
mutation-tested; the mutations live in the repo so they can be re-run:

```
node scripts/mutate-connections.cjs  http://127.0.0.1:5199/   # 8 deliberate defects, 8 must be caught
node scripts/mutate-size-reader.cjs  http://127.0.0.1:5199/   # the port-outline gate must refuse to guess
```

Four further rules the gates encode:

- **Assert on the thing that would break, not a proxy for it.** Undo is checked
  by comparing node POSITIONS and undo-DEPTH DELTAS, never node counts — a
  no-op undo leaves the count unchanged and would satisfy a lax test.
- **Mutation-test the gate.** A gate that has never failed is not evidence.
  Each fix behind §4.3 and §4.10 was reverted in turn to confirm the gate
  fails on the specific checks that map to it. §4.12's gate earned this the
  hard way: two of its checks initially passed against the very defect they
  were written to catch — one dragged onto a FREE tee port (which any port
  accepts, so it passed with the exception deleted entirely), the other relied
  on an incidental screen coordinate. Both were rewritten to require a port
  that is already spent and a geometric separation respectively.
- **A gate must not report a defect it cannot see.** `verify-port-outline.cjs`
  reads each symbol's declared size out of its source to convert screen
  measurements back into node-local units, and it USED to fall back to a
  guessed 80x80 when that read failed — so a symbol whose size was a computed
  expression was reported as having every port "28px off the drawn ink", which
  is a gate inventing a geometry bug. It now throws and names the symbol.
  `scripts/mutate-size-reader.cjs` pins that behaviour.
- **A test fixture that cannot represent a real drawing is a false-positive
  factory.** The §4.9 tag fixture had all 7 of its reference line numbers
  attached to one vessel nozzle and one pump nozzle — seven pipes on one
  flange. It went unnoticed until §4.12 arrived and the "clean drawing produces
  no warnings" check started failing for the right reason. The fixture was
  wrong, not the rule; it is now a header arrangement with two tees.

---

### 4.12 Connectivity soundness + branch fittings (NEW — 2026-09-14)

The two items §7a ranked cheapest-and-most-fundamental, built together
because they are one decision. Recorded here as the spec, not as a
description of the code.

**4.12.1 One pipe per nozzle.** A nozzle is a hole in a vessel wall with a
flange on it. Two pipes cannot bolt to one flange, so a drawing showing three
runs converging on one nozzle is not a drawing of anything buildable. §4.1
claims the engine checks structural correctness; graph validity without this
rule is not structural correctness, and the tool asserted a property it did
not hold.

Enforced at **two** points, deliberately, and both are required:

- **During the drag** (`isValidConnection`). The refused connection is never
  created. Creating an edge and then silently deleting it is indistinguishable
  from a broken drag, so the refusal has to happen while the user's hand is
  still on the gesture.
- **In the validity engine** (`port-overloaded`, a hard error). Data that never
  went through a drag — a JSON load, a hand-edited file — is condemned by the
  panel. If the canvas refused connections while the panel blessed the
  resulting file, one of the two would be lying and the user could not tell
  which.

**4.12.2 Single-connection is the default; the exception is declared per port.**
A symbol declares `multiBranchPorts?: string[]` — port ids that may carry more
than one pipe — and empty/absent means every port takes exactly one. An
unrecognised symbol gets the STRICT rule, so a symbol that fails to load cannot
become a place pipes pile up.

**4.12.3 The branch fitting owns the split.** `tee-branch` (Piping Accessories,
3 ports: Run Inlet, Run Outlet, Branch) declares its two run ports as
multi-branch; its branch port does not. So:

- a header with branches is drawable — the arrangement this rule would
  otherwise make impossible, and the most ordinary arrangement in process
  piping;
- the exception is per-port, not per-symbol. A tee whose *every* port accepted
  any number of pipes would be a sanctioned version of the exact defect the
  rule forbids, and there is a check for that specific mistake.

Where a line becomes two is a fitting, and the fitting is drawn. Branching that
is not visible as a fitting is not branching; it is a drawing error.

**4.12.4 A refusal must offer the legal alternative.** Blocking a connection
without offering a way forward is just an obstacle, so the refusal does three
things: names the blocked equipment and nozzle, and — when that equipment still
has a free nozzle — offers to place a branch fitting on it, tagged uniquely as
the house code for a fitting (`TEE-101`, `TEE-102`, …; a tee has no equipment
number because it is identified by its line number). The offer follows the
BLOCKED end, not the dragged-to end: a drag from a spent nozzle into a free one
must not offer to fix the equipment that was never the problem.

**4.12.5 A spent nozzle looks spent.** Ports carrying a pipe render filled. A
rule the user only meets by being refused reads as a broken tool; a nozzle that
visibly already has a pipe on it reads as engineering.

**Acceptance gate:** `node scripts/verify-connections.cjs` — 9 checks driven by
real mouse input, plus `node scripts/mutate-connections.cjs`, which reintroduces
each specific defect (guard bypassed, rule made permissive, exception removed,
exception applied per-symbol, tee placed under the equipment, offer following
the wrong end, validator check dropped, refusal gone silent) and requires the
matching check to FAIL. All 8 mutations are caught.

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

## 6. Reference Template — Real Client Drawing (Ground Truth)

Reyhan supplied a real, issued client P&ID drawing
(`X-00000-000-01`, Continuous Saponification Plant, Rev. 3) as the
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
  - **MEASURED MISMATCH 2026-09-13 (`src/symbols/isaBubble.tsx`).** The
    implementation draws a **divided** bubble: function code above a horizontal
    divider, loop number below it, **both inside the circle** (`showLoop` puts
    the loop number at `cy + fontSize`, inside the radius). The reference
    drawing has no divider and the loop number sits **outside** the circle.
    Both styles are legitimate ISA-5.1 in general, but §6 says match *this*
    drawing rather than a generic default, and the divided form is the generic
    one. Not changed in the numbering work — logged as an open discrepancy so
    the next symbol pass can align it with the reference, or the PRD can state
    that the divided form is a deliberate deviation.
  - Note this bubble is nonetheless a **net fix** over what preceded it: the 9
    instrument symbols used to hardcode their own letters (`FIC`, `PI`, `XY`)
    regardless of the node's tag, so a controller tagged `LIC-710.3` drew
    `FIC` — two tags for one instrument. The bubble now reads its own tag.
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
- **Line weight hierarchy — PARTIALLY BUILT. Status measured 2026-09-13:**
  1. Heaviest — vessel outlines, main process pipe run
  2. Medium — branch/secondary process piping
  3. Thin — instrument leader/capillary lines
  4. Thin dashed — pneumatic/electric signal lines
  5. Thin dash-dot or fine dashed — battery-limit/scope boundary lines

  Tiers 1 (**vessel outlines only**), 3 and 4 are implemented. **Tiers 2 and 5
  are not, and tier 1's "main process pipe run" half is not either:**
  - **Every process pipe is drawn at the same weight.** `PipeEdge.tsx` sets
    `strokeWidth: 2` unconditionally — there is no main-run vs branch
    distinction, so tier 2 has nothing to differ from and tier 1's pipe half
    is unrepresented. On a dense sheet every run currently looks identical.
  - **Battery-limit lines cannot be drawn at all.** `PipeEdgeData.lineType` is
    a two-value union, `'process' | 'signal'`; there is no dash-dot type and
    no scope-boundary concept, so tier 5 is unimplementable as the model
    stands rather than merely unbuilt.
  Recorded as measured because the PRD's "adopt as a real spec" wording reads
  as though the hierarchy is in place, and the reference drawing's own sheet
  uses battery-limit lines prominently — a rebuild that omits them does not
  look like the drawing it is meant to match.
- **Line number format:** `{size}"-{service-code}-{line-number}-{spec}-
  {insulation-suffix}`, e.g. `1½"-LPS2-710.01A-300-HC` — this is a real,
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

### 7a. Open items found by measuring the build against this document (2026-09-13)

Ordered by how much they cost on a real drawing, not by how hard they are.
All are **unbuilt**, verified against source, not inferred from absence.

1. ~~**Nothing limits how many pipes attach to one nozzle.**~~ **RESOLVED
   2026-09-14 — now §4.12.** A nozzle carries exactly one pipe, refused during
   the drag and reported by the validity engine on data that arrived any other
   way. The decision lives in one place (`src/validation/connectionRules.ts`)
   so the canvas and the panel cannot disagree.
2. ~~**No tee / junction fitting in the 67-symbol library.**~~ **RESOLVED
   2026-09-14 — now §4.12.** The library holds 68 symbols: `tee-branch` adds a
   3-port branch fitting whose declared run ports are the ONE place in the
   library where more than one pipe may attach. Branching is therefore a
   visible fitting in the drawing, not an invisible property of a port.
3. **Battery-limit / scope-boundary lines do not exist** (§6 tier 5). The
   reference drawing uses them; `lineType` has no slot for them. See §6.
4. **No line-hop at crossings.** Real P&IDs break one line over another where
   they cross without connecting; every crossing in this tool looks like an
   unmarked intersection. With more than a few runs on a sheet this becomes
   genuinely ambiguous — a reader cannot tell a crossing from a connection.
5. **Paper template + export (§4.4) — nothing exists.** No border, title
   block, revision block or legend box; no PDF, and (corrected above) no SVG
   either. This is the difference between a tool Reyhan uses and a tool whose
   output a colleague can be handed, so it is the highest-value remaining
   item even though it comes after the correctness items.
6. **Nozzle-vs-line reconciliation** (§4.9.3 correction). A 4" line leaving a
   3" nozzle is legal and silent. This is the strongest "live engineering"
   material available — it turns the validity engine into something that
   knows *process* rules, not just graph rules — and it should be built on
   top of a sound connectivity model, not before it.
7. ~~**Undo/redo.**~~ **RESOLVED 2026-09-13 (`cdccd2c`), now §4.10.** The
   deferral was re-taken and undo/redo is built and gated
   (`scripts/verify-undo.cjs`, 19 checks, driven by real mouse input). Three
   real defects were found and fixed by that gate after the feature looked
   finished: undo of a drag was a complete no-op; deleting a node with pipes
   took two steps and left the node restored with its pipe still gone; and the
   step count depended on wall-clock timing because the merge key embedded a
   timestamp and StrictMode double-invokes state updaters. **Remaining:** no
   keyboard shortcuts yet, and all evidence is from the dev build — the
   StrictMode double-invoke that made the third bug nondeterministic is absent
   from prod, so that path still deserves its own run.
8. **Line weight hierarchy partially implemented** (§6). Main-run vs branch
   piping distinction and battery-limit weight are absent; every process run
   draws at one weight.
9. **Bubble convention differs from the reference** (§6) — divided bubble with
   the loop number inside, versus the reference's undivided bubble with the
   loop number outside. Either align it or record it as a deliberate choice.

---

## 8. Out of Scope for v2.0 (explicitly deferred, may revisit later)

- ~~Undo/redo~~ — **NO LONGER DEFERRED; built 2026-09-13 (`cdccd2c`), §4.10.**
  The deferral was taken against a 30-symbol single-sheet tool; the tool is now
  68 symbols, multi-sheet, with derived lists and a numbering panel, and the
  cost of a mis-drag grew with it while the cost of building undo did not.
  Re-taking a deferral when its premise expires is the point of recording the
  premise.
- DEXPI export (until 4.1–4.8 solid)
- Real ISA-5.1/DEXPI standard certification-level compliance
- Any collaboration/multi-user feature
- Automated revision-diffing / auto revision-cloud generation (manual
  rev block entry is sufficient — see §2 and §3)

