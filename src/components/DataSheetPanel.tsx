import type { SymbolPort, PortDirection } from '../symbols/types';
import { symbolsByKind } from '../symbols';
import { getEffectivePorts } from '../symbols/effectivePorts';
import { fieldsForCategory } from '../dataSheet/fieldSchemas';
import type { EquipmentNodeData } from '../types/diagram';

const CARDINAL_DIRECTIONS: Array<{ label: string; dir: PortDirection }> = [
  { label: '↑ Up', dir: { x: 0, y: -1 } },
  { label: '↓ Down', dir: { x: 0, y: 1 } },
  { label: '← Left', dir: { x: -1, y: 0 } },
  { label: '→ Right', dir: { x: 1, y: 0 } },
];

function directionLabel(dir: PortDirection): string {
  const match = CARDINAL_DIRECTIONS.find((c) => c.dir.x === dir.x && c.dir.y === dir.y);
  return match?.label ?? `(${dir.x}, ${dir.y})`;
}

/** Pick a reasonable default position/direction for a newly added nozzle. */
function nextDefaultPort(existing: SymbolPort[], width: number, height: number): SymbolPort {
  let id = `nozzle-${existing.length + 1}`;
  let n = existing.length + 1;
  while (existing.some((p) => p.id === id)) {
    n += 1;
    id = `nozzle-${n}`;
  }

  const usedSides = new Set(existing.map((p) => directionLabel(p.direction)));
  const freeSide = CARDINAL_DIRECTIONS.find((c) => !usedSides.has(c.label));

  if (freeSide) {
    const { dir } = freeSide;
    const x = dir.x !== 0 ? (dir.x < 0 ? 0 : width) : width / 2;
    const y = dir.y !== 0 ? (dir.y < 0 ? 0 : height) : height / 2;
    return { id, label: `Nozzle ${n}`, x, y, direction: dir, kind: 'process' };
  }

  // Every side already has at least one nozzle — pick the side with the
  // fewest existing ports and offset along it so the new nozzle doesn't
  // land exactly on top of an existing one.
  const countsBySide = new Map(CARDINAL_DIRECTIONS.map((c) => [c.label, 0]));
  for (const p of existing) {
    const lbl = directionLabel(p.direction);
    countsBySide.set(lbl, (countsBySide.get(lbl) ?? 0) + 1);
  }
  const leastUsed = CARDINAL_DIRECTIONS.reduce((a, b) =>
    (countsBySide.get(a.label) ?? 0) <= (countsBySide.get(b.label) ?? 0) ? a : b,
  );
  const { dir } = leastUsed;
  const offsetIndex = countsBySide.get(leastUsed.label) ?? 0;
  const offset = 20 * (offsetIndex + 1);
  let x = width / 2;
  let y = height / 2;
  if (dir.x !== 0) {
    x = dir.x < 0 ? 0 : width;
    y = Math.min(height - 8, offset);
  } else {
    y = dir.y < 0 ? 0 : height;
    x = Math.min(width - 8, offset);
  }
  return { id, label: `Nozzle ${n}`, x, y, direction: dir, kind: 'process' };
}

interface DataSheetPanelProps {
  nodeId: string;
  data: EquipmentNodeData;
  /** Ids of ports on this node that currently have a pipe attached. */
  connectedPortIds: Set<string>;
  onUpdateData: (nodeId: string, patch: Partial<EquipmentNodeData>) => void;
  onClose: () => void;
}

export default function DataSheetPanel({ nodeId, data, connectedPortIds, onUpdateData, onClose }: DataSheetPanelProps) {
  const symbol = symbolsByKind[data.kind];
  if (!symbol) return null;
  const ports = getEffectivePorts(data.kind, data.ports);
  const fields = fieldsForCategory(symbol.category);
  const properties = data.properties ?? {};

  function setPorts(next: SymbolPort[]) {
    onUpdateData(nodeId, { ports: next });
  }

  function updatePort(portId: string, patch: Partial<SymbolPort>) {
    setPorts(ports.map((p) => (p.id === portId ? { ...p, ...patch } : p)));
  }

  function addPort() {
    const newPort = nextDefaultPort(ports, data.width, data.height);
    setPorts([...ports, newPort]);
  }

  function removePort(portId: string) {
    if (connectedPortIds.has(portId)) {
      window.alert('Disconnect the pipe from this nozzle first.');
      return;
    }
    setPorts(ports.filter((p) => p.id !== portId));
  }

  function setProperty(fieldId: string, value: string) {
    onUpdateData(nodeId, { properties: { ...properties, [fieldId]: value } });
  }

  return (
    <section className="data-sheet-panel" aria-label="Equipment data sheet" data-testid="data-sheet-panel">
      <div className="data-sheet-header">
        <span>Data Sheet — {symbol.label}</span>
        <button className="data-sheet-close" onClick={onClose} aria-label="Close data sheet">
          ✕
        </button>
      </div>

      <div className="data-sheet-body">
        <label className="data-sheet-field">
          <span>Tag</span>
          <input
            value={data.tag ?? ''}
            onChange={(e) => onUpdateData(nodeId, { tag: e.target.value })}
            data-testid="data-sheet-tag-input"
          />
        </label>

        {fields.map((f) => (
          <label className="data-sheet-field" key={f.id}>
            <span>
              {f.label}
              {f.unit ? ` (${f.unit})` : ''}
            </span>
            {f.options ? (
              <select value={properties[f.id] ?? ''} onChange={(e) => setProperty(f.id, e.target.value)}>
                <option value="" />
                {f.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input value={properties[f.id] ?? ''} onChange={(e) => setProperty(f.id, e.target.value)} />
            )}
          </label>
        ))}

        <div className="nozzle-editor" data-testid="nozzle-editor">
          <div className="nozzle-editor-header">
            <span>Ports / Nozzles</span>
            <button onClick={addPort} data-testid="add-nozzle-btn">
              + Add nozzle
            </button>
          </div>
          <ul className="nozzle-list">
            {ports.map((port) => {
              const connected = connectedPortIds.has(port.id);
              return (
                <li className="nozzle-item" key={port.id} data-testid={`nozzle-row-${port.id}`}>
                  <div className="nozzle-item-row">
                    <input
                      className="nozzle-label-input"
                      value={port.label}
                      onChange={(e) => updatePort(port.id, { label: e.target.value })}
                    />
                    {connected && <span className="nozzle-connected-badge">connected</span>}
                    <button
                      className="nozzle-remove-btn"
                      onClick={() => removePort(port.id)}
                      title={connected ? 'Disconnect the pipe first' : 'Remove nozzle'}
                      data-testid={`remove-nozzle-${port.id}`}
                    >
                      remove
                    </button>
                  </div>
                  <div className="nozzle-item-row">
                    <label>
                      x
                      <input
                        type="number"
                        value={port.x}
                        onChange={(e) => updatePort(port.id, { x: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      y
                      <input
                        type="number"
                        value={port.y}
                        onChange={(e) => updatePort(port.id, { y: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="nozzle-item-row nozzle-direction-row">
                    {CARDINAL_DIRECTIONS.map((c) => (
                      <button
                        key={c.label}
                        className={
                          'nozzle-dir-btn' +
                          (port.direction.x === c.dir.x && port.direction.y === c.dir.y ? ' active' : '')
                        }
                        onClick={() => updatePort(port.id, { direction: c.dir })}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

export { nextDefaultPort };
