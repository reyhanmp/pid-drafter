import { useEffect, useRef, useState } from 'react';
import type { ProjectSheet } from '../project/types';

/**
 * Sheet tabs (PRD §4.8) — spreadsheet-style drawing-sheet management along
 * the bottom of the canvas area: add, switch, rename (double-click),
 * reorder (drag a tab, or the ◀/▶ buttons which are keyboard/pointer
 * friendly and testable), delete.
 *
 * A project always keeps at least one drawing sheet; deleting the last one
 * is blocked here AND defensively in the store.
 */
export default function SheetTabs({
  sheets,
  activeSheetId,
  onSelect,
  onAdd,
  onRename,
  onReorder,
  onDelete,
}: {
  sheets: ProjectSheet[];
  activeSheetId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function beginRename(sheet: ProjectSheet) {
    setEditingId(sheet.id);
    setEditingValue(sheet.name);
  }

  function commitRename() {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
  }

  function handleDelete(sheet: ProjectSheet) {
    if (sheets.length <= 1) {
      window.alert('A project must keep at least one sheet.');
      return;
    }
    const ok = window.confirm(
      `Delete sheet "${sheet.name}" and everything drawn on it? This cannot be undone.`,
    );
    if (ok) onDelete(sheet.id);
  }

  return (
    <div className="sheet-tabs" data-testid="sheet-tabs" role="tablist" aria-label="Drawing sheets">
      <div className="sheet-tabs-strip">
        {sheets.map((sheet, index) => {
          const isActive = sheet.id === activeSheetId;
          return (
            <div
              key={sheet.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              data-testid={`sheet-tab-${index}`}
              data-sheet-id={sheet.id}
              className={`sheet-tab${isActive ? ' active' : ''}${dragId === sheet.id ? ' dragging' : ''}`}
              draggable={editingId !== sheet.id}
              onDragStart={() => setDragId(sheet.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId && dragId !== sheet.id) onReorder(dragId, index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragId(null);
              }}
              onClick={() => onSelect(sheet.id)}
              onDoubleClick={() => beginRename(sheet)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(sheet.id);
                }
                if (e.key === 'F2') beginRename(sheet);
              }}
            >
              {editingId === sheet.id ? (
                <input
                  ref={inputRef}
                  className="sheet-tab-rename"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`sheet-tab-rename-input-${index}`}
                />
              ) : (
                <span className="sheet-tab-label" title={`${sheet.name} — double-click to rename`}>
                  <span className="sheet-tab-designator">SH.{index + 1}</span> {sheet.name}
                </span>
              )}
              <span className="sheet-tab-actions">
                <button
                  className="sheet-tab-move"
                  title="Move sheet left"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(sheet.id, index - 1);
                  }}
                  data-testid={`sheet-tab-left-${index}`}
                >
                  ◀
                </button>
                <button
                  className="sheet-tab-move"
                  title="Move sheet right"
                  disabled={index === sheets.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(sheet.id, index + 1);
                  }}
                  data-testid={`sheet-tab-right-${index}`}
                >
                  ▶
                </button>
                <button
                  className="sheet-tab-delete"
                  title={sheets.length <= 1 ? 'A project must keep at least one sheet' : `Delete ${sheet.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(sheet);
                  }}
                  data-testid={`sheet-tab-delete-${index}`}
                >
                  ✕
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <button className="sheet-tab-add" onClick={onAdd} data-testid="sheet-tab-add" title="Add drawing sheet">
        + Sheet
      </button>
      <span className="sheet-tabs-hint">double-click a tab to rename · drag or ◀ ▶ to reorder</span>
    </div>
  );
}
