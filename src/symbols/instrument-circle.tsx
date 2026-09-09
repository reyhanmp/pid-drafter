import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Instrument bubble — CIRCLE variant, field-mounted device.
 * Per PRD section 6 ground truth: plain circle (no divider line), the
 * 2-letter function tag is stacked inside, the loop number is rendered
 * OUTSIDE/beside the circle by the node label layer, not inside it.
 */
function InstrumentCircleGeometry({ width, height }: { width: number; height: number }) {
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

const instrumentCircle: SymbolDefinition = {
  kind: 'instrument-circle',
  label: 'Instrument Bubble (Field)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'TI',
  ports: [
    { id: 'signal', label: 'Signal Leader', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: InstrumentCircleGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default instrumentCircle;
