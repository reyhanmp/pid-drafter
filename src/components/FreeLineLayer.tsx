/**
 * Free-line overlay.
 *
 * Free lines (drawn by releasing a connection drag in empty space) are
 * stored as edges on the sheet, but they have NO node endpoints — and
 * react-flow edges require both a source and target handle. So they are
 * filtered out of what <ReactFlow> receives and drawn here instead, via
 * <ViewportPortal> so they share the canvas coordinate system (zoom and
 * pan apply exactly as they do to pipes).
 *
 * Styling is deliberately distinct from a port-connected process pipe:
 * thinner and dashed, so a sketched line can never be mistaken for a
 * validated process line at a glance.
 */
import { ViewportPortal } from '@xyflow/react';
import { useState } from 'react';
import { pointsToPath } from '../edges/orthogonalRouting';
import type { PipeEdgeData } from '../types/diagram';

interface FreeLine {
  id: string;
  data: PipeEdgeData;
}

interface FreeLineLayerProps {
  lines: FreeLine[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

function FreeLineLayer({ lines, selectedId, onSelect, onDelete }: FreeLineLayerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <ViewportPortal>
      {/* This SVG spans a large area rather than the exact content bounds.
          A 1x1 SVG with overflow:visible PAINTS outside its box but does
          not reliably HIT-TEST outside it, so clicks on a free line were
          silently dropped (verified: the hit-target path existed with
          pointer-events:stroke, yet clicking its midpoint selected
          nothing). Flow coordinates can be negative, so the origin is
          offset into the middle of the canvas. */}
      <svg
        style={{
          position: 'absolute',
          left: -50000,
          top: -50000,
          width: 100000,
          height: 100000,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <g transform="translate(50000, 50000)">
        {lines.map((line) => {
          const start = line.data.freeStart;
          const end = line.data.freeEnd;
          if (!start || !end) return null;

          const d = pointsToPath([start, end]);
          const isSelected = selectedId === line.id;
          const isHovered = hoveredId === line.id;

          return (
            <g key={line.id} data-testid={`free-line-${line.id}`}>
              {/* wide invisible hit-target so a 1px line is still clickable.
                  `nodrag nopan` are React Flow's own escape-hatch classes:
                  without them the pane's d3-drag captures the mousedown on
                  the capture phase and the click never reaches our handler
                  (same class of failure documented in EquipmentNode.tsx for
                  the nozzle-reposition drag). Verified: elementFromPoint
                  correctly returned this path while onClick still never
                  fired. */}
              <path
                className="nodrag nopan"
                d={d}
                stroke="transparent"
                strokeWidth={12}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredId(line.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(line.id);
                }}
              />
              <path
                d={d}
                fill="none"
                stroke={isSelected || isHovered ? '#0066cc' : '#6b7280'}
                strokeWidth={isSelected ? 1.75 : 1.25}
                strokeDasharray="5 4"
                style={{ pointerEvents: 'none' }}
              />
              {(isSelected || isHovered) && (
                <g
                  className="nodrag nopan"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(line.id);
                    onSelect(null);
                  }}
                  data-testid={`free-line-delete-${line.id}`}
                >
                  <circle
                    cx={(start.x + end.x) / 2}
                    cy={(start.y + end.y) / 2}
                    r={7}
                    fill="#fff"
                    stroke="#0066cc"
                    strokeWidth={1}
                  />
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 + 3.5}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="monospace"
                    fill="#0066cc"
                  >
                    ×
                  </text>
                </g>
              )}
            </g>
          );
        })}
        </g>
      </svg>
    </ViewportPortal>
  );
}

export default FreeLineLayer;
