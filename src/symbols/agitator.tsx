import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Agitator — vessel-mounted mixer: motor block + shaft + blade glyph. */
function AgitatorGeometry({ width, height }: { width: number; height: number }) {
  const motorW = width * 0.6;
  const motorH = height * 0.28;
  const cx = width / 2;
  const shaftBottom = height - height * 0.12;
  const bladeY = shaftBottom - height * 0.16;
  const bladeHalfW = width * 0.22;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* motor block */}
      <rect
        x={cx - motorW / 2}
        y={0}
        width={motorW}
        height={motorH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* drive shaft */}
      <line x1={cx} y1={motorH} x2={cx} y2={shaftBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* impeller blade glyph */}
      <line
        x1={cx - bladeHalfW}
        y1={bladeY}
        x2={cx + bladeHalfW}
        y2={bladeY}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <line
        x1={cx - bladeHalfW}
        y1={bladeY}
        x2={cx - bladeHalfW * 0.5}
        y2={bladeY + height * 0.08}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <line
        x1={cx + bladeHalfW}
        y1={bladeY}
        x2={cx + bladeHalfW * 0.5}
        y2={bladeY + height * 0.08}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const agitator: SymbolDefinition = {
  kind: 'agitator',
  label: 'Agitator',
  category: 'Agitators',
  defaultWidth: 50,
  defaultHeight: 110,
  tagPrefix: 'M',
  ports: [
    { id: 'mount', label: 'Vessel Mount', x: 25, y: 110, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: AgitatorGeometry,
  dexpi: { componentClass: 'Agitator' },
};

export default agitator;
