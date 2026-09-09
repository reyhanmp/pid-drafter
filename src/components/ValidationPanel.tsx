import type { ValidationError } from '../validation/validateDiagram';

/**
 * Live validity panel — shows current diagram errors as they exist
 * (duplicate tags, pipes not seated on a declared port), updating on
 * every edit rather than requiring an on-demand check.
 */
export default function ValidationPanel({ errors }: { errors: ValidationError[] }) {
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
    </section>
  );
}
