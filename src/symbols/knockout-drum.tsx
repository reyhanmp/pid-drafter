import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Knock-out drum — dished-cap vertical drum with a demister pad near the
 * top. Vapour leaves overhead, liquid drops out the bottom.
 */
function KnockoutDrumGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.18);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const meshTop = bodyTop + capH * 0.5;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 ${bodyTop}
            A ${width / 2} ${capH} 0 0 1 ${width} ${bodyTop}
            L ${width} ${bodyBottom}
            A ${width / 2} ${capH} 0 0 1 0 ${bodyBottom}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.equipment}
      />
      {/* demister pad */}
      <line x1={width * 0.14} y1={meshTop} x2={width * 0.86} y2={meshTop} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line
        x1={width * 0.14}
        y1={meshTop + 7}
        x2={width * 0.86}
        y2={meshTop + 7}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const knockoutDrum: SymbolDefinition = {
  kind: 'knockout-drum',
  label: 'Knock-out Drum',
  category: 'Vessels',
  defaultWidth: 90,
  defaultHeight: 150,
  tagPrefix: 'D',
  ports: [
    { id: 'vapour', label: 'Vapour Outlet', x: 45, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'liquid', label: 'Liquid Outlet', x: 45, y: 150, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'inlet', label: 'Inlet', x: 0, y: 100, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: KnockoutDrumGeometry,
  dexpi: { componentClass: 'KnockOutDrum' },
};

export default knockoutDrum;
