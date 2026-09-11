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
- **Pumps**: Centrifugal Pump
- **Valves**: Gate Valve, Control Valve, Check Valve, Ball Valve, Relief Valve (PSV), Solenoid Valve
- **Instruments**: Instrument Bubble (Field), Instrument Bubble (DCS)
- **Agitators**: Agitator
- **Heat Exchangers**: Heat Exchanger
- **Piping Accessories**: Concentric Reducer, Restriction Orifice, Strainer, Flange Pair
- **Signal & Logic**: Relay / Solenoid Pilot (XY)
- **Terminators**: Vent to Atmosphere, Drain Point, Off-Page / Tie-In Connector

### Adding a new symbol

1. Create `src/symbols/<your-symbol>.tsx` following the pattern of any
   existing module (export a default `SymbolDefinition`: geometry
   component, named ports with position + direction normal, category,
   default size, tag prefix).
2. Import it in `src/symbols/index.ts` and add it to `allSymbols`.

That's it — the palette and node registry pick it up automatically.

## Equipment data sheet & per-instance nozzles

Single-clicking a node selects it and shows a full data sheet in the
right rail (replacing the palette until deselected). Fields differ by
equipment category (vessel gets design pressure/temp/material/volume,
pump gets flow rate/head/NPSH/driver power, valve gets size/rating/fail
position, etc.) — see `src/dataSheet/fieldSchemas.ts`. Double-clicking a
node still opens the original quick tag-edit modal, unchanged.

Each node instance can also have its own custom ports/nozzles, added,
repositioned, or removed independently of the symbol type's default set
(`src/symbols/effectivePorts.ts` resolves "this instance's ports, or the
symbol's defaults if uncustomized"). This is edited from the same data
sheet panel.

**Known limitation:** connecting a pipe to a *newly-added* custom nozzle
does not currently work reliably. React Flow caches each node's handle
geometry internally and only re-measures it under specific conditions;
adding a nozzle changes the rendered Handles but there's a timing race
with React Flow's own internal node-sync pass that can leave the cache
stale, so a drag from a brand-new nozzle may silently fail to connect.
Connecting to any of a symbol's *original* (palette-default) ports works
correctly and is unaffected. Repositioning/removing existing nozzles,
and the data sheet fields themselves, all work as expected — only
*newly added* nozzles have this connection gap. Root cause is understood
(see `EquipmentNode.tsx`'s `updateNodeInternals` effect and its comments)
but not yet fully resolved; flagged here rather than silently shipped.

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
