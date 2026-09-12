import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Double-pipe heat exchanger — two nested horizontal capsule outlines
 * (outer pipe/annulus + inner tube), both horizontal, per EN ISO 10628
 * double-pipe convention.
 * Port choice: 4 ports — inner-tube in/out (main process line, drawn on
 * the horizontal centerline) plus annulus-side in/out (drawn as short
 * top/bottom stubs), since a double-pipe exchanger's defining visual
 * feature is exactly this two-nested-circuit arrangement, unlike the
 * plate HX above which is normally drawn simplified to 2 ports.
 */
function HeatExchangerDoublePipeGeometry({ width, height }: { width: number; height: number }) {
  const outerCapW = Math.min(height / 2, width * 0.08);
  const innerMargin = height * 0.2;
  const innerH = height - innerMargin * 2;
  const innerCapW = Math.min(innerH / 2, width * 0.06);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* outer pipe/annulus shell */}
      <path
        d={`M ${outerCapW} 0
            L ${width - outerCapW} 0
            A ${outerCapW} ${height / 2} 0 0 1 ${width - outerCapW} ${height}
            L ${outerCapW} ${height}
            A ${outerCapW} ${height / 2} 0 0 1 ${outerCapW} 0
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* inner tube, nested */}
      <path
        d={`M ${innerCapW} ${innerMargin}
            L ${width - innerCapW} ${innerMargin}
            A ${innerCapW} ${innerH / 2} 0 0 1 ${width - innerCapW} ${innerMargin + innerH}
            L ${innerCapW} ${innerMargin + innerH}
            A ${innerCapW} ${innerH / 2} 0 0 1 ${innerCapW} ${innerMargin}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const heatExchangerDoublePipe: SymbolDefinition = {
  kind: 'heat-exchanger-double-pipe',
  label: 'Double-Pipe Heat Exchanger',
  category: 'Heat Exchangers',
  defaultWidth: 160,
  defaultHeight: 60,
  tagPrefix: 'E',
  ports: [
    { id: 'tube-in', label: 'Inner Tube Inlet', x: 0, y: 30, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'tube-out', label: 'Inner Tube Outlet', x: 160, y: 30, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'annulus-in', label: 'Annulus Inlet', x: 40, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'annulus-out', label: 'Annulus Outlet', x: 120, y: 60, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: HeatExchangerDoublePipeGeometry,
  dexpi: { componentClass: 'DoublePipeHeatExchanger' },
};

export default heatExchangerDoublePipe;
