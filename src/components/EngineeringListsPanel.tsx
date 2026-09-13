import { useMemo, useState } from 'react';
import type { ProjectSheet } from '../project/types';
import {
  buildEngineeringLists,
  listCsvFileName,
  listToCsv,
  COLUMN_LABELS,
  type EngineeringList,
} from '../lists/engineeringLists';

/**
 * Auto-generated engineering lists (PRD §4.6) — a real UI view, not just an
 * export format, so the lists can be sanity-checked on screen before anyone
 * exports them.
 *
 * Everything here is DERIVED on every render from the current sheets. There
 * is deliberately no refresh button: a manual refresh is exactly the thing
 * that goes stale, and the whole promise of §4.6 is that a list cannot
 * disagree with the drawing. Editing the canvas updates these tables as a
 * side effect of React re-rendering, which is the correct amount of
 * machinery for the guarantee being made.
 */
export default function EngineeringListsPanel({
  sheets,
  projectName,
  onClose,
}: {
  sheets: ProjectSheet[];
  projectName: string;
  onClose: () => void;
}) {
  const { lists, unlisted } = useMemo(() => buildEngineeringLists(sheets), [sheets]);
  const [activeId, setActiveId] = useState<EngineeringList['id']>('lines');
  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  function downloadCsv(list: EngineeringList) {
    const blob = new Blob([listToCsv(list)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = listCsvFileName(projectName, list);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const unlistedTotal = Object.values(unlisted).reduce((a, b) => a + b, 0);

  return (
    <div className="lists-overlay" data-testid="lists-overlay" role="dialog" aria-label="Auto-generated engineering lists">
      <div className="lists-modal">
        <header className="lists-header">
          <h2>Engineering Lists</h2>
          <span className="lists-derived-note" title="Every row is computed from the drawing on each render — there is no stored list to fall out of date.">
            derived from the drawing
          </span>
          <button className="lists-close" onClick={onClose} data-testid="lists-close" aria-label="Close lists">
            ✕
          </button>
        </header>

        <nav className="lists-tabs" aria-label="List selection">
          {lists.map((list) => (
            <button
              key={list.id}
              className={`lists-tab ${list.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(list.id)}
              data-testid={`lists-tab-${list.id}`}
              aria-pressed={list.id === activeId}
            >
              {list.title}
              <span className="lists-tab-count">{list.rows.length}</span>
            </button>
          ))}
        </nav>

        <div className="lists-toolbar">
          <span className="lists-count" data-testid="lists-active-count">
            {active.rows.length} row{active.rows.length === 1 ? '' : 's'} · {active.columns.length} columns
          </span>
          <button
            onClick={() => downloadCsv(active)}
            data-testid="lists-export-csv"
            disabled={active.rows.length === 0}
            title={`Download ${active.title} as CSV`}
          >
            Export CSV
          </button>
        </div>

        <div className="lists-table-wrap">
          {active.rows.length === 0 ? (
            <p className="lists-empty" data-testid="lists-empty">
              {active.emptyHint}
            </p>
          ) : (
            <table className="lists-table" data-testid={`lists-table-${active.id}`}>
              <thead>
                <tr>
                  {active.columns.map((c) => (
                    <th key={c}>{COLUMN_LABELS[c] ?? c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.rows.map((row, i) => (
                  <tr key={i} data-testid={`lists-row-${active.id}`}>
                    {active.columns.map((c) => (
                      <td key={c} title={row[c] ?? ''}>
                        {row[c] || <span className="lists-blank">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {unlistedTotal > 0 && (
          <p className="lists-excluded-note" data-testid="lists-excluded-note">
            {unlistedTotal} placed item{unlistedTotal === 1 ? '' : 's'} not listed
            {Object.entries(unlisted).length > 0 && <> ({Object.entries(unlisted).map(([c, n]) => `${c}: ${n}`).join(', ')})</>}
            {' '}— line-end annotations and reference markers, not procured items.
          </p>
        )}
      </div>
    </div>
  );
}
