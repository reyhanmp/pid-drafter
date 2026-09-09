import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Instrument bubble — SQUARE variant, DCS/logic/shared-display function. */
function InstrumentSquareGeometry({ width, height }: { width: number; height: number }) {
  const inset = LINE_WEIGHT.thin;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={inset}
        y={inset}
        width={width - inset * 2}
        height={height - inset * 2}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const instrumentSquare: SymbolDefinition = {
  kind: 'instrument-square',
  label: 'Instrument Bubble (DCS)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'TIC',
  ports: [
    { id: 'signal', label: 'Signal Leader', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: InstrumentSquareGeometry,
  dexpi: { componentClass: 'DcsFunction' },
};

export default instrumentSquare;
