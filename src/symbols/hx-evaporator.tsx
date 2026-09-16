import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Evaporator — vessel with a calandria (tube bundle) in the lower section
 * and an enlarged vapour space above it.
 */
function HxEvaporatorGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.1);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const calTop = bodyTop + (bodyBottom - bodyTop) * 0.5;
  const tubeCount = 3;
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
      {/* calandria tube bundle */}
      <line x1={width * 0.12} y1={calTop} x2={width * 0.88} y2={calTop} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line
        x1={width * 0.12}
        y1={bodyBottom}
        x2={width * 0.88}
        y2={bodyBottom}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {Array.from({ length: tubeCount }).map((_, i) => {
        const x = width * (0.25 + 0.25 * i);
        return (
          <line key={i} x1={x} y1={calTop} x2={x} y2={bodyBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
        );
      })}
      {/* entrainment separator above the calandria */}
      <line
        x1={width * 0.15}
        y1={bodyTop + capH * 0.8}
        x2={width * 0.85}
        y2={bodyTop + capH * 0.8}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
        strokeDasharray="5 4"
      />
    </svg>
  );
}

const hxEvaporator: SymbolDefinition = {
  kind: 'hx-evaporator',
  label: 'Evaporator',
  category: 'Heat Exchangers',
  defaultWidth: 110,
  defaultHeight: 180,
  tagPrefix: 'E',
  ports: [
    { id: 'feed', label: 'Feed In', x: 0, y: 140, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'steam-in', label: 'Steam In', x: 110, y: 125, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'cond-out', label: 'Condensate Out', x: 110, y: 160, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'vapour', label: 'Vapour Out', x: 55, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'concentrate', label: 'Concentrate Out', x: 55, y: 180, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: HxEvaporatorGeometry,
  dexpi: { componentClass: 'Evaporator' },
};

export default hxEvaporator;
