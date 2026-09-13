import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Complete distillation column — shell with trays, PLUS its overhead
 * condenser and bottoms reboiler as part of the same assembly, so one
 * palette drop yields a working column (PRD 4.2).
 *
 * Geometry note: the condenser/reboiler are drawn INSIDE the bounding box
 * and every port is declared on painted ink. The column shell is inset
 * from the box edges (x 0..width) with the accessories below, so the
 * box is taller than the shell alone.
 */
function ColumnCompleteGeometry({ width, height }: { width: number; height: number }) {
  const shellW = width * 0.55;
  const shellX = (width - shellW) / 2;
  const capH = Math.min(shellW / 2, height * 0.13);
  const shellTop = capH;
  const shellBottom = height * 0.72 - capH;
  const trayZoneTop = shellTop + (shellBottom - shellTop) * 0.2;
  const trayZoneBottom = shellTop + (shellBottom - shellTop) * 0.85;
  const trayCount = 6;
  // condenser (top-left of the accessory band) and reboiler (bottom)
  const condH = height * 0.1;
  const condY = height * 0.74;
  const condW = width * 0.42;
  const reboilerY = height * 0.87;
  const reboilerW = width * 0.5;
  const reboilerX = (width - reboilerW) / 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* column shell */}
      <path
        d={`M ${shellX} ${shellTop}
            A ${shellW / 2} ${capH} 0 0 1 ${shellX + shellW} ${shellTop}
            L ${shellX + shellW} ${shellBottom}
            A ${shellW / 2} ${capH} 0 0 1 ${shellX} ${shellBottom}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {Array.from({ length: trayCount }).map((_, i) => {
        const y = trayZoneTop + ((trayZoneBottom - trayZoneTop) * (i + 1)) / (trayCount + 1);
        return (
          <line
            key={i}
            x1={shellX + shellW * 0.16}
            y1={y}
            x2={shellX + shellW * 0.84}
            y2={y}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
            strokeDasharray="4 3"
          />
        );
      })}
      {/* overhead condenser body */}
      <rect
        x={shellX}
        y={condY}
        width={condW}
        height={condH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* condenser tie-back to the column top */}
      <line x1={shellX + condW / 2} y1={condY} x2={shellX + condW / 2} y2={shellTop} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* reboiler body — extends to the box bottom so the `bottoms` port,
          which is declared on y=height, lands on painted ink */}
      <rect
        x={reboilerX}
        y={reboilerY}
        width={reboilerW}
        height={height - reboilerY}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* reboiler tie-back to the column base */}
      <line
        x1={shellX + shellW / 2}
        y1={shellBottom}
        x2={shellX + shellW / 2}
        y2={reboilerY}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const columnComplete: SymbolDefinition = {
  kind: 'column-complete',
  label: 'Distillation Column (w/ Condenser + Reboiler)',
  category: 'Columns',
  defaultWidth: 140,
  defaultHeight: 300,
  tagPrefix: 'C',
  ports: [
    { id: 'feed', label: 'Feed', x: 32, y: 150, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'bottoms', label: 'Bottoms', x: 70, y: 300, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'reflux', label: 'Reflux Return', x: 108, y: 150, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'condensate', label: 'Condensate Out', x: 32, y: 222, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'reb-in', label: 'Reboiler In', x: 35, y: 276, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: ColumnCompleteGeometry,
  dexpi: { componentClass: 'Column' },
};

export default columnComplete;
