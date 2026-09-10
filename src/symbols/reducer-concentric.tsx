import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Concentric reducer — symmetric trapezoid, wide inlet edge tapering to narrow outlet edge. */
function ReducerConcentricGeometry({ width, height }: { width: number; height: number }) {
  const narrowH = height * 0.45;
  const yWideTop = 0;
  const yWideBottom = height;
  const yNarrowTop = (height - narrowH) / 2;
  const yNarrowBottom = yNarrowTop + narrowH;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 ${yWideTop} L ${width} ${yNarrowTop} L ${width} ${yNarrowBottom} L 0 ${yWideBottom} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const reducerConcentric: SymbolDefinition = {
  kind: 'reducer-concentric',
  label: 'Concentric Reducer',
  category: 'Piping Accessories',
  defaultWidth: 40,
  defaultHeight: 30,
  tagPrefix: 'RED',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 40, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ReducerConcentricGeometry,
  dexpi: { componentClass: 'ConcentricReducer' },
};

export default reducerConcentric;
