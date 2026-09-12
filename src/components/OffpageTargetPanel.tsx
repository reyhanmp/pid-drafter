import { resolveOffpageRef, type SheetRef } from '../validation/offpageReferences';
import type { EquipmentNodeData } from '../types/diagram';

/**
 * Off-page / tie-in connector target editor (PRD §4.8).
 *
 * Makes the connector reference a REAL target: a specific DRAWING sheet
 * plus the tag of the equipment/instrument it ties into on that sheet.
 * The resolved reference is previewed live here and rendered on the glyph
 * itself (see EquipmentNode → symbol Geometry `label`). A target that no
 * longer resolves surfaces as a hard error in the validity panel.
 */
export default function OffpageTargetPanel({
  nodeId,
  data,
  sheets,
  currentSheetId,
  onUpdateData,
}: {
  nodeId: string;
  data: EquipmentNodeData;
  sheets: SheetRef[];
  currentSheetId: string;
  onUpdateData: (nodeId: string, patch: Partial<EquipmentNodeData>) => void;
}) {
  // An off-page connector ties into a DIFFERENT sheet by definition; the
  // current sheet is therefore not offered as a target.
  const targetable = sheets.filter((s) => s.id !== currentSheetId);
  const selectedSheet = sheets.find((s) => s.id === data.offpageTargetSheetId);
  const tagsOnTarget = (selectedSheet?.nodes ?? [])
    .map((n) => (n.data.tag ?? '').trim())
    .filter(Boolean)
    .sort();

  const ref = resolveOffpageRef(data, sheets);
  const preview =
    ref.status === 'resolved' || ref.status === 'incomplete'
      ? ref.label
      : ref.status === 'broken'
        ? `BROKEN REF — ${ref.problem}`
        : 'REF (no target chosen)';

  return (
    <div className="offpage-target-panel" data-testid="offpage-target-panel">
      <div className="nozzle-editor-header">
        <span>Off-Page Target</span>
      </div>

      {targetable.length === 0 ? (
        <div className="validation-empty" data-testid="offpage-no-target-sheets">
          Add another drawing sheet to point this connector at. An off-page/tie-in connector references a target on a
          different sheet.
        </div>
      ) : (
        <>
          <label className="data-sheet-field">
            <span>Target sheet</span>
            <select
              value={data.offpageTargetSheetId ?? ''}
              onChange={(e) => onUpdateData(nodeId, { offpageTargetSheetId: e.target.value || undefined })}
              data-testid="offpage-target-sheet-select"
            >
              <option value="" />
              {targetable.map((s) => (
                <option key={s.id} value={s.id}>
                  SH.{s.order + 1} — {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="data-sheet-field">
            <span>Target tag</span>
            <input
              list="offpage-target-tag-options"
              value={data.offpageTargetTag ?? ''}
              placeholder={selectedSheet ? 'e.g. TT-101' : 'choose a sheet first'}
              disabled={!selectedSheet}
              onChange={(e) => onUpdateData(nodeId, { offpageTargetTag: e.target.value || undefined })}
              data-testid="offpage-target-tag-input"
            />
            <datalist id="offpage-target-tag-options">
              {tagsOnTarget.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          {selectedSheet && tagsOnTarget.length === 0 && (
            <div className="validation-empty">Nothing tagged on SH.{selectedSheet.order + 1} yet.</div>
          )}
        </>
      )}

      <div
        className={`offpage-ref-preview offpage-ref-${ref.status}`}
        data-testid="offpage-ref-preview"
      >
        <span className="offpage-ref-caption">Resolved reference</span>
        <code>{preview}</code>
      </div>
    </div>
  );
}
