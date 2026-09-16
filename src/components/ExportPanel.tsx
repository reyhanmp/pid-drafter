/**
 * Export panel (PRD §4.4) — paper template, page size, title block, PDF + SVG.
 *
 * WHY THIS IS A PANEL AND NOT TWO BUTTONS. §4.4's requirement is a drawing that
 * "looks like an actual issued drawing"; the sheet furniture is what decides
 * that, and the title block is data only the user has (company, job number,
 * drawing number, revision, initials). A bare "Export PDF" button would have to
 * invent all of it — and inventing engineering metadata is exactly what §4.9.3
 * forbids elsewhere in this tool ("never invent engineering data … an empty field
 * is honest"). So the panel collects the fields, PREVIEWS the framed result, and
 * only then writes the file.
 *
 * THE PREVIEW IS THE REAL RENDER. It shows the same `buildSheetSvg` output that
 * the download writes, injected as markup, rather than a CSS approximation of
 * the sheet. A preview that can disagree with the export is worse than none —
 * the same reasoning as the numbering panel's live preview, which calls the real
 * generator instead of re-deriving the rule.
 */
import { useMemo, useState } from 'react';
import { buildSheetSvg, type ExportEdge, type ExportNode } from '../export/svgExport';
import { buildSheetPdf, exportFileName } from '../export/pdfExport';
import { SHEET_SIZES, type SheetSizeName, type TitleBlockFields } from '../export/paperTemplate';
import type { ProjectSheet } from '../project/types';
import type { PipeEdgeData } from '../types/diagram';
import { readLineType } from '../edges/lineKind';

