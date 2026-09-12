import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Tray (plate) distillation column — same dished-cap vessel outline as
 * vessel-vertical.tsx, with 5-7 evenly-spaced horizontal dashed lines in
 * the middle ~70% of the vessel height representing trays, each line
 * spanning ~15%-85% of the vessel width (EN ISO 10628 column convention).
 */
function ColumnTrayGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.18);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const trayZoneTop = bodyTop + (bodyBottom - bodyTop) * 0.15;
  const trayZoneBottom = bodyTop + (bodyBottom - bodyTop) * 0.85;
  const trayCount = 6;
  const trayX1 = width * 0.15;
  const trayX2 = width * 0.85;

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
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {Array.from({ length: trayCount }).map((_, i) => {
        const y = trayZoneTop + ((trayZoneBottom - trayZoneTop) * (i + 1)) / (trayCount + 1);
        return (
          <line
            key={i}
            x1={trayX1}
            y1={y}
            x2={trayX2}
            y2={y}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
            strokeDasharray="4 3"
          />
        );
      })}
    </svg>
  );
}

const columnTray: SymbolDefinition = {
  kind: 'column-tray',
  label: 'Tray Column',
  category: 'Columns',
  defaultWidth: 100,
  defaultHeight: 260,
  tagPrefix: 'C',
  ports: [
    { id: 'overhead', label: 'Overhead Outlet', x: 50, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'bottoms', label: 'Bottoms Outlet', x: 50, y: 260, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'feed-upper', label: 'Feed (Upper)', x: 0, y: 90, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'feed-lower', label: 'Feed (Lower)', x: 100, y: 180, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ColumnTrayGeometry,
  dexpi: { componentClass: 'Column' },
};

export default columnTray;
