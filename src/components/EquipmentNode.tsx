import { memo, useCallback, useRef } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { symbolsByKind } from '../symbols';
import { getRenderedPorts, normalizeRotation } from '../symbols/effectivePorts';
import type { PortDirection } from '../symbols/types';
import type { EquipmentNodeData } from '../types/diagram';

/** Map a port's directional normal to react-flow's Handle Position enum. */
function directionToPosition(dir: PortDirection): Position {
  if (Math.abs(dir.x) > Math.abs(dir.y)) {
    return dir.x < 0 ? Position.Left : Position.Right;
  }
  return dir.y < 0 ? Position.Top : Position.Bottom;
}

/** Length of the flange stub drawn outward from the port point, in px. */
const STUB_LENGTH = 9;
/** Half-length of the perpendicular flange-face tick at the stub's outer end. */
const FLANGE_TICK_HALF = 5;

/**
 * Snap a local (unrotated) drag point to whichever of the 4 bounding-box
 * edges it's nearest to, returning the port's new on-edge x/y plus the
 * outward direction normal for that edge. Mirrors the same "ports live on
 * the unrotated bounding box" convention as getEffectivePorts/rotatePorts.
 */
function snapToNearestEdge(x: number, y: number, width: number, height: number): { x: number; y: number; direction: PortDirection } {
  const distLeft = x;
  const distRight = width - x;
  const distTop = y;
  const distBottom = height - y;
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  const clampedY = Math.max(0, Math.min(height, y));
  const clampedX = Math.max(0, Math.min(width, x));

  if (min === distLeft) return { x: 0, y: clampedY, direction: { x: -1, y: 0 } };
  if (min === distRight) return { x: width, y: clampedY, direction: { x: 1, y: 0 } };
  if (min === distTop) return { x: clampedX, y: 0, direction: { x: 0, y: -1 } };
  return { x: clampedX, y: height, direction: { x: 0, y: 1 } };
}

