import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Pressure Transmitter (PT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterPressureGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.thin;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <text x={cx} y={cy + 4} fontSize={11} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        PT
      </text>
    </svg>
  );
}

const transmitterPressure: SymbolDefinition = {
  kind: 'transmitter-pressure',
  label: 'Pressure Transmitter (PT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'PT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterPressureGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterPressure;
