import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { buildOrthogonalPath, pointsToPath } from './orthogonalRouting';
import type { PipeEdgeData } from '../types/diagram';
import type { PortDirection } from '../symbols/types';

/**
 * Seamless pipe / signal-line edge.
 *
 * Unlike react-flow's built-in smoothstep/step edges (which ignore port
 * orientation and just route between two arbitrary points), this edge
 * reads each endpoint's declared port normal (stashed on edge.data at
 * connection time — see App.tsx onConnect) and builds an orthogonal path
 * whose terminal segments leave/arrive exactly along those normals, so
 * the pipe reads as physically continuous with the equipment nozzle.
 */
function PipeEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, data, selected, markerEnd } = props;
  const d = (data ?? {}) as Partial<PipeEdgeData> & {
    sourceDirection?: PortDirection;
    targetDirection?: PortDirection;
  };

  const sourceDirection: PortDirection = d.sourceDirection ?? { x: 1, y: 0 };
  // targetDirection is the port's outward normal; the pipe must *arrive*
  // travelling opposite to it, so we approach from the direction the
  // normal points away from (handled inside buildOrthogonalPath via the
  // stub-back calculation).
  const targetDirection: PortDirection = d.targetDirection ?? { x: -1, y: 0 };

  const points = buildOrthogonalPath(
    { x: sourceX, y: sourceY },
    sourceDirection,
    { x: targetX, y: targetY },
    targetDirection,
  );
  const path = pointsToPath(points);

  const isSignal = d.lineType === 'signal';
  const midIndex = Math.floor(points.length / 2);
  const mid = points[midIndex] ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#0066cc' : '#1a1a1a',
          strokeWidth: isSignal ? 1.25 : 2,
          strokeDasharray: isSignal ? '6 4' : undefined,
          fill: 'none',
        }}
      />
      {d.lineNumber ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              fontSize: 9,
              fontFamily: 'monospace',
              background: '#fff',
              padding: '0 3px',
              pointerEvents: 'none',
            }}
          >
            {d.lineNumber}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export default memo(PipeEdge);
