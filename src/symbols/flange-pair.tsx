import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE } from './style';

/** Flange pair marker — two short parallel lines perpendicular to flow, close together. */
function FlangePairGeometry({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const gap = 4;
  const lineH = height * 0.6;
  const yTop = (height - lineH) / 2;
  const yBottom = yTop + lineH;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={cx - gap / 2} y1={yTop} x2={cx - gap / 2} y2={yBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + gap / 2} y1={yTop} x2={cx + gap / 2} y2={yBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* centerline stubs: the flange pair is an INLINE fitting, so its
          ports sit at x=0/x=width on the pipe centerline. Without ink
          reaching those points the nozzles float in empty space. */}
      <line x1={0} y1={height / 2} x2={cx - gap / 2} y2={height / 2} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx + gap / 2} y1={height / 2} x2={width} y2={height / 2} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const flangePair: SymbolDefinition = {
  kind: 'flange-pair',
  label: 'Flange Pair',
  category: 'Piping Accessories',
  defaultWidth: 20,
  defaultHeight: 24,
  tagPrefix: 'FLG',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 12, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 20, y: 12, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: FlangePairGeometry,
  dexpi: { componentClass: 'FlangePair' },
};

export default flangePair;
