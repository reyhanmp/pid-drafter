import type { ValidationError } from '../validation/validateDiagram';
import type { SpecWarning } from '../validation/specValidation';
import type { TagWarning } from '../validation/tagSemantics';

/**
 * Live validity panel — shows current diagram errors as they exist
 * (duplicate tags, pipes not seated on a declared port), updating on
 * every edit rather than requiring an on-demand check.
 *
 * Three tiers, deliberately separated:
 *
 *   1. ERRORS (badge, blocks export) — things that break the drawing or its
 *      downstream consumers: duplicate tags, pipes floating off a nozzle,
 *      unresolvable off-sheet references, instrument tags with no loop number.
 *   2. SPEC COMPATIBILITY (soft) — material/rating disagreement between a line
 *      and the equipment on it.
 *   3. TAG & LINE SEMANTICS (soft) — whether tags read as valid ISA-5.1 and
 *      whether line numbers parse. Soft because house standards legitimately
 *      extend the standards: the reference drawing (§6) uses ZSL/ZSH/ZI/HS/AV,
 *      which ISA-5.1 does not define, and a tool that refused those drawings
 *      would be wrong about correct P&IDs.
 */
export default function ValidationPanel({
  errors,
  specWarnings = [],
  tagWarnings = [],
}: {
  errors: ValidationError[];
  specWarnings?: SpecWarning[];
  tagWarnings?: TagWarning[];
}) {
  return (
    <section className="validation-panel" aria-label="Diagram validity">
      <div className="validation-header">
        Diagram Validity
        <span className={`validation-badge ${errors.length > 0 ? 'error' : 'ok'}`}>
          {errors.length === 0 ? 'Valid' : `${errors.length} error${errors.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {errors.length === 0 ? (
        <div className="validation-empty">
          No validity errors. Every tag is unique across all sheets, every pipe is seated on a declared port, and every
          off-page connector resolves.
        </div>
      ) : (
        <ul className="validation-list">
          {errors.map((err, i) => (
            <li key={`${err.kind}-${i}`} className="validation-item" data-testid="validation-error">
              {err.kind === 'duplicate-tag' && err.sheetNames && err.sheetNames.length > 1 && (
                <span className="validation-item-locator" data-testid="validation-error-sheets">
                  [{err.sheetNames.join(' | ')}]{' '}
                </span>
              )}
              {err.kind === 'offpage-broken-reference' && (
                <span className="validation-item-locator" data-testid="validation-error-sheets">
                  [broken reference]{' '}
                </span>
              )}
              {err.message}
            </li>
          ))}
        </ul>
      )}

      <div className="validation-subsection" data-testid="spec-warnings-section">
        <div className="validation-subheader">
          Spec Compatibility
          <span className={`validation-badge ${specWarnings.length > 0 ? 'warn' : 'ok'}`}>
            {specWarnings.length === 0 ? 'OK' : `${specWarnings.length} warning${specWarnings.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {specWarnings.length === 0 ? (
          <div className="validation-empty">No spec mismatches. These are soft warnings — visible here, never export-blocking.</div>
        ) : (
          <ul className="validation-list validation-list-warn">
            {specWarnings.map((w, i) => (
              <li key={`${w.kind}-${i}`} className="validation-item validation-item-warn" data-testid="spec-warning">
                {w.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="validation-subsection" data-testid="tag-warnings-section">
        <div className="validation-subheader">
          Tag &amp; Line Semantics
          <span className={`validation-badge ${tagWarnings.length > 0 ? 'warn' : 'ok'}`}>
            {tagWarnings.length === 0 ? 'OK' : `${tagWarnings.length} warning${tagWarnings.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {tagWarnings.length === 0 ? (
          <div className="validation-empty">
            Tags read as valid ISA-5.1 and line numbers match the expected format. These are soft warnings — house
            codes and partially-specified numbers are fine, and nothing here blocks export.
          </div>
        ) : (
          <ul className="validation-list validation-list-warn">
            {tagWarnings.map((w, i) => (
              <li key={`${w.kind}-${i}`} className="validation-item validation-item-warn" data-testid="tag-warning">
                {w.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
