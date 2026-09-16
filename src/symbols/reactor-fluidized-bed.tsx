import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Fluidized-bed reactor — vessel with a distributor plate at the base and
 * a dense-phase bed above it, plus a catalyst-circulation return nozzle.
 */
function ReactorFluidizedBedGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.14);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const distY = bodyBottom - (bodyBottom - bodyTop) * 0.18;
  const bedTop = bodyTop + (bodyBottom - bodyTop) * 0.3;
  const bubble = 5;
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
      {/* distributor plate */}
      <line x1={0} y1={distY} x2={width} y2={distY} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* dense bed top */}
      <line
        x1={width * 0.12}
        y1={bedTop}
        x2={width * 0.88}
        y2={bedTop}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
        strokeDasharray="6 4"
      />
      {/* bubbles in the dense phase */}
      {Array.from({ length: bubble }).map((_, i) => {
        const x = width * (0.22 + 0.14 * (i % 3));
        const y = bedTop + (distY - bedTop) * (0.25 + 0.22 * Math.floor(i / 3));
        return <circle key={i} cx={x} cy={y} r={width * 0.045} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />;
      })}
    </svg>
  );
}

const reactorFluidizedBed: SymbolDefinition = {
  kind: 'reactor-fluidized-bed',
  label: 'Fluidized-Bed Reactor',
  category: 'Reactors',
  defaultWidth: 110,
  defaultHeight: 190,
  tagPrefix: 'R',
  ports: [
    { id: 'feed', label: 'Feed Inlet', x: 55, y: 190, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'product', label: 'Overhead Outlet', x: 55, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'cat-return', label: 'Catalyst Return', x: 0, y: 95, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: ReactorFluidizedBedGeometry,
  dexpi: { componentClass: 'FluidizedBedReactor' },
};

export default reactorFluidizedBed;
