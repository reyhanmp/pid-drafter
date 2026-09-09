import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { symbolsByKind } from '../symbols';
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
function EquipmentNode({ data, selected }: NodeProps) {
  const d = data as unknown as EquipmentNodeData;
  const symbol = symbolsByKind[d.kind];
  if (!symbol) {
    return <div style={{ color: 'red', fontSize: 10 }}>Unknown symbol: {d.kind}</div>;
  }
  const { Geometry, ports, label } = symbol;
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
