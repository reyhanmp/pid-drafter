# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Symbols

Every symbol lives as a self-contained module in `src/symbols/`, registered
in `src/symbols/index.ts`. The palette (right-hand panel) is derived
automatically from this registry — categories and counts require no manual
maintenance.

- **Vessels**: Vertical Vessel, Horizontal Vessel
- **Columns**: Tray (Distillation) Column, Packed / Fluid-Contacting Column
- **Reactors**: CSTR, PFR (Plug Flow Reactor), Jacketed Reactor
- **Pumps**: Centrifugal Pump
- **Valves**: Gate Valve, Control Valve, Check Valve, Ball Valve, Relief Valve (PSV), Solenoid Valve
- **Instruments**: Instrument Bubble (Field), Instrument Bubble (DCS), Pressure Gauge (PG)
- **Agitators**: Agitator
- **Heat Exchangers**: Heat Exchanger (shell & tube), Plate Heat Exchanger, Double-Pipe Heat Exchanger
- **Piping Accessories**: Concentric Reducer, Restriction Orifice, Strainer, Flange Pair, Inline Flow Meter
- **Signal & Logic**: Relay / Solenoid Pilot (XY)
- **Terminators**: Vent to Atmosphere, Drain Point, Off-Page / Tie-In Connector

### Adding a new symbol

1. Create `src/symbols/<your-symbol>.tsx` following the pattern of any
   existing module (export a default `SymbolDefinition`: geometry
   component, named ports with position + direction normal, category,
   default size, tag prefix).
2. Import it in `src/symbols/index.ts` and add it to `allSymbols`.

That's it — the palette and node registry pick it up automatically.

## Equipment & line data sheets

Single-clicking a node or a pipe opens a data sheet in the **left-side
panel** (the right-hand palette always stays visible, regardless of
selection).

**Equipment data sheet** (click a node): fields differ by equipment
category (vessel gets design pressure/temp/material/volume, pump gets
flow rate/head/NPSH/driver power, valve gets size/rating/fail position,
etc.) — see `src/dataSheet/fieldSchemas.ts`. Double-clicking a node still
opens the quick tag-edit modal, unchanged.

**Line data sheet** (click a pipe) — `src/components/LineDataSheetPanel.tsx`:
line name, nominal size (dropdown), jacketed/traced (checkbox), material
of construction (real ASME/ANSI-style pressure-class + alloy dropdown —
see `MATERIAL_OF_CONSTRUCTION_OPTIONS` in `src/types/diagram.ts`), and a
piping/instrument line-type toggle that actually flips the rendered line
between solid and dashed.

**Deleting a pipe**: select it (click), then either press Delete/Backspace
or click the small × button that appears at the pipe's midpoint.

Each node instance can also have its own custom ports/nozzles, added,
repositioned, or removed independently of the symbol type's default set
(`src/symbols/effectivePorts.ts` resolves "this instance's ports, or the
symbol's defaults if uncustomized"). This is edited from the same
equipment data sheet panel.

Connecting a pipe to a newly-added custom nozzle works reliably — each
node's handle geometry is declared directly via React Flow's `node.handles`
field (`src/symbols/toReactFlowHandles.ts`) rather than relying on DOM
measurement, which eliminates a timing race that used to affect
freshly-added nozzles.

## Rotation & manual nozzle dragging

Every equipment node supports 90°-snap rotation (0/90/180/270), toggled
via the "⟳ Rotate 90°" button in the data sheet panel. Rotating a node
visually spins its geometry (a CSS transform) AND recomputes every port's
position/direction (`src/symbols/rotatePorts.ts`, composed into effective
ports via `getRenderedPorts` in `effectivePorts.ts`) — new pipe connections
made after rotation correctly respect the new orientation. Existing pipes
connected before a rotation keep their originally-recorded direction (a
known, acceptable limitation — they don't retroactively re-route).

Nozzles can also be repositioned by directly dragging their flange glyph
on the canvas (in addition to the numeric x/y/direction controls), while
the node is selected — the drag snaps to whichever bounding-box edge is
nearest and recomputes the outward direction accordingly. **Implementation
note**: the drag handler's SVG element must carry React Flow's `nodrag`
class, or React Flow's own node-drag listener silently consumes the
mousedown before our handler ever runs (found via a real repro — this is
a genuine, non-obvious React Flow gotcha worth knowing about if extending
this further).

Ports render as a short nozzle stub + perpendicular flange-face tick
(not a plain dot) — shared rendering logic in `EquipmentNode.tsx`, applies
uniformly to every symbol.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
