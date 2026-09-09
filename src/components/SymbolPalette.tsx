import { useState } from 'react';
import { symbolsByCategory } from '../symbols';
import type { SymbolDefinition } from '../symbols/types';

/**
 * Categorized equipment/instrumentation palette — right-hand panel per
 * PRD 4.2 (a deliberate placement choice, not the typical left sidebar).
 * Categories are collapsible and derived directly from the symbol
 * registry's grouping, so a new symbol automatically appears here.
 */
export default function SymbolPalette() {
  const groups = symbolsByCategory();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(category: string) {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  function onDragStart(e: React.DragEvent, symbol: SymbolDefinition) {
    e.dataTransfer.setData('application/pid-symbol-kind', symbol.kind);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="palette" aria-label="Equipment palette">
      <div className="palette-header">Equipment &amp; Instrumentation</div>
      <div className="palette-body">
        {groups.map(({ category, symbols }) => {
          const isCollapsed = collapsed[category];
          return (
            <div className="palette-category" key={category}>
              <button
                type="button"
                className="palette-category-toggle"
                onClick={() => toggle(category)}
                aria-expanded={!isCollapsed}
              >
                <span className={`chevron ${isCollapsed ? 'collapsed' : ''}`}>&#9662;</span>
                {category}
                <span className="palette-category-count">{symbols.length}</span>
              </button>
              {!isCollapsed && (
                <div className="palette-items">
                  {symbols.map((symbol) => (
                    <div
                      key={symbol.kind}
                      className="palette-item"
                      draggable
                      onDragStart={(e) => onDragStart(e, symbol)}
                      title={`Drag onto the drawing to place a ${symbol.label}`}
                      data-testid={`palette-item-${symbol.kind}`}
                    >
                      <div className="palette-item-preview">
                        <symbol.Geometry width={40} height={Math.min(40, (40 * symbol.defaultHeight) / symbol.defaultWidth)} />
                      </div>
                      <span className="palette-item-label">{symbol.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
