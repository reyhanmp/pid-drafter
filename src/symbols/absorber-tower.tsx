import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Absorber / stripping tower — packed column outline with structured
 * packing indicated as crossing hatch bands and a liquid distributor.
 */
function AbsorberTowerGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.12);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const packTop = bodyTop + (bodyBottom - bodyTop) * 0.25;
  const packBottom = bodyTop + (bodyBottom - bodyTop) * 0.8;
  const bands = 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 ${bodyTop}
            A ${width / 2} ${capH} 0 0 1 ${width} ${bodyTop}
            L ${width} ${bodyBottom}
            A ${width / 2} ${capH} 0 0 1 0 ${bodyBottom}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.equipment}
      />
      {Array.from({ length: bands }).map((_, b) => {
        const bandH = (packBottom - packTop) / bands;
        const y0 = packTop + bandH * b;
        const y1 = y0 + bandH;
        return (
          <g key={b}>
            <line x1={width * 0.1} y1={y0} x2={width * 0.9} y2={y0} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
            <line x1={width * 0.1} y1={y1} x2={width * 0.9} y2={y1} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
            {/* cross-hatch = random packing */}
            <line x1={width * 0.1} y1={y0} x2={width * 0.9} y2={y1} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
            <line x1={width * 0.9} y1={y0} x2={width * 0.1} y2={y1} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
          </g>
        );
      })}
    </svg>
  );
}

const absorberTower: SymbolDefinition = {
  kind: 'absorber-tower',
  label: 'Absorber / Packed Tower',
  category: 'Columns',
  defaultWidth: 100,
  defaultHeight: 240,
  tagPrefix: 'T',
  ports: [
    { id: 'gas-in', label: 'Gas Inlet', x: 50, y: 240, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'gas-out', label: 'Treated Gas Out', x: 50, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'lean-in', label: 'Lean Solvent In', x: 100, y: 60, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'rich-out', label: 'Rich Solvent Out', x: 0, y: 180, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: AbsorberTowerGeometry,
  dexpi: { componentClass: 'Column' },
};

export default absorberTower;
