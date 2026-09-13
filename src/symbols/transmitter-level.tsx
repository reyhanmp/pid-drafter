import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Level Transmitter (LT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterLevelGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.thin;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <text x={cx} y={cy + 4} fontSize={11} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        LT
      </text>
    </svg>
  );
}

const transmitterLevel: SymbolDefinition = {
  kind: 'transmitter-level',
  label: 'Level Transmitter (LT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'LT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterLevelGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterLevel;
