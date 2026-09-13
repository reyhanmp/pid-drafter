import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Air-cooled heat exchanger — tube bundle with a fan circle beneath and a
 * motor block on top, per ISO 10628 air-cooler convention.
 */
function HxAirCoolerGeometry({ width, height }: { width: number; height: number }) {
  const bundleH = height * 0.42;
  const fanR = Math.min(width * 0.18, (height - bundleH) * 0.4);
  const fanCx = width / 2;
  const fanCy = bundleH + fanR + 2;
  const blades = 4;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* tube bundle */}
      <rect
        x={0}
        y={0}
        width={width}
        height={bundleH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {Array.from({ length: 3 }).map((_, i) => {
        const y = (bundleH * (i + 1)) / 4;
        return (
          <line key={i} x1={width * 0.06} y1={y} x2={width * 0.94} y2={y} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
        );
      })}
      {/* fan */}
      <circle cx={fanCx} cy={fanCy} r={fanR} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {Array.from({ length: blades }).map((_, i) => {
        const a = (i / blades) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={fanCx}
            y1={fanCy}
            x2={fanCx + Math.cos(a) * fanR}
            y2={fanCy + Math.sin(a) * fanR}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
          />
        );
      })}
    </svg>
  );
}

const hxAirCooler: SymbolDefinition = {
  kind: 'hx-air-cooler',
  label: 'Air-Cooled Heat Exchanger',
  category: 'Heat Exchangers',
  defaultWidth: 130,
  defaultHeight: 70,
  tagPrefix: 'E',
  ports: [
    { id: 'in', label: 'Process Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Process Outlet', x: 130, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: HxAirCoolerGeometry,
  dexpi: { componentClass: 'AirCooler' },
};

export default hxAirCooler;
