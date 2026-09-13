/**
 * Numbering settings (PRD §4.3).
 *
 * A settings panel where the numbering scheme for tags and line numbers is
 * defined once for the project, instead of every tag being free text with no
 * system behind it — the explicitly-requested feature.
 *
 * WHY A LIVE PREVIEW. A scheme is easy to configure and hard to verify: reading
 * `defaultStart: 201, step: 10` and working out that the next pump is `P-211`
 * in your head is exactly the kind of avoidable arithmetic that leads to a
 * wrong setting discovered 40 tags later. The panel therefore shows the next
 * FEW numbers the scheme would actually produce, computed by calling the real
 * `nextTagFor` / `nextLineNumber` rather than by re-deriving the rule in the
 * UI. A preview that can disagree with the generator is worse than none.
 *
 * The per-prefix seeds are shown for the prefixes actually present on the
 * drawing, so the panel is about this project rather than every possible item
 * type in the abstract.
 */
import { useMemo, useState } from 'react';
import type { NumberingConfig, TagNumberingScheme, LineNumberingScheme } from '../project/numbering';
import { describeLineScheme, nextLineNumber, nextTagFor } from '../project/numbering';
import type { ProjectSheet } from '../project/types';

/** The tag prefixes in use on the drawing, in first-seen order. */
function prefixesInUse(sheets: ProjectSheet[]): string[] {
  const out: string[] = [];
  for (const sheet of sheets) {
    for (const node of sheet.nodes) {
      const tag = ((node.data as unknown as { tag?: string }).tag ?? '').trim();
      const m = tag.match(/^([A-Za-z]+)-\d+/);
      if (m && !out.includes(m[1])) out.push(m[1]);
    }
  }
  return out.sort();
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  hint,
  testId,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  hint?: string;
  testId: string;
}) {
  return (
    <label className="numbering-field">
      <span className="numbering-field-label">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        data-testid={testId}
        onChange={(e) => {
          const n = Number(e.target.value);
          // An empty input reads as NaN; keeping the previous value avoids
          // writing NaN into the project, which would serialize as null.
          if (Number.isFinite(n) && n >= min) onChange(n);
        }}
      />
      {hint && <span className="numbering-hint">{hint}</span>}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
  testId,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  hint?: string;
  testId: string;
  placeholder?: string;
}) {
  return (
    <label className="numbering-field">
      <span className="numbering-field-label">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="numbering-hint">{hint}</span>}
    </label>
  );
}

