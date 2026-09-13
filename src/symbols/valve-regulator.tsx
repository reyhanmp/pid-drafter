import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Pressure regulator / self-actuated control valve — bowtie with a spring
 * bonnet glyph on top (zig-zag spring inside a bonnet outline).
 */
function ValveRegulatorGeometry({ width, height }: { width: number; height: number }) {
  const bowtieH = height * 0.45;
  const bowtieY = height - bowtieH;
  const midY = bowtieY + bowtieH / 2;
  const cx = width / 2;
  const bonnetH = bowtieY * 0.85;
  const bonnetW = width * 0.4;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M 0 ${bowtieY} L ${cx} ${midY} L 0 ${bowtieY + bowtieH} Z`} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <path
        d={`M ${width} ${bowtieY} L ${cx} ${midY} L ${width} ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <line x1={cx} y1={midY} x2={cx} y2={bonnetH} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* spring bonnet, top edge on y=0 */}
      <rect
        x={cx - bonnetW / 2}
        y={0}
        width={bonnetW}
        height={bonnetH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* spring zig-zag */}
      <polyline
        points={`${cx},${bonnetH * 0.15} ${cx - bonnetW * 0.28},${bonnetH * 0.35} ${cx + bonnetW * 0.28},${bonnetH * 0.55} ${cx - bonnetW * 0.28},${bonnetH * 0.75} ${cx},${bonnetH * 0.9}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const valveRegulator: SymbolDefinition = {
  kind: 'valve-regulator',
  label: 'Pressure Regulator',
  category: 'Valves',
  defaultWidth: 60,
  defaultHeight: 70,
  tagPrefix: 'PCV',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 54, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 60, y: 54, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'signal', label: 'Signal', x: 30, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: ValveRegulatorGeometry,
  dexpi: { componentClass: 'PressureRegulator' },
};

export default valveRegulator;
