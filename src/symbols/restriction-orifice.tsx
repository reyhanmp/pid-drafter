import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Restriction orifice — thin flat plate perpendicular to flow, inline on the pipe centerline. */
function RestrictionOrificeGeometry({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const plateW = 3;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* centerline stubs to visually connect the ports to the plate */}
      <line x1={0} y1={height / 2} x2={cx - plateW / 2} y2={height / 2} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx + plateW / 2} y1={height / 2} x2={width} y2={height / 2} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <rect
        x={cx - plateW / 2}
        y={0}
        width={plateW}
        height={height}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const restrictionOrifice: SymbolDefinition = {
  kind: 'restriction-orifice',
  label: 'Restriction Orifice',
  category: 'Piping Accessories',
  defaultWidth: 30,
  defaultHeight: 30,
  tagPrefix: 'RO',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 30, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: RestrictionOrificeGeometry,
  dexpi: { componentClass: 'RestrictionOrifice' },
};

export default restrictionOrifice;