export default function NumberingSettingsPanel({
  numbering,
  sheets,
  onTagChange,
  onLineChange,
  unnumberedCount,
  onNumberUnnumbered,
  onClose,
}: {
  numbering: NumberingConfig;
  sheets: ProjectSheet[];
  onTagChange: (patch: Partial<TagNumberingScheme>) => void;
  onLineChange: (patch: Partial<LineNumberingScheme>) => void;
  unnumberedCount: number;
  onNumberUnnumbered: () => number;
  onClose: () => void;
}) {
  const [lastBulk, setLastBulk] = useState<string | null>(null);
  const prefixes = useMemo(() => prefixesInUse(sheets), [sheets]);

  /**
   * Live preview. Deliberately NOT `useMemo` on a re-derived rule: these call
   * the same functions the drop handler and the bulk-number action call, so
   * what the panel shows is what will actually be assigned.
   */
  const tagPreviews = useMemo(
    () => prefixes.map((p) => ({ prefix: p, next: nextTagFor(p, sheets, numbering.tags) })),
    [prefixes, sheets, numbering.tags],
  );

  /**
   * The next few line numbers, in sequence.
   *
   * Computed by feeding each proposal back in as an existing line and calling
   * the real generator again — the same "virtual sheet" technique the bulk
   * planner uses. This is the only way a preview can be trusted to match what
   * will actually be assigned: it is literally the same function, applied
   * repeatedly, rather than a re-implementation of the rule in the UI.
   */
  const linePreviews = useMemo(() => {
    const base: ProjectSheet = sheets[0] ?? { id: 'preview', name: 'preview', order: 0, nodes: [], edges: [] };
    const virtual: ProjectSheet = { ...base, edges: [...base.edges] };
    const out: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const n = nextLineNumber([virtual], numbering.lines);
      if (!n) break;
      out.push(n);
      virtual.edges.push({ id: `preview-${i}`, source: '', target: '', data: { lineNumber: n } });
    }
    return out;
  }, [sheets, numbering.lines]);

  const linePattern = describeLineScheme(numbering.lines);

  return (
    <div className="numbering-overlay" data-testid="numbering-overlay" role="dialog" aria-label="Numbering settings">
      <div className="numbering-modal">
        <header className="numbering-header">
          <h2>Numbering</h2>
          <span className="numbering-subtitle">
            Applied to new items, and to existing lines only when you ask.
          </span>
          <button className="numbering-close" onClick={onClose} data-testid="numbering-close" aria-label="Close numbering">
            ×
          </button>
        </header>

        <div className="numbering-body">
          {/* ── Tag numbering ── */}
          <section className="numbering-section">
            <h3>Tag numbering</h3>
            <p className="numbering-note">
              Applied when a new item is dropped on the canvas. Existing tags are never
              changed — this sets the starting point, nothing is renumbered.
            </p>

            <div className="numbering-row">
              <label className="numbering-field">
                <span className="numbering-field-label">Tag shape</span>
                <select
                  value={numbering.tags.style}
                  data-testid="numbering-tag-style"
                  onChange={(e) => onTagChange({ style: e.target.value as 'plain' | 'area' })}
                >
                  <option value="plain">Plain — V-101, P-102</option>
                  <option value="area">Area — P-710.01A, D-710.2.01A</option>
                </select>
                <span className="numbering-hint">
                  Both are real house standards. The reference drawing uses the area form for
                  equipment, matching its line numbers.
                </span>
              </label>
            </div>

            {numbering.tags.style === 'area' && (
              <div className="numbering-row">
                <TextField
                  label="Tag area / unit"
                  value={numbering.tags.area}
                  testId="numbering-tag-area"
                  onChange={(s) => onTagChange({ area: s })}
                  hint="e.g. 710 writes P-710.01"
                />
                <NumberField
                  label="Tag sequence pad"
                  value={numbering.tags.sequencePad}
                  min={1}
                  testId="numbering-tag-pad"
                  onChange={(n) => onTagChange({ sequencePad: n })}
                  hint="2 writes 01, 02."
                />
                <TextField
                  label="Tag suffix"
                  value={numbering.tags.suffix}
                  testId="numbering-tag-suffix"
                  onChange={(s) => onTagChange({ suffix: s })}
                  hint="A/B for parallel units."
                />
                <NumberField
                  label="Tag sequence start"
                  value={numbering.tags.sequenceStart}
                  min={0}
                  testId="numbering-tag-seqstart"
                  onChange={(n) => onTagChange({ sequenceStart: n })}
                  hint="1 writes P-710.01."
                />
              </div>
            )}

            <div className="numbering-row">
              <NumberField
                label="Default start"
                value={numbering.tags.defaultStart}
                min={0}
                testId="numbering-tag-start"
                onChange={(n) => onTagChange({ defaultStart: n })}
                hint="First number for a type with no seed of its own. 101 is conventional."
              />
              <NumberField
                label="Step"
                value={numbering.tags.step}
                min={1}
                testId="numbering-tag-step"
                onChange={(n) => onTagChange({ step: n })}
                hint="1 = consecutive. 10 leaves gaps to insert items later."
              />
            </div>

            {prefixes.length > 0 && (
              <div className="numbering-prefix-block">
                <h4>Per-type starting number</h4>
                <p className="numbering-note">
                  Types present on this drawing. Seed them so the first digit identifies the
                  type — e.g. vessels from 101, pumps from 201.
                </p>
                <div className="numbering-prefix-grid">
                  {prefixes.map((p) => (
                    <label className="numbering-prefix-row" key={p}>
                      <span className="numbering-prefix-name">{p}-</span>
                      <input
                        type="number"
                        min={0}
                        data-testid={`numbering-prefix-${p}`}
                        value={numbering.tags.prefixStarts[p] ?? ''}
                        placeholder={String(numbering.tags.defaultStart)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = { ...numbering.tags.prefixStarts };
                          if (raw === '') delete next[p];
                          else {
                            const n = Number(raw);
                            if (!Number.isFinite(n) || n < 0) return;
                            next[p] = n;
                          }
                          onTagChange({ prefixStarts: next });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="numbering-preview" data-testid="numbering-tag-preview">
              <span className="numbering-preview-label">Next tag for each type</span>
              {tagPreviews.length === 0 ? (
                <span className="numbering-hint">
                  Nothing on the canvas yet — drop an item to see this fill in.
                </span>
              ) : (
                <ul className="numbering-preview-list">
                  {tagPreviews.map((t) => (
                    <li key={t.prefix}>
                      <code>{t.next}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── Line numbering ── */}
          <section className="numbering-section">
            <h3>Line numbering</h3>
            <p className="numbering-note">
              Sets what a new line number looks like, so a numbered drawing is consistent
              without typing the area, class and insulation onto every run.
            </p>
            <p className="numbering-pattern" data-testid="numbering-line-pattern">
              {linePattern}
            </p>

            <div className="numbering-row">
              <TextField
                label="Area / unit"
                value={numbering.lines.area}
                testId="numbering-line-area"
                onChange={(s) => onLineChange({ area: s })}
                hint="e.g. 710"
              />
              <TextField
                label="Piping class"
                value={numbering.lines.pipingClass}
                testId="numbering-line-class"
                onChange={(s) => onLineChange({ pipingClass: s })}
                hint="e.g. 300"
              />
            </div>

            <div className="numbering-row">
              <TextField
                label="Default service"
                value={numbering.lines.defaultService}
                testId="numbering-line-service"
                onChange={(s) => onLineChange({ defaultService: s })}
                hint="e.g. PROC"
              />
              <TextField
                label="Default size"
                value={numbering.lines.defaultSize}
                testId="numbering-line-size"
                onChange={(s) => onLineChange({ defaultSize: s })}
                hint={'e.g. 2"'}
              />
            </div>

            <div className="numbering-row">
              <NumberField
                label="Sequence start"
                value={numbering.lines.sequenceStart}
                min={0}
                testId="numbering-line-seqstart"
                onChange={(n) => onLineChange({ sequenceStart: n })}
                hint="First running number in the area."
              />
              <NumberField
                label="Step"
                value={numbering.lines.step}
                min={1}
                testId="numbering-line-step"
                onChange={(n) => onLineChange({ step: n })}
                hint="1 = consecutive."
              />
            </div>

            <div className="numbering-row">
              <NumberField
                label="Sequence pad"
                value={numbering.lines.sequencePad}
                min={1}
                testId="numbering-line-pad"
                onChange={(n) => onLineChange({ sequencePad: n })}
                hint="2 writes 01, 02. Never truncates."
              />
              <TextField
                label="Suffix"
                value={numbering.lines.suffix}
                testId="numbering-line-suffix"
                onChange={(s) => onLineChange({ suffix: s })}
                hint="e.g. A. Blank for none."
              />
            </div>

            <div className="numbering-row">
              <TextField
                label="Insulation"
                value={numbering.lines.insulation}
                testId="numbering-line-insulation"
                onChange={(s) => onLineChange({ insulation: s })}
                hint="HC = heat conservation. Blank writes a trailing dash."
              />
            </div>

            <div className="numbering-preview" data-testid="numbering-line-preview">
              <span className="numbering-preview-label">Next line numbers</span>
              {linePreviews.length > 0 ? (
                <ul className="numbering-preview-list">
                  {linePreviews.map((n) => (
                    <li key={n}>
                      <code>{n}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="numbering-hint">
                  This scheme does not round-trip through the line-number grammar — check the
                  area (no dashes or dots).
                </span>
              )}
            </div>

            <div className="numbering-bulk">
              <button
                className="numbering-bulk-btn"
                data-testid="number-unnumbered-btn"
                disabled={unnumberedCount === 0}
                onClick={() => {
                  const n = onNumberUnnumbered();
                  setLastBulk(
                    n === 0
                      ? 'No unnumbered lines on this sheet.'
                      : `Numbered ${n} line${n === 1 ? '' : 's'} on this sheet.`,
                  );
                }}
              >
                Number {unnumberedCount > 0 ? `${unnumberedCount} ` : ''}unnumbered line
                {unnumberedCount === 1 ? '' : 's'} on this sheet
              </button>
              <p className="numbering-note">
                Numbers only lines that have none, in reading order (down the sheet, left to
                right). Lines that already carry a number are left exactly as they are.
              </p>
              {lastBulk && (
                <p className="numbering-bulk-result" data-testid="numbering-bulk-result">
                  {lastBulk}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
