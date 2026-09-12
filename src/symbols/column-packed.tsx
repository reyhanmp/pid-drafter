import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Packed / fluid-contacting column — same dished-cap vessel outline as
 * column-tray.tsx, but the middle ~70% zone is filled with a diagonal
 * cross-hatch packing indication instead of discrete tray lines
 * (EN ISO 10628 convention distinguishing packed from tray internals).
 */
function ColumnPackedGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.18);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  const packZoneTop = bodyTop + (bodyBottom - bodyTop) * 0.15;
  const packZoneBottom = bodyTop + (bodyBottom - bodyTop) * 0.85;
  const packX1 = width * 0.12;
  const packX2 = width * 0.88;
  const hatchSpacing = 14;
  const hatches: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  // diagonal cross-hatch spanning the packing zone
  for (let y = packZoneTop; y < packZoneBottom + (packX2 - packX1); y += hatchSpacing) {
    const x1 = packX1;
    const y1 = y;
    const diag = Math.min(packX2 - packX1, packZoneBottom - y1);
    if (diag <= 0) continue;
    hatches.push({ x1, y1, x2: x1 + diag, y2: y1 + diag });
  }

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
      {/* packing zone boundary lines (thin, marks where packed bed sits) */}
      <line x1={packX1} y1={packZoneTop} x2={packX2} y2={packZoneTop} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={packX1} y1={packZoneBottom} x2={packX2} y2={packZoneBottom} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {hatches.map((h, i) => (
        <line key={i} x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} stroke={STROKE} strokeWidth={0.75} />
      ))}
    </svg>
  );
}

const columnPacked: SymbolDefinition = {
  kind: 'column-packed',
  label: 'Packed Column',
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
  Geometry: ColumnPackedGeometry,
  dexpi: { componentClass: 'Column' },
};

export default columnPacked;
