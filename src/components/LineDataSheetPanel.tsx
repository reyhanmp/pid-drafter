import type { PipeEdgeData } from '../types/diagram';
import { LINE_SIZE_OPTIONS, MATERIAL_OF_CONSTRUCTION_OPTIONS } from '../types/diagram';

interface LineDataSheetPanelProps {
  edgeId: string;
  data: PipeEdgeData;
  onUpdateData: (edgeId: string, patch: Partial<PipeEdgeData>) => void;
  onClose: () => void;
}

export default function LineDataSheetPanel({ edgeId, data, onUpdateData, onClose }: LineDataSheetPanelProps) {
  return (
    <section className="data-sheet-panel" aria-label="Line data sheet" data-testid="line-data-sheet-panel">
      <div className="data-sheet-header">
        <span>Line Data Sheet</span>
        <button className="data-sheet-close" onClick={onClose} aria-label="Close line data sheet">
          ✕
        </button>
      </div>

      <div className="data-sheet-body">
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
