import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Plate heat exchanger — compact rectangle with 4-5 evenly-spaced
 * parallel diagonal lines inside representing the plate pack.
 * Port choice: 2 process ports only (hot-side in/out) — this symbol
 * models a single-circuit plate HX at the level of detail the rest of
 * this palette uses (heat-exchanger.tsx's shell-and-tube uses 4 ports
 * because it explicitly separates tube/shell circuits; a plate HX in a
 * P&ID is more commonly drawn as a single inline 2-port device with the
 * other circuit implied/omitted at this drawing scale).
 */
function HeatExchangerPlateGeometry({ width, height }: { width: number; height: number }) {
  const plateCount = 5;
  const margin = width * 0.1;
  const innerW = width - margin * 2;
  const spacing = innerW / (plateCount + 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {Array.from({ length: plateCount }).map((_, i) => {
        const x = margin + spacing * (i + 1);
        return (
          <line
            key={i}
            x1={x - height * 0.15}
            y1={height * 0.85}
            x2={x + height * 0.15}
            y2={height * 0.15}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin * 0.85}
          />
        );
      })}
    </svg>
  );
}

const heatExchangerPlate: SymbolDefinition = {
  kind: 'heat-exchanger-plate',
  label: 'Plate Heat Exchanger',
  category: 'Heat Exchangers',
  defaultWidth: 90,
  defaultHeight: 90,
  tagPrefix: 'E',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 45, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 90, y: 45, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: HeatExchangerPlateGeometry,
  dexpi: { componentClass: 'PlateHeatExchanger' },
};

export default heatExchangerPlate;
