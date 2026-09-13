# P&ID Drafter

A P&ID drafting tool built **specifically for chemical engineers** — not a
general diagram editor with process-engineering clip art bolted on. The
canvas holds structured engineering objects (tagged equipment with typed
ports, tagged lines with a parsed line number, scored validity), not
coloured rectangles, which is what lets the tool reason about a drawing
rather than just display one.

Everything is local: no account, no server, no upload. Open `dist/index.html`
or run the dev server — the project lives in the browser.

## Run it

```bash
npm install
npm run dev          # dev server
npm run build        # production bundle into dist/
```

Test suites (need a dev server on port 5199 and Playwright's chromium):

```bash
node scripts/verify-port-outline.cjs http://127.0.0.1:5199/   # symbol geometry gate
node scripts/verify-lists.cjs      http://127.0.0.1:5199/   # engineering lists
node scripts/verify-tags.cjs       http://127.0.0.1:5199/   # ISA-5.1 + line numbers
node scripts/verify-nozzles.cjs    http://127.0.0.1:5199/   # nozzle schedule
node scripts/verify-datasheets.cjs http://127.0.0.1:5199/   # data-sheet depth
node scripts/verify-freeline.cjs   http://127.0.0.1:5199/   # free-line mode
node scripts/verify-bug3.cjs       http://127.0.0.1:5199/   # connection preview
```

These are executable gates, not decoration. `verify-port-outline.cjs` mounts
all 67 symbols and measures every port against the actual drawn ink — it
caught two real defects (`column-complete`'s reboiler stopping 12px short of
its own bottoms nozzle, and `hx-kettle-reboiler`'s arc bulging outside its
bounding box) that would otherwise have shipped.

## What makes it a chemical-engineering tool

**Symbols are typed engineering objects.** Each of the 67 symbols declares
named ports with positions and outward direction normals, a category, a
default size and a tag prefix. A port is a *nozzle*, so a pipe must approach
it straight on, and a nozzle carries its own size and flange rating.

**Tags are read as standards, not strings.** An instrument tag is parsed as
ISA-5.1 — function code and loop number — and the tool shows you its reading
live under the tag input (`TIC-710.1A` → "Temperature Indicating Controller",
loop 710.1). Equipment tags validate their prefix against the drawn symbol:
`V-101` placed as a pump is flagged. Instruments draw their **actual** tag
inside the bubble, function code above the divider and loop number below for
DCS/shared-display bubbles, so a controller tagged `LIC-710.3` says `LIC` on
the drawing, not a hardcoded `FIC`.

**Line numbers are a grammar.** The format is
`{size}"-{service-code}-{area}.{seq}{suffix}-{class}-{insulation}`
(e.g. `1 1/2"-LPS2-710.01-300-HC`). The line data sheet offers a structured
editor over the parsed parts — change only the piping class without retyping
the string — alongside the raw text for anything the grammar does not cover.
Round-trip is byte-exact, because a parser that rewrites a client's line
number has corrupted their drawing.

**Validity is tiered, and lenient where reality requires it.**

| Tier | Behaviour | Examples |
|---|---|---|
| Errors | Block export | duplicate tags, pipes floating off a nozzle, unresolvable off-sheet references, instrument tags with no loop number |
| Spec compatibility | Soft | line material/rating disagreeing with the equipment on it |
| Tag & line semantics | Soft | unrecognised ISA code, prefix/symbol disagreement, unparseable line number |

The soft tier is soft deliberately. Real drawings extend the standards — the
reference drawing used for this project (`X-00000-000-01`, client
continuous saponification) uses `ZSL`, `ZSH`, `HS` and `AV`, none of which
ISA-5.1 defines. A tool that refused those drawings would be confidently
wrong about correct work. Only one tag rule is a hard error: no function
letters or no loop number, which genuinely breaks loop cross-referencing,
list generation and export.

**Derived engineering lists.** Line list, valve list, instrument index,
equipment list and nozzle schedule, all computed on render from the drawing
itself. There is no "generate" step and no second dataset, so a list cannot
disagree with the diagram: add a nozzle on the canvas and its schedule row
appears; delete a vessel and its rows go. CSV export included. A nozzle with
nothing on it reads `SPARE — no connection` rather than a blank, because a
blank is ambiguous between "spare" and "not filled in yet".

Nozzle sizes are deliberately **not** defaulted in the symbol definitions. A
vessel has no inherent nozzle size — it is a project decision — and inventing
plausible defaults would put fabricated engineering data in the schedule.

## Symbols

Every symbol is a self-contained module in `src/symbols/`, registered in
`src/symbols/index.ts`. The palette is derived from that registry, so
categories and counts need no manual maintenance.

**67 symbols, 11 categories:**

- **Vessels (7)**: Horizontal Vessel, Vertical Vessel, Knock-out Drum, Three-Phase Separator, Silo, Storage Tank (Cone Roof), Storage Tank (Floating Roof)
- **Columns (4)**: Tray Column, Packed Column, Distillation Column (w/ Condenser + Reboiler), Absorber / Packed Tower
- **Reactors (5)**: CSTR, PFR (Tubular Reactor), Jacketed Reactor, Fixed-Bed Reactor, Fluidized-Bed Reactor
- **Pumps (7)**: Centrifugal Pump, Gear Pump, Diaphragm / Metering Pump, Screw / PC Pump, Vacuum Pump, Centrifugal Compressor, Blower / Fan
- **Valves (11)**: Gate Valve, Globe Valve, Ball Valve, Butterfly Valve, Check Valve, Control Valve, Three-Way Valve, Motor-Operated Valve, Pressure Regulator, Relief Valve (PSV), Solenoid Valve
- **Instruments (11)**: Instrument Bubble (Field), Instrument Bubble (DCS), DCS Controller, Pressure Gauge, Local Indicator, Temperature / Pressure / Flow / Level / Differential-Pressure Transmitter, Process Analyzer
- **Heat Exchangers (8)**: Heat Exchanger (shell & tube), Plate, Double-Pipe, Condenser, Kettle Reboiler, Evaporator, Air-Cooled, Fired Heater
- **Piping Accessories (9)**: Concentric Reducer, Restriction Orifice, Strainer, Flange Pair, Inline Flow Meter, Spectacle Blind, Expansion Joint, Steam Trap, Pipe Support
- **Agitators (1)**: Agitator
- **Signal & Logic (1)**: Relay / Solenoid Pilot (XY)
- **Terminators (3)**: Vent to Atmosphere, Drain Point, Off-Page / Tie-In Connector

Instrument bubbles are drawn from `src/symbols/isaBubble.tsx`; port geometry
conventions live in `src/symbols/handleGeometry.ts`.

### Adding a symbol

1. Create `src/symbols/<name>.tsx` exporting a default `SymbolDefinition`:
   geometry component, named ports (position + direction normal), category,
   default size, tag prefix.
2. Import it in `src/symbols/index.ts` and add it to `allSymbols`.
3. Run `node scripts/verify-port-outline.cjs` — every port must land on the
   drawn outline, not the bounding box.

That is the whole cost: one file, one registry line, one gate.

## Data sheets

Click a node or a pipe to open its data sheet in the left panel (the palette
stays visible).

**Equipment** — fields differ by category and are grouped by engineering
concern (Process / Reaction / Design / Performance / Mechanical). A jacketed
reactor gets conversion, residence time, heat of reaction, jacket medium and
agitation power; a tray column gets stages, diameter, height, tray spacing,
feed stage and reflux ratio. Schemas live in
`src/dataSheet/fieldSchemas.ts`, with per-symbol overrides on top of the
per-category defaults — a strainer and an orifice plate are both "piping
accessories" but do not need the same fields.

**Line** — line number (raw + structured editor), name, nominal size,
material of construction (ASME/ANSI-style pressure class + alloy), jacketed /
traced, and a piping/instrument toggle that flips the drawn line between
solid and dashed.

**Nozzles** — every node instance can add, reposition, remove and *dimension*
its own nozzles independently of the symbol's defaults, from a numeric x/y
and direction control, a size, and a flange rating. Unused nozzles are
labelled spare.

Pipes are labelled with the line number alone — the number already encodes
size, service, area, sequence and piping class, so appending a description
would duplicate information and collide with equipment on a dense drawing.
Free lines keep their descriptive label since they have no number.

## Project management

- **Multi-sheet** — several drawings in one project, with off-page/tie-in
  connectors that resolve across sheets. A reference to a sheet or tag that
  no longer exists is a hard validity error; that is what gives cross-sheet
  references teeth.
- **Save / load JSON** — versioned envelope, self-identifying
  (`{"schema": "pid-drafter/project", "version": 2, ...}`), with strict
  per-field validation on load. Transient `__`-prefixed keys are stripped.
- **Autosave** — debounced (~1s) to localStorage, degrading gracefully if
  storage is unavailable (private mode, quota).
- **Loop cross-referencing** — hovering an instrument highlights every other
  instrument in the same loop, including a count badge for loop mates living
  on other sheets.

## Rotation, nozzles, and free lines

Nodes rotate in 90° steps; port positions and direction normals are
recomputed (`src/symbols/rotatePorts.ts`) so pipes made after a rotation
respect the new orientation.

Nozzles can be dragged directly by their flange glyph while the node is
selected — the drag snaps to the nearest bounding-box edge. The drag
handler's SVG carries React Flow's `nodrag` class; without it React Flow's
own node-drag listener consumes the mousedown in the capture phase and the
handler never runs.

**Free-line mode** (PRD §4.1 carve-out): dragging from a port into empty
space creates an unvalidated free line, for sketching a run before its
endpoints exist. These are stored explicitly as `data.freePipe` with
`freeStart`/`freeEnd` coordinates — never inferred from missing handles — and
are exempted from the dangling-pipe rule by a *targeted* check, so a genuinely
broken pipe is still reported. They render in a `ViewportPortal` overlay
because they have no node endpoints, and are therefore not React Flow edges;
deleting one is a store action rather than `setEdges`.

## Architecture notes

- **Vite + React + TypeScript + React Flow** (`@xyflow/react`). Runs headless
  on a Raspberry Pi (aarch64, Node 22).
- **Ports are geometry, and must agree with it.** React Flow re-measures
  handle bounds from the DOM via `ResizeObserver`, so the declared handle
  geometry and the rendered handle geometry must be numerically identical.
  `handleOffsetFromPort()` (port-relative, for rendering a handle inside a
  wrapper already positioned at the port) is distinct from `handleOffset()`
  (node-local absolute, for React Flow's declared `node.handles`) — applying
  the wrong one double-applies the offset.
- **Symbol SVGs are sized exactly to the node box with a matching viewBox**,
  so `getCTM()` output *is* node-local pixels. The outline gate depends on
  this; applying an extra transform on top produces a ~100× error.
- **Verification must use real input.** Synthetic DOM events do not drive
  React Flow's d3-drag — d3 binds its move listeners on `window`. The
  Playwright/CDP suites exist for this reason; see `scripts/harness.cjs`.

## Reference

`reference/` holds the issued drawing this tool's conventions were measured
against (`X-00000-000-01`, Continuous Saponification Plant). It is gitignored
and not distributed. `PRD.md` is the specification of record; §4.9 covers the
chemical-engineering depth requirements and §6 documents the line-number
format and symbol conventions taken from that drawing.
