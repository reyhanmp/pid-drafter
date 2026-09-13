import { useMemo, useState } from 'react';
import type { PipeEdgeData } from '../types/diagram';
import { LINE_SIZE_OPTIONS, MATERIAL_OF_CONSTRUCTION_OPTIONS } from '../types/diagram';
import {
  parseLineNumber,
  formatLineNumber,
  deriveLineNumberSuggestions,
  SERVICE_CODES,
  type LineNumberParts,
} from '../validation/lineNumbers';

interface LineDataSheetPanelProps {
  edgeId: string;
  data: PipeEdgeData;
  onUpdateData: (edgeId: string, patch: Partial<PipeEdgeData>) => void;
  onClose: () => void;
  /** Line numbers already used in the project, so house conventions win over built-in lists. */
  existingLineNumbers?: string[];
}

/**
 * Line-number editor (PRD §4.9.2).
 *
 * The line number is the most information-dense string on a P&ID — size,
 * service, area, sequence, piping class and insulation all encoded in one
 * field. Editing it as a single free-text box means an engineer cannot tell
 * whether the tool understood any of it, and cannot change just the piping
 * class without retyping the whole string.
 *
 * So this panel offers BOTH: a structured form over the parsed parts, and the
 * raw string underneath for the cases the grammar does not cover. The two stay
 * in sync through the raw string — committing the form reformats from parts;
 * typing in the raw box re-parses and updates the form. A number that does not
 * parse leaves the form empty and the raw text untouched, never rewritten.
 */