/** Rotate a point by -angle degrees (clockwise convention) around a box center — the inverse of rotatePorts.ts's forward rotation, used to map a mouse position on the (visually rotated) node back into the symbol's UNROTATED local coordinate frame before edge-snapping. */
function inverseRotatePoint(x: number, y: number, angle: number, width: number, height: number): { x: number; y: number } {
  if (angle === 0) return { x, y };
  const cx = width / 2;
  const cy = height / 2;
  const rad = (-angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = x - cx;
  const ly = y - cy;
  return {
    x: cx + (lx * cos - ly * sin),
    y: cy + (lx * sin + ly * cos),
  };
}

/**
 * Generic equipment node renderer — draws whichever symbol geometry the
 * node's `kind` resolves to, plus one react-flow Handle per declared
 * port (positioned exactly at the port's coordinates so pipes appear to
 * originate from the real nozzle, not a corner of a bounding box).
 *
 * Rotation: the Geometry SVG gets a CSS `rotate()` transform around the
 * box center. Handles/flange-glyphs do NOT get that same CSS transform —
 * their x/y/direction already come out of getRenderedPorts() PRE-rotated
 * (rotatePorts.ts applies the identical center-pivot rotation to the port
 * math), so applying the CSS transform to them too would double-rotate.
 * Only the Geometry gets the transform; ports render at their already-
 * rotated coordinates directly.
 */
function EquipmentNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as EquipmentNodeData;
  const symbol = symbolsByKind[d.kind];
  const { screenToFlowPosition } = useReactFlow();
  const dragState = useRef<{ portId: string } | null>(null);

  const width = d.width ?? symbol?.defaultWidth ?? 0;
  const height = d.height ?? symbol?.defaultHeight ?? 0;
  const rotation = normalizeRotation(d.rotation);
  const ports = symbol ? getRenderedPorts(d.kind, d.ports, d.rotation, width, height) : [];

  /**
   * Manual nozzle-reposition drag, kept entirely separate from React
   * Flow's own connection-drag system. React Flow starts a CONNECTION
   * drag from a mousedown that lands on the <Handle> element itself; our
   * reposition drag instead starts from mousedown on the flange-STUB
   * <div> we render as a sibling next to (and slightly larger/offset
   * from) the Handle — see the `flange-stub` element below. As long as
   * the user's mousedown lands on the stub graphic rather than the small
   * Handle dot at its base, this reads as "grab the pipe stub to move
   * the nozzle" vs "grab the connector dot to draw a pipe" — a
   * reasonable, if not pixel-perfect, split documented here per the task
   * spec. Listeners are attached to `document` for move/up so the drag
   * keeps tracking even if the pointer leaves the small stub hitbox.
   */
  const beginNozzleDrag = useCallback(
    (portId: string) => (evt: React.MouseEvent) => {
      if (!selected) return; // only allow repositioning while the node is selected
      evt.stopPropagation();
      evt.preventDefault();
      dragState.current = { portId };

      const onMouseMove = (moveEvt: MouseEvent) => {
        if (!dragState.current) return;
        const flowPoint = screenToFlowPosition({ x: moveEvt.clientX, y: moveEvt.clientY });
        // node.position isn't available here directly; use the node's
        // DOM element bounding box via data-testid lookup is fragile, so
        // instead we rely on React Flow's own node-relative measurement:
        // screenToFlowPosition gives canvas coords, and we need node-local
        // coords. We look up the node element for its current flow position.
        const nodeEl = document.querySelector<HTMLElement>(`[data-id="${id}"]`);
        if (!nodeEl) return;
        const nodeRect = nodeEl.getBoundingClientRect();
        // Convert the raw mouse position into node-local pixel coordinates
        // (accounting for canvas zoom via the ratio of the DOM rect vs
        // declared width/height), then inverse-rotate into the symbol's
        // unrotated local frame before snapping.
        const zoomX = nodeRect.width / width || 1;
        const zoomY = nodeRect.height / height || 1;
        const localX = (moveEvt.clientX - nodeRect.left) / zoomX;
        const localY = (moveEvt.clientY - nodeRect.top) / zoomY;
        void flowPoint; // flowPoint unused beyond this local-rect approach; kept for clarity/debuggability
        const unrotated = inverseRotatePoint(localX, localY, rotation, width, height);
        const snapped = snapToNearestEdge(unrotated.x, unrotated.y, width, height);

        const updateNodeData = (d as unknown as { __updateNodeData?: (nodeId: string, patch: Partial<EquipmentNodeData>) => void }).__updateNodeData;
        if (!updateNodeData || !symbol) return;
        const baseInstancePorts = d.ports ?? symbol.ports;
        const nextPorts = baseInstancePorts.map((p) =>
          p.id === dragState.current?.portId ? { ...p, x: snapped.x, y: snapped.y, direction: snapped.direction } : p,
        );
        updateNodeData(id, { ports: nextPorts });
      };

      const onMouseUp = () => {
        dragState.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [id, d, symbol, selected, rotation, width, height, screenToFlowPosition],
  );

  if (!symbol) {
    return <div style={{ color: 'red', fontSize: 10 }}>Unknown symbol: {d.kind}</div>;
  }
  const { Geometry, label } = symbol;

  return (
    <div
      style={{ width, height, position: 'relative' }}
      title={label}
      data-testid={`equipment-node-${symbol.kind}`}
    >
      {d.__loopHighlight && (
        <div
          data-testid="loop-highlight-ring"
          style={{
            position: 'absolute',
            inset: -8,
            border: '2px dashed #cc8800',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          width,
          height,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
        }}
        data-testid="equipment-geometry-wrapper"
      >
        <Geometry width={width} height={height} selected={selected} />
      </div>
      {ports.map((port) => {
        const pos = directionToPosition(port.direction);
        // Flange stub: a short line extending outward from the port point
        // along its direction normal, capped with a perpendicular tick
        // representing the flange face. Rendered as plain absolutely
        // positioned SVG, NOT rotated again (port.x/y/direction are
        // already the rendered/rotated values from getRenderedPorts).
        const stubX2 = port.direction.x * STUB_LENGTH;
        const stubY2 = port.direction.y * STUB_LENGTH;
        // perpendicular unit vector for the flange tick
        const perpX = -port.direction.y;
        const perpY = port.direction.x;
        const svgSize = (STUB_LENGTH + FLANGE_TICK_HALF) * 2 + 4;
        const svgCenter = svgSize / 2;
        return (
          <div key={port.id} style={{ position: 'absolute', left: port.x, top: port.y, transform: 'translate(-50%, -50%)' }}>
            {/* Flange stub + tick glyph — this is the DRAG hit-target for
                nozzle repositioning (see beginNozzleDrag doc comment). */}
            <svg
              width={svgSize}
              height={svgSize}
              // `nodrag` is React Flow's own escape-hatch class: without it,
              // React Flow's internal d3-drag listener (which starts a NODE
              // drag on ANY mousedown within the node, in the capture phase)
              // consumes the mousedown before it ever reaches our own
              // onMouseDown below - the handler silently never fires. This
              // class is required for the nozzle-reposition drag to work at
              // all; found via a real repro where calling onMouseDown
              // directly (bypassing the DOM) worked perfectly, but a real
              // click/dispatchEvent never invoked it.
              className="nodrag"
              style={{
                position: 'absolute',
                left: -svgCenter,
                top: -svgCenter,
                pointerEvents: selected ? 'auto' : 'none',
                cursor: selected ? 'move' : 'default',
              }}
              onMouseDown={beginNozzleDrag(port.id)}
              data-testid={`nozzle-flange-${port.id}`}
            >
              <line
                x1={svgCenter}
                y1={svgCenter}
                x2={svgCenter + stubX2}
                y2={svgCenter + stubY2}
                stroke="#1a1a1a"
                strokeWidth={2}
              />
              <line
                x1={svgCenter + stubX2 - perpX * FLANGE_TICK_HALF}
                y1={svgCenter + stubY2 - perpY * FLANGE_TICK_HALF}
                x2={svgCenter + stubX2 + perpX * FLANGE_TICK_HALF}
                y2={svgCenter + stubY2 + perpY * FLANGE_TICK_HALF}
                stroke="#1a1a1a"
                strokeWidth={2}
              />
            </svg>
            {/* Real connection Handle — small dot at the port base where
                the flange meets the equipment boundary. Its own
                mousedown/connect behavior is untouched by React Flow. */}
            <Handle
              id={port.id}
              type="source"
              position={pos}
              isConnectableStart
              isConnectableEnd
              style={{
                position: 'relative',
                left: 0,
                top: 0,
                transform: 'none',
                width: 6,
                height: 6,
                background: port.kind === 'signal' ? '#888' : '#1a1a1a',
                border: '1px solid #fff',
              }}
              title={port.label}
            />
          </div>
        );
      })}
      {/* Tag label, above the symbol */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -18,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#1a1a1a',
        }}
      >
        {d.tag}
        {d.loopNumber ? <span style={{ fontWeight: 400 }}> / {d.loopNumber}</span> : null}
      </div>
    </div>
  );
}

export default memo(EquipmentNode);
