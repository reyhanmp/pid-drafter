import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Fixed-bed reactor — vessel with a catalyst bed shown as a hatched band
 * between two support grids, and a distinct top/bottom nozzle pair.
 */
function ReactorFixedBedGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.14);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const bedTop = bodyTop + (bodyBottom - bodyTop) * 0.22;
  const bedBottom = bodyTop + (bodyBottom - bodyTop) * 0.82;
  const hatchN = 9;
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
      {/* catalyst support grids */}
      <line x1={width * 0.1} y1={bedTop} x2={width * 0.9} y2={bedTop} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line
        x1={width * 0.1}
        y1={bedBottom}
        x2={width * 0.9}
        y2={bedBottom}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* catalyst bed hatching */}
      {Array.from({ length: hatchN }).map((_, i) => {
        const t = (i + 1) / (hatchN + 1);
        const y = bedTop + (bedBottom - bedTop) * t;
        return (
          <line
            key={i}
            x1={width * 0.1}
            y1={y}
            x2={width * 0.9}
            y2={y}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
            strokeDasharray="3 5"
          />
        );
      })}
    </svg>
  );
}

const reactorFixedBed: SymbolDefinition = {
  kind: 'reactor-fixed-bed',
  label: 'Fixed-Bed Reactor',
  category: 'Reactors',
  defaultWidth: 100,
  defaultHeight: 200,
  tagPrefix: 'R',
  ports: [
    { id: 'feed', label: 'Feed Inlet', x: 50, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'product', label: 'Product Outlet', x: 50, y: 200, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: ReactorFixedBedGeometry,
  dexpi: { componentClass: 'FixedBedReactor' },
};

export default reactorFixedBed;