export default function LineDataSheetPanel({
  edgeId,
  data,
  onUpdateData,
  onClose,
  existingLineNumbers = [],
}: LineDataSheetPanelProps) {
  const raw = data.lineNumber ?? '';
  const reading = useMemo(() => parseLineNumber(raw), [raw]);
  const suggestions = useMemo(
    () => deriveLineNumberSuggestions([...existingLineNumbers, raw]),
    [existingLineNumbers, raw],
  );

  /**
   * Draft state for the structured form. Seeded from the parsed parts, and
   * reset whenever the committed line number changes from outside — keying on
   * `raw` rather than syncing in an effect keeps this from fighting the store.
   */
  const [draft, setDraft] = useState<LineNumberParts | null>(reading.parts);
  const [draftFor, setDraftFor] = useState(raw);
  if (draftFor !== raw) {
    setDraftFor(raw);
    setDraft(reading.parts);
  }

  function commit(next: LineNumberParts | null) {
    if (!next) return;
    setDraft(next);
    onUpdateData(edgeId, { lineNumber: formatLineNumber(next) });
  }

  function patchDraft(patch: Partial<LineNumberParts>) {
    if (!draft) return;
    commit({ ...draft, ...patch });
  }

  return (
    <section className="data-sheet-panel" aria-label="Line data sheet" data-testid="line-data-sheet-panel">
      <div className="data-sheet-header">
        <span>Line Data Sheet</span>
        <button className="data-sheet-close" onClick={onClose} aria-label="Close line data sheet">
          ✕
        </button>
      </div>

      <div className="data-sheet-body">
        <div className="data-sheet-group">
          <div className="data-sheet-group-heading">Line number</div>

          <label className="data-sheet-field">
            <span>Line number (raw)</span>
            <input
              value={raw}
              onChange={(e) => onUpdateData(edgeId, { lineNumber: e.target.value })}
              placeholder={'1 1/2"-LPS2-710.01-300-HC'}
              data-testid="line-number-input"
            />
          </label>

          {reading.problem && (
            <div className="tag-problem" data-testid="line-number-problem" role="alert">
              {reading.problem}
            </div>
          )}

          {reading.serviceDescription && (
            <div className="tag-reading" data-testid="line-service-reading">
              <span className="tag-reading-code">{reading.parts?.service}</span>
              <span className="tag-reading-meaning">{reading.serviceDescription}</span>
            </div>
          )}

          {/* Structured fields over the parsed parts. Shown whenever the raw
              string parses; each edit reformats the whole number from parts, so
              a half-typed number never reaches the store as garbage. */}
          {draft && (
            <div className="line-number-grid" data-testid="line-number-grid">
              <label className="data-sheet-field">
                <span>Size</span>
                <input
                  value={draft.size}
                  onChange={(e) => patchDraft({ size: e.target.value })}
                  placeholder={'1 1/2"'}
                  data-testid="ln-size"
                />
              </label>
              <label className="data-sheet-field">
                <span>Service</span>
                <input
                  list="ln-service-options"
                  value={draft.service}
                  onChange={(e) => patchDraft({ service: e.target.value.toUpperCase() })}
                  placeholder="LPS2"
                  data-testid="ln-service"
                />
                <datalist id="ln-service-options">
                  {suggestions.services.map((s) => (
                    <option key={s} value={s}>
                      {SERVICE_CODES[s] ?? ''}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="data-sheet-field">
                <span>Area</span>
                <input
                  value={draft.area}
                  onChange={(e) => patchDraft({ area: e.target.value.replace(/\D/g, '') })}
                  placeholder="710"
                  data-testid="ln-area"
                />
              </label>
              <label className="data-sheet-field">
                <span>Seq</span>
                <input
                  value={draft.sequence}
                  onChange={(e) => patchDraft({ sequence: e.target.value.replace(/\D/g, '') })}
                  placeholder="01"
                  data-testid="ln-sequence"
                />
              </label>
              <label className="data-sheet-field">
                <span>Suffix</span>
                <input
                  value={draft.suffix}
                  onChange={(e) => patchDraft({ suffix: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1) })}
                  placeholder="A"
                  data-testid="ln-suffix"
                />
              </label>
              <label className="data-sheet-field">
                <span>Piping class</span>
                <input
                  list="ln-class-options"
                  value={draft.pipingClass}
                  onChange={(e) => patchDraft({ pipingClass: e.target.value.replace(/\D/g, '') })}
                  placeholder="300"
                  data-testid="ln-class"
                />
                <datalist id="ln-class-options">
                  {suggestions.classes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="data-sheet-field">
                <span>Insulation</span>
                <input
                  list="ln-insulation-options"
                  value={draft.insulation}
                  onChange={(e) => patchDraft({ insulation: e.target.value.toUpperCase() })}
                  placeholder="HC"
                  data-testid="ln-insulation"
                />
                <datalist id="ln-insulation-options">
                  {suggestions.insulations.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
            </div>
          )}
        </div>

        <label className="data-sheet-field">
          <span>Line name</span>
          <input
            value={data.lineName ?? ''}
            onChange={(e) => onUpdateData(edgeId, { lineName: e.target.value })}
            data-testid="line-name-input"
          />
        </label>

        <label className="data-sheet-field">
          <span>Line size</span>
          <select
            value={data.lineSize ?? ''}
            onChange={(e) => onUpdateData(edgeId, { lineSize: e.target.value })}
            data-testid="line-size-select"
          >
            <option value="" />
            {LINE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="data-sheet-field data-sheet-field-inline">
          <input
            type="checkbox"
            checked={data.jacketed ?? false}
            onChange={(e) => onUpdateData(edgeId, { jacketed: e.target.checked })}
            data-testid="line-jacketed-checkbox"
          />
          <span>Jacketed / traced</span>
        </label>

        <label className="data-sheet-field">
          <span>Material of construction</span>
          <select
            value={data.materialOfConstruction ?? ''}
            onChange={(e) => onUpdateData(edgeId, { materialOfConstruction: e.target.value })}
            data-testid="line-moc-select"
          >
            <option value="" />
            {MATERIAL_OF_CONSTRUCTION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <div className="data-sheet-field">
          <span>Line type</span>
          <div className="line-type-toggle" role="radiogroup" aria-label="Line type">
            <button
              type="button"
              className={'line-type-btn' + (data.lineType !== 'signal' ? ' active' : '')}
              onClick={() => onUpdateData(edgeId, { lineType: 'process' })}
              data-testid="line-type-process-btn"
            >
              Piping (solid)
            </button>
            <button
              type="button"
              className={'line-type-btn' + (data.lineType === 'signal' ? ' active' : '')}
              onClick={() => onUpdateData(edgeId, { lineType: 'signal' })}
              data-testid="line-type-signal-btn"
            >
              Instrument (dashed)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
