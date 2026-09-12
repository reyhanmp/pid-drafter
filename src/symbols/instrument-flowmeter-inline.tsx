import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Inline flow meter — same inline-accessory pattern as
 * restriction-orifice.tsx (centerline stubs feeding a small inline
 * body), but with a small circle/oval body instead of a thin flat plate,
 * distinguishing a flow-measuring element from a flow-restricting one.
 */
function InstrumentFlowmeterInlineGeometry({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.32;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={0} y1={cy} x2={cx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const instrumentFlowmeterInline: SymbolDefinition = {
  kind: 'instrument-flowmeter-inline',
  label: 'Inline Flow Meter',
  category: 'Piping Accessories',
  defaultWidth: 40,
  defaultHeight: 40,
  tagPrefix: 'FE',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 20, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 40, y: 20, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: InstrumentFlowmeterInlineGeometry,
  dexpi: { componentClass: 'FlowMeter' },
};

export default instrumentFlowmeterInline;
