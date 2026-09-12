import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * CSTR (continuous stirred-tank reactor) — vessel body (same dished-cap
 * outline style as vessel-vertical.tsx) topped with an agitator glyph
 * (motor block + shaft + impeller, reusing agitator.tsx's visual
 * language) composited directly onto the vessel top.
 */
function ReactorCstrGeometry({ width, height }: { width: number; height: number }) {
  const motorH = height * 0.14;
  const motorW = width * 0.4;
  const cx = width / 2;
  const vesselTop = motorH;
  const capH = Math.min(width / 2, (height - vesselTop) * 0.16);
  const bodyTop = vesselTop + capH;
  const bodyBottom = height - capH;
  const shaftBottom = height * 0.55;
  const bladeHalfW = width * 0.18;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* vessel body */}
      <path
        d={`M 0 ${bodyTop}
            A ${width / 2} ${capH} 0 0 1 ${width} ${bodyTop}
            L ${width} ${bodyBottom}
            A ${width / 2} ${capH} 0 0 1 0 ${bodyBottom}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {/* agitator motor block on top */}
      <rect
        x={cx - motorW / 2}
        y={0}
        width={motorW}
        height={motorH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* drive shaft down through the vessel top into the body */}
      <line x1={cx} y1={motorH} x2={cx} y2={shaftBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* impeller blade glyph */}
      <line x1={cx - bladeHalfW} y1={shaftBottom} x2={cx + bladeHalfW} y2={shaftBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx - bladeHalfW} y1={shaftBottom} x2={cx - bladeHalfW * 0.5} y2={shaftBottom + height * 0.06} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx + bladeHalfW} y1={shaftBottom} x2={cx + bladeHalfW * 0.5} y2={shaftBottom + height * 0.06} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const reactorCstr: SymbolDefinition = {
  kind: 'reactor-cstr',
  label: 'CSTR',
  category: 'Reactors',
  defaultWidth: 110,
  defaultHeight: 200,
  tagPrefix: 'R',
  ports: [
    { id: 'feed', label: 'Feed Inlet', x: 0, y: 150, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'product', label: 'Product Outlet', x: 55, y: 200, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'jacket-in', label: 'Jacket Inlet', x: 110, y: 130, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'jacket-out', label: 'Jacket Outlet', x: 110, y: 170, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ReactorCstrGeometry,
  dexpi: { componentClass: 'StirredTankReactor' },
};

export default reactorCstr;
