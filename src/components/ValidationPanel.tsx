import type { ValidationError } from '../validation/validateDiagram';
import type { SpecWarning } from '../validation/specValidation';

/**
 * Live validity panel — shows current diagram errors as they exist
 * (duplicate tags, pipes not seated on a declared port), updating on
 * every edit rather than requiring an on-demand check.
 *
 * Spec-driven soft warnings (PRD §4.1) are rendered in a SEPARATE
 * section below the hard errors: visible and listed, but explicitly
 * not counted in the badge/export-blocking error total, per the "soft,
 * non-blocking" requirement — a diagram with only spec warnings still
 * reads/exports as Valid.
 */
export default function ValidationPanel({
  errors,
  specWarnings = [],
}: {
  errors: ValidationError[];
  specWarnings?: SpecWarning[];
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
        <div className="validation-empty">No validity errors. Every tag is unique and every pipe is seated on a declared port.</div>
      ) : (
        <ul className="validation-list">
          {errors.map((err, i) => (
            <li key={`${err.kind}-${i}`} className="validation-item" data-testid="validation-error">
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
    </section>
  );
}