/** Save a Blob with the anchor-download trick; the app has no server (§4.5). */
function downloadBlob(data: BlobPart, mime: string, filename: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function defaultDrawingNumber(projectName: string, sheetNumber: number): string {
  const base = projectName.trim().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'DRAWING';
  return `${base}-${String(sheetNumber).padStart(2, '0')}`;
}

export default function ExportPanel({
  sheet,
  projectName,
  sheetIndex,
  sheetTotal,
  blockingErrors = 0,
  revision,
  revisionDescription,
  onClose,
}: {
  sheet: ProjectSheet;
  projectName: string;
  /** 0-based index of the sheet being exported, for "SH. n/m". */
  sheetIndex: number;
  sheetTotal: number;
  /**
   * Count of HARD validity errors in the project. §4.1 says these block export;
   * every soft tier is advisory and must not stop a legitimate drawing from
   * being issued. Passed in from App rather than recomputed here so the export
   * panel cannot disagree with the validity panel about whether this drawing is
   * issuable.
   */
  blockingErrors?: number;
  revision?: string;
  revisionDescription?: string;
  onClose: () => void;
}) {
  const [size, setSize] = useState<SheetSizeName>('A3');
  const [fields, setFields] = useState<TitleBlockFields>({
    company: '',
    title: projectName,
    process: '',
    jobNumber: '',
    itemNumber: '',
    scale: 'NTS',
    drawnBy: '',
    checkedBy: '',
    drawingNumber: defaultDrawingNumber(projectName, sheetIndex + 1),
    revision: revision ?? '',
    revisionDescription: revisionDescription ?? '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Block export when the drawing has hard validity errors. §4.1 defines exactly
   * three hard-error conditions and says they BLOCK EXPORT; every soft tier
   * (spec, process reconciliation, tag/line semantics) is advisory and must not
   * stop a legitimate drawing from being issued.
   *
   * This is passed in rather than recomputed so the panel cannot disagree with
   * the validity panel about whether the diagram is exportable.
   */
  const sheetNodes = sheet.nodes as unknown as ExportNode[];
  const sheetEdges = sheet.edges as unknown as ExportEdge[];

  const options = useMemo(
    () => ({
      sheetName: sheet.name,
      sheetNumber: sheetIndex + 1,
      sheetTotal,
      size,
      titleBlock: fields,
    }),
    [sheet.name, sheetIndex, sheetTotal, size, fields],
  );

  const svg = useMemo(() => buildSheetSvg(sheetNodes, sheetEdges, options), [sheetNodes, sheetEdges, options]);

  function set<K extends keyof TitleBlockFields>(key: K, value: TitleBlockFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handlePdf() {
    const pdf = buildSheetPdf(sheetNodes, sheetEdges, options);
    // Copy into a fresh ArrayBuffer so the Blob gets exactly these bytes; a
    // Uint8Array view over a larger buffer would otherwise serialize the slack.
    downloadBlob(pdf.slice().buffer as ArrayBuffer, 'application/pdf', exportFileName(projectName, sheet.name, 'pdf'));
  }

  function handleSvg() {
    downloadBlob(svg, 'image/svg+xml', exportFileName(projectName, sheet.name, 'svg'));
  }

  const bulletCount = sheetEdges.length;
  const lineCount = sheetEdges.filter((e) => readLineType(e.data as unknown as PipeEdgeData) !== 'boundary').length;

  return (
    <div className="engineering-lists-overlay" data-testid="export-panel" role="dialog" aria-label="Export drawing">
      <div className="engineering-lists-modal">
        <div className="engineering-lists-header">
          <span>Export — {sheet.name}</span>
          <button className="data-sheet-close" onClick={onClose} aria-label="Close export panel" data-testid="export-close">
            ✕
          </button>
        </div>

        <div className="engineering-lists-body" style={{ display: 'block', overflow: 'auto' }}>
          <div className="data-sheet-group">
            <div className="data-sheet-group-heading">Sheet</div>
            <label className="data-sheet-field">
              <span>Paper size</span>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as SheetSizeName)}
                data-testid="export-size-select"
              >
                {(['A4', 'A3', 'A0'] as SheetSizeName[]).map((s) => (
                  <option key={s} value={s}>
                    {s} — {SHEET_SIZES[s].mmWidth} × {SHEET_SIZES[s].mmHeight} mm landscape
                  </option>
                ))}
              </select>
            </label>
            <div className="numbering-hint" data-testid="export-content-summary">
              {sheet.name}: {sheetNodes.length} item(s), {lineCount} line(s)
              {bulletCount !== lineCount ? `, ${bulletCount - lineCount} battery-limit line(s)` : ''}. Sheet{' '}
              {sheetIndex + 1} of {sheetTotal}.
            </div>
          </div>

          <div className="data-sheet-group">
            <div className="data-sheet-group-heading">Title block</div>
            <div className="line-number-grid">
              <label className="data-sheet-field">
                <span>Company</span>
                <input value={fields.company ?? ''} onChange={(e) => set('company', e.target.value)} data-testid="export-company" />
              </label>
              <label className="data-sheet-field">
                <span>Drawing title</span>
                <input value={fields.title ?? ''} onChange={(e) => set('title', e.target.value)} data-testid="export-title" />
              </label>
              <label className="data-sheet-field">
                <span>Process / unit</span>
                <input value={fields.process ?? ''} onChange={(e) => set('process', e.target.value)} data-testid="export-process" />
              </label>
              <label className="data-sheet-field">
                <span>Drawing number</span>
                <input
                  value={fields.drawingNumber ?? ''}
                  onChange={(e) => set('drawingNumber', e.target.value)}
                  data-testid="export-drawing-number"
                />
              </label>
              <label className="data-sheet-field">
                <span>Job number</span>
                <input value={fields.jobNumber ?? ''} onChange={(e) => set('jobNumber', e.target.value)} data-testid="export-job-number" />
              </label>
              <label className="data-sheet-field">
                <span>Item number</span>
                <input value={fields.itemNumber ?? ''} onChange={(e) => set('itemNumber', e.target.value)} data-testid="export-item-number" />
              </label>
              <label className="data-sheet-field">
                <span>Revision</span>
                <input value={fields.revision ?? ''} onChange={(e) => set('revision', e.target.value)} data-testid="export-revision" />
              </label>
              <label className="data-sheet-field">
                <span>Revision description</span>
                <input
                  value={fields.revisionDescription ?? ''}
                  onChange={(e) => set('revisionDescription', e.target.value)}
                  data-testid="export-revision-description"
                />
              </label>
              <label className="data-sheet-field">
                <span>Drawn by</span>
                <input value={fields.drawnBy ?? ''} onChange={(e) => set('drawnBy', e.target.value)} data-testid="export-drawn-by" />
              </label>
              <label className="data-sheet-field">
                <span>Checked by</span>
                <input value={fields.checkedBy ?? ''} onChange={(e) => set('checkedBy', e.target.value)} data-testid="export-checked-by" />
              </label>
              <label className="data-sheet-field">
                <span>Scale</span>
                <input value={fields.scale ?? ''} onChange={(e) => set('scale', e.target.value)} data-testid="export-scale" />
              </label>
              <label className="data-sheet-field">
                <span>Date</span>
                <input value={fields.date ?? ''} onChange={(e) => set('date', e.target.value)} data-testid="export-date" />
              </label>
            </div>
          </div>

          <div className="data-sheet-group">
            <div className="data-sheet-group-heading">Output</div>
            {blockingErrors > 0 && (
              <div className="tag-problem" data-testid="export-blocked" role="alert">
                Export blocked: {blockingErrors} validity error{blockingErrors === 1 ? '' : 's'} must be fixed first. These are
                the §4.1 hard errors (duplicate tags, pipes off a nozzle, broken off-sheet references, instrument tags with no
                loop number) — soft warnings do not block export.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handlePdf}
                disabled={blockingErrors > 0}
                data-testid="export-pdf-btn"
                title="Vector PDF in the paper template — printable"
              >
                Export PDF
              </button>
              <button
                onClick={handleSvg}
                disabled={blockingErrors > 0}
                data-testid="export-svg-btn"
                title="Vector SVG in the paper template"
              >
                Export SVG
              </button>
              <button onClick={() => setShowPreview((v) => !v)} data-testid="export-preview-btn">
                {showPreview ? 'Hide preview' : 'Show preview'}
              </button>
            </div>
            <div className="numbering-hint">
              Both outputs are vector, not screenshots — every line, symbol stroke, label and sheet block is real
              drawing geometry. Both exports render symbols from the same serialized geometry, so the two artifacts
              cannot describe a symbol differently. Remaining differences between them are listed in PRD §0g.
            </div>
          </div>

          {showPreview && (
            <div className="data-sheet-group">
              <div className="data-sheet-group-heading">Preview (the exported sheet itself)</div>
              {/* The real buildSheetSvg output, not a CSS mock-up. */}
              <div
                data-testid="export-preview"
                style={{ background: '#fff', border: '1px solid #ccc', overflow: 'auto', maxHeight: 520 }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
