import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Jacketed reactor — vessel outline (dished caps, same style as
 * vessel-vertical.tsx) plus a SECOND parallel arc/line offset slightly
 * INWARD from the outer bounding box, tracking the vessel's curve for
 * roughly the lower half — indicating a half-pipe/jacket wrapped around
 * the shell (EN ISO 10628 half-pipe-reactor jacket convention). Kept
 * within the declared width/height viewBox (no extra margin) so port
 * coordinates (which are relative to width/height) line up exactly with
 * the rendered vessel body, same convention as every other symbol here.
 */
function ReactorJacketedGeometry({ width, height }: { width: number; height: number }) {
  const jacketMargin = width * 0.08;
  const vesselW = width - jacketMargin * 2;
  const vesselX = jacketMargin;
  const capH = Math.min(vesselW / 2, height * 0.18);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const jacketTop = bodyTop + (bodyBottom - bodyTop) * 0.45;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* vessel body, inset to leave room for the jacket outline */}
      <path
        d={`M ${vesselX} ${bodyTop}
            A ${vesselW / 2} ${capH} 0 0 1 ${vesselX + vesselW} ${bodyTop}
            L ${vesselX + vesselW} ${bodyBottom}
            A ${vesselW / 2} ${capH} 0 0 1 ${vesselX} ${bodyBottom}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {/* jacket outline: parallel offset arc/lines tracking the lower half of the shell */}
      <path
        d={`M 0 ${jacketTop}
            L 0 ${bodyBottom}
            A ${width / 2} ${capH} 0 0 0 ${width} ${bodyBottom}
            L ${width} ${jacketTop}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const reactorJacketed: SymbolDefinition = {
  kind: 'reactor-jacketed',
  label: 'Jacketed Reactor',
  category: 'Reactors',
  defaultWidth: 110,
  defaultHeight: 200,
  tagPrefix: 'R',
  ports: [
    { id: 'feed', label: 'Feed Inlet', x: 55, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'product', label: 'Product Outlet', x: 55, y: 200, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'jacket-in', label: 'Jacket Inlet', x: 0, y: 170, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'jacket-out', label: 'Jacket Outlet', x: 110, y: 130, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ReactorJacketedGeometry,
  dexpi: { componentClass: 'JacketedReactor' },
};

export default reactorJacketed;
