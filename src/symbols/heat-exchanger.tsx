import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Shell-and-tube heat exchanger — rectangle shell with tube-bundle lines. */
function HeatExchangerGeometry({ width, height }: { width: number; height: number }) {
  const capR = height * 0.12;
  const tubeCount = 4;
  const tubeSpacing = (height - capR * 2) / (tubeCount + 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={capR}
        ry={capR}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {Array.from({ length: tubeCount }).map((_, i) => {
        const y = capR + tubeSpacing * (i + 1);
        return (
          <line
            key={i}
            x1={width * 0.08}
            y1={y}
            x2={width * 0.92}
            y2={y}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin * 0.75}
          />
        );
      })}
    </svg>
  );
}

const heatExchanger: SymbolDefinition = {
  kind: 'heat-exchanger',
  label: 'Heat Exchanger',
  category: 'Heat Exchangers',
  defaultWidth: 130,
  defaultHeight: 60,
  tagPrefix: 'E',
  ports: [
    { id: 'tube-in', label: 'Tube-side Inlet', x: 0, y: 45, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'tube-out', label: 'Tube-side Outlet', x: 130, y: 45, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'shell-in', label: 'Shell-side Inlet', x: 30, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'shell-out', label: 'Shell-side Outlet', x: 100, y: 60, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: HeatExchangerGeometry,
  dexpi: { componentClass: 'HeatExchanger' },
};

export default heatExchanger;
