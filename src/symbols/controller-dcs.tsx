import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** DCS Controller (shared display) — ISA-5.1 instrument bubble, shared-display/DCS (with divider). */
function ControllerDcsGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.thin;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* DCS/shared-display divider, ISA-5.1: function above, loop number below */}
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <text x={cx} y={cy - 4} fontSize={11} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        FIC
      </text>
    </svg>
  );
}

const controllerDcs: SymbolDefinition = {
  kind: 'controller-dcs',
  label: 'DCS Controller (shared display)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'FIC',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: ControllerDcsGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default controllerDcs;
