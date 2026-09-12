import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Local pressure gauge (PG) — structurally near-identical to
 * instrument-circle.tsx: real ISA convention draws all field-instrument
 * bubbles as a plain circle, distinguished from each other by the
 * TAG LETTERS (PG, TI, FI, ...) rather than by shape. Registered as its
 * own symbol (separate `kind`/tagPrefix) so it seeds "PG-###" tags and
 * appears under its own palette entry, while sharing the same geometry
 * convention as instrument-circle.tsx.
 */
function InstrumentGaugePressureGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.thin;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle
        cx={width / 2}
        cy={height / 2}
        r={r}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const instrumentGaugePressure: SymbolDefinition = {
  kind: 'instrument-gauge-pressure',
  label: 'Pressure Gauge (PG)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'PG',
  ports: [
    { id: 'signal', label: 'Process Tap', x: 28, y: 56, direction: { x: 0, y: 1 }, kind: 'signal' },
  ],
  Geometry: InstrumentGaugePressureGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default instrumentGaugePressure;
