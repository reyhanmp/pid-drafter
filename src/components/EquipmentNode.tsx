import { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { symbolsByKind } from '../symbols';
import { getEffectivePorts } from '../symbols/effectivePorts';
import type { PortDirection } from '../symbols/types';
import type { EquipmentNodeData } from '../types/diagram';

/** Map a port's directional normal to react-flow's Handle Position enum. */
function directionToPosition(dir: PortDirection): Position {
  if (Math.abs(dir.x) > Math.abs(dir.y)) {
    return dir.x < 0 ? Position.Left : Position.Right;
  }
  return dir.y < 0 ? Position.Top : Position.Bottom;
}

/**
 * Generic equipment node renderer — draws whichever symbol geometry the
 * node's `kind` resolves to, plus one react-flow Handle per declared
 * port (positioned exactly at the port's coordinates so pipes appear to
 * originate from the real nozzle, not a corner of a bounding box).
 */
function EquipmentNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as EquipmentNodeData;
  const symbol = symbolsByKind[d.kind];
  const ports = symbol ? getEffectivePorts(d.kind, d.ports) : [];
  const updateNodeInternals = useUpdateNodeInternals();

  // React Flow caches each node's handle bounds internally and only
  // recomputes them on mount / explicit invalidation. When a node's
  // ports change at runtime (nozzle added/removed/repositioned via the
  // data sheet panel), the new/changed Handles render in the DOM fine
  // but connection-dragging silently ignores them until we tell React
  // Flow to re-measure - hence this effect, keyed on the actual port
  // identity (id+position+direction), not just array reference.
  const portsKey = ports.map((p) => `${p.id}:${p.x},${p.y}:${p.direction.x},${p.direction.y}`).join('|');
  useEffect(() => {
    // A single updateNodeInternals() call can lose a race against React
    // Flow's own node-adoption pass (which can reset a node's cached
    // handleBounds to stale/undefined right after our data update).
    // Deferring past the next paint, then nudging again shortly after,
    // reliably lands after that pass settles - this is the standard
    // workaround for dynamically-changing Handle sets in React Flow.
    const raf = requestAnimationFrame(() => updateNodeInternals(id));
    const timeout = setTimeout(() => updateNodeInternals(id), 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [id, portsKey, updateNodeInternals]);

  if (!symbol) {
    return <div style={{ color: 'red', fontSize: 10 }}>Unknown symbol: {d.kind}</div>;
  }
  const { Geometry, label } = symbol;
  const width = d.width ?? symbol.defaultWidth;
  const height = d.height ?? symbol.defaultHeight;

  return (
    <div
      style={{ width, height, position: 'relative' }}
      title={label}
      data-testid={`equipment-node-${symbol.kind}`}
    >
      <Geometry width={width} height={height} selected={selected} />
      {ports.map((port) => {
        const pos = directionToPosition(port.direction);
        return (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={pos}
            isConnectableStart
            isConnectableEnd
            style={{
              left: port.x,
              top: port.y,
              transform: 'translate(-50%, -50%)',
              width: 8,
              height: 8,
              background: port.kind === 'signal' ? '#888' : '#1a1a1a',
              border: '1px solid #fff',
            }}
            title={port.label}
          />
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
