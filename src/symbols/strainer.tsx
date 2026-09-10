import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Strainer — small box with diagonal cross-hatch "basket" indication, inline on the pipe. */
function StrainerGeometry({ width, height }: { width: number; height: number }) {
  const inset = 4;
  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={x0}
        y={y0}
        width={x1 - x0}
        height={y1 - y0}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={STROKE} strokeWidth={1} />
      <line x1={x1} y1={y0} x2={x0} y2={y1} stroke={STROKE} strokeWidth={1} />
    </svg>
  );
}

const strainer: SymbolDefinition = {
  kind: 'strainer',
  label: 'Strainer',
  category: 'Piping Accessories',
  defaultWidth: 30,
  defaultHeight: 30,
  tagPrefix: 'ST',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 30, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: StrainerGeometry,
  dexpi: { componentClass: 'Strainer' },
};

export default strainer;
