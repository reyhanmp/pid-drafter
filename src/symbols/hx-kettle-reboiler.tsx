import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Kettle reboiler — a tube-bundle shell with an ENLARGED, rounded kettle end
 * that is taller than the shell (the vapour-disengaging space). That size
 * difference is what distinguishes a kettle from a plain heat exchanger.
 *
 * Geometry note: the kettle end-cap is a half-ellipse whose chord runs the
 * full box height and whose apex lands exactly on x=width, so the `tube-out`
 * port sits on painted ink. Every other port is reached by an explicit stub
 * drawn from the shell body out to the declared port point — declared and
 * drawn geometry must be numerically identical, since react-flow re-measures
 * handles from the DOM and treats the declared box as an initial estimate only.
 */
function HxKettleReboilerGeometry({ width, height }: { width: number; height: number }) {
  const kettleW = width * 0.32;
  const shellX0 = 0;
  const shellX1 = width - kettleW;
  // shell is deliberately SHORTER than the kettle end, top and bottom
  const shellY0 = height * 0.19;
  const shellY1 = height * 0.81;
  const capR = Math.min(height * 0.08, shellX1 * 0.1);

  // kettle end: half-ellipse, centre on the chord, apex at x = width
  const kCx = shellX1;
  const kCy = height / 2;
  const kRx = kettleW;
  const kRy = height / 2;

  /** y of the kettle's upper outline at a given x (for drawing the vapour stub). */
  const kettleTopYAt = (x: number) => {
    const t = Math.max(-1, Math.min(1, (x - kCx) / kRx));
    return kCy - kRy * Math.sqrt(1 - t * t);
  };

  const tubeCount = 3;
  const vapourX = shellX1 + kettleW * 0.5;
  const vapourStubY = kettleTopYAt(vapourX);
  const liqInX = width * 0.3;
  const bottomsX = width * 0.6;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* shell body */}
      <rect
        x={shellX0}
        y={shellY0}
        width={shellX1 - shellX0}
        height={shellY1 - shellY0}
        rx={capR}
        ry={capR}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* tube bundle */}
      {Array.from({ length: tubeCount }).map((_, i) => {
        const y = shellY0 + ((shellY1 - shellY0) * (i + 1)) / (tubeCount + 1);
        return (
          <line key={i} x1={width * 0.06} y1={y} x2={shellX1 * 0.92} y2={y} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
        );
      })}
      {/* enlarged kettle end-cap */}
      <path
        d={`M ${shellX1} 0 A ${kRx} ${kRy} 0 0 1 ${shellX1} ${height} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* nozzle stubs out to the declared port points */}
      <line x1={0} y1={height / 2} x2={shellX0} y2={height / 2} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={vapourX} y1={0} x2={vapourX} y2={vapourStubY} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={liqInX} y1={shellY1} x2={liqInX} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={bottomsX} y1={shellY1} x2={bottomsX} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const hxKettleReboiler: SymbolDefinition = {
  kind: 'hx-kettle-reboiler',
  label: 'Kettle Reboiler',
  category: 'Heat Exchangers',
  defaultWidth: 150,
  defaultHeight: 70,
  tagPrefix: 'E',
  ports: [
    { id: 'tube-in', label: 'Tube-side Inlet', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'tube-out', label: 'Tube-side Outlet', x: 150, y: 35, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'vapour', label: 'Vapour Out', x: 125, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'liq-in', label: 'Liquid In', x: 45, y: 70, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'bottoms', label: 'Bottoms Out', x: 90, y: 70, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: HxKettleReboilerGeometry,
  dexpi: { componentClass: 'KettleReboiler' },
};

export default hxKettleReboiler;
