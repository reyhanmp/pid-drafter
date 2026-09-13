/**
 * Auto-generated engineering lists (PRD §4.6).
 *
 * DERIVED VIEWS, NOT A SECOND DATASET. Every row here is computed from the
 * project's existing structured data on each render. There is no stored
 * list, no "generate" step that can go stale, and no way for a list to
 * disagree with the diagram — if you want a row gone, you delete the thing
 * on the canvas. That is the whole design: the diagram is the source of
 * truth, and these are lenses on it.
 *
 * SCOPE. A node belongs to at most one list, decided by its SYMBOL CATEGORY
 * (the symbol definition's own `category`, not a hardcoded kind list):
 *
 *   Instruments, Signal & Logic  -> instrument index (loop-tagged functions)
 *   Valves                       -> valve list
 *   Vessels, Columns, Reactors,
 *   Pumps, Heat Exchangers,
 *   Agitators, Piping Accessories-> equipment list
 *
 * `Piping Accessories` sits in the equipment list rather than a fifth list
 * because those items (strainers, spectacle blinds, steam traps, orifice
 * plates) are tagged, procured, physical items — the exact reason you make
 * an equipment list. `Terminators` (vent/drain/off-page) are deliberately
 * in NO list: they are line-end annotations and reference markers, not
 * items anyone purchases. The UI reports that excluded count so the gap is
 * visible rather than silent.
 *
 * NOZZLE SCHEDULE (§4.9.3). Every nozzle on every pressurised item, with the
 * equipment it belongs to, its size, its rating, and what is connected to it.
 * Held together with the other lists rather than in a separate dataset — the
 * rows are read straight off each node's effective ports, so adding a nozzle to
 * a vessel adds a schedule row with no extra step. Membership is scoped to
 * equipment items, since a nozzle is a connection on a physical item; an
 * instrument's signal port is a wire termination, not a nozzle.
 *
 * MULTI-SHEET ADDITION (§4.8 postdates §4.6). Every list carries a Sheet
 * column. §4.6 was written when one diagram = one sheet; with multiple
 * sheets, a line/valve/instrument row without a sheet is ambiguous the
 * moment two sheets both have a "V-101"-style tag pattern.
 */
import { symbolsByKind } from '../symbols';
import { getEffectivePorts } from '../symbols/effectivePorts';
import type { SymbolCategory } from '../symbols/types';
import type { ProjectSheet } from '../project/types';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';
import { parseLoopNumber } from '../validation/instrumentLoops';
import { fieldsForKind } from '../dataSheet/fieldSchemas';

const INSTRUMENT_CATEGORIES: ReadonlySet<SymbolCategory> = new Set(['Instruments', 'Signal & Logic']);
const VALVE_CATEGORIES: ReadonlySet<SymbolCategory> = new Set(['Valves']);

/** Categories that intentionally appear in no list — line-end annotations. */
const UNLISTED_CATEGORIES: ReadonlySet<SymbolCategory> = new Set(['Terminators']);

/**
 * Categories whose ports are real nozzles and therefore belong on the nozzle
 * schedule (§4.9.3). Instruments and signal/logic functions are excluded: their
 * single port is an electrical termination, not a flanged connection, and
 * terminators have no nozzles at all.
 */
const NOZZLE_SCHEDULE_CATEGORIES: ReadonlySet<SymbolCategory> = new Set([
  'Vessels', 'Columns', 'Reactors', 'Pumps', 'Heat Exchangers', 'Agitators', 'Piping Accessories',
]);

export type ListRow = Record<string, string>;

export interface EngineeringList {
  id: 'lines' | 'valves' | 'instruments' | 'equipment' | 'nozzles';
  title: string;
  /** Column keys in display order; the row labels come from COLUMN_LABELS. */
  columns: string[];
  rows: ListRow[];
  /** Set when the list is empty, to explain why rather than showing a bare table. */
  emptyHint: string;
}

export interface EngineeringListsResult {
  lists: EngineeringList[];
  /** Count of placed nodes that belong to no list (annotations), by category. */
  unlisted: Record<string, number>;
}

export const COLUMN_LABELS: Record<string, string> = {
  sheet: 'Sheet',
  lineNumber: 'Line No.',
  equipmentTag: 'Equipment Tag',
  nozzle: 'Nozzle ID',
  nozzleLabel: 'Description',
  nozzleSize: 'Size',
  nozzleRating: 'Rating',
  nozzleConnection: 'Connected To',
  lineType: 'Type',
  lineSize: 'Size',
  lineName: 'Service',
  material: 'Spec / MoC',
  jacketed: 'Jacketed',
  source: 'From',
  destination: 'To',
  tag: 'Tag',
  valveType: 'Type',
  onLine: 'Line',
  instrumentFunction: 'Function',
  loopNumber: 'Loop',
  service: 'Service / Description',
  equipmentType: 'Type',
  keyDataSheet: 'Key Data',
};

/** ISA-5.1 first-letter + common function codes, for readable list entries. */
const INSTRUMENT_FUNCTION_NAMES: Record<string, string> = {
  FT: 'Flow Transmitter',
  FI: 'Flow Indicator',
  FIC: 'Flow Indicating Controller',
  FC: 'Flow Controller',
  FE: 'Flow Element',
  PT: 'Pressure Transmitter',
  PI: 'Pressure Indicator',
  PIC: 'Pressure Indicating Controller',
  PC: 'Pressure Controller',
  PDT: 'Differential Pressure Transmitter',
  PDI: 'Differential Pressure Indicator',
  TT: 'Temperature Transmitter',
  TI: 'Temperature Indicator',
  TIC: 'Temperature Indicating Controller',
  TC: 'Temperature Controller',
  TE: 'Temperature Element',
  LT: 'Level Transmitter',
  LI: 'Level Indicator',
  LIC: 'Level Indicating Controller',
  LC: 'Level Controller',
  LS: 'Level Switch',
  AT: 'Analyzer Transmitter',
  AI: 'Analyzer Indicator',
  AIC: 'Analyzer Indicating Controller',
  PSV: 'Pressure Safety Valve',
  TSV: 'Temperature Safety Valve',
  ZSO: 'Position Switch (Open)',
  ZSC: 'Position Switch (Closed)',
  I: 'Logic / Relay Function',
};

/**
 * Function code = the leading alphabetic run of the tag ("TT-101" -> "TT").
 * Falls back to the whole tag when there is no alpha prefix, so a malformed
 * tag shows up as itself in the list rather than as a blank cell.
 */
export function instrumentFunctionCode(tag: string | undefined): string {
  if (!tag) return '';
  const m = tag.trim().match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : tag.trim();
}

/** Human-readable expansion of the tag's function code, or the code itself. */
function instrumentFunctionLabel(tag: string | undefined): string {
  const code = instrumentFunctionCode(tag);
  const name = INSTRUMENT_FUNCTION_NAMES[code];
  return name ? `${code} — ${name}` : code;
}

/**
 * Priority-ordered data-sheet fields worth surfacing in the equipment list.
 *
 * Ordered by what a process engineer reads first: what it does, then the
 * design envelope, then the duty/performance figure that sizes it, then
 * mechanical. Not every symbol has every field — the loop below simply skips
 * unpopulated ids, so one order works across all categories and the list
 * still reads top-down in a sensible order per row.
 */
const KEY_FIELD_ORDER = [
  // Process duty
  'service',
  'fluidPumped',
  'reactionType',
  'columnType',
  'exchangerType',
  'reactorType',
  'pumpType',
  'meterType',
  'impellerType',
  'valveType',
  // Design envelope
  'designPressure',
  'designTemperature',
  'designPressureShell',
  'designPressureTube',
  'operatingPressure',
  'operatingTemperature',
  'designCode',
  'pressureRating',
  // Sizing / performance
  'designFlowRate',
  'designHead',
  'duty',
  'firingRate',
  'boilupRate',
  'evaporationRate',
  'volume',
  'area',
  'overallU',
  'lmtd',
  'powerRating',
  'driverPower',
  'speed',
  'npshAvailable',
  'conversion',
  'residenceTime',
  'refluxRatio',
  'numberOfStages',
  // Mechanical
  'materialOfConstruction',
  'bodyMaterial',
  'shellMaterial',
  'tubeMaterial',
  'size',
  'endConnection',
  'insulation',
];

/**
 * Join the populated "key" data-sheet fields for a node into one cell,
 * labelled with the field's own label + unit. Field sets differ per
 * category (a pump has no design pressure but does have a design head), so
 * this reads the node's own field schema rather than assuming a fixed set —
 * no per-category branching needed.
 */
function keyDataSheetCell(node: EquipmentNodeData): string {
  const symbol = symbolsByKind[node.kind];
  if (!symbol) return '';
  const props = node.properties ?? {};
  const known = new Map(fieldsForKind(node.kind, symbol.category).map((f) => [f.id, f]));
  const parts: string[] = [];
  for (const id of KEY_FIELD_ORDER) {
    const raw = props[id];
    if (!raw || !String(raw).trim()) continue;
    const field = known.get(id);
    const label = field?.label ?? id;
    const unit = field?.unit ? ` ${field.unit}` : '';
    parts.push(`${label}: ${String(raw).trim()}${unit}`);
  }
  return parts.join(' · ');
}

/** Human-friendly valve type from the symbol label ("Gate Valve" -> "Gate"). */
function valveTypeLabel(kind: string): string {
  const symbol = symbolsByKind[kind];
  const label = symbol?.label ?? kind;
  return label.replace(/\s*Valve\s*$/i, '').replace(/\s*\(.*\)$/, '').trim() || label;
}

/** True for free lines — drawn into empty space, seated on no nozzle. */
function isFreeLine(data: PipeEdgeData | undefined): boolean {
  return data?.freePipe === true;
}

/**
 * Build all four lists from the current project.
 *
 * `sheets` is the ordered sheet list straight from the store. Sheet name is
 * resolved per row, so a row always states where it lives.
 */
export function buildEngineeringLists(sheets: ProjectSheet[]): EngineeringListsResult {
  const ordered = [...sheets].sort((a, b) => a.order - b.order);

  const lineRows: ListRow[] = [];
  const valveRows: ListRow[] = [];
  const instrumentRows: ListRow[] = [];
  const equipmentRows: ListRow[] = [];
  const nozzleRows: ListRow[] = [];
  const unlisted: Record<string, number> = {};

  for (const sheet of ordered) {
    /** node id -> tag, for resolving a line's endpoints to real tags. */
    const tagById = new Map<string, string>();
    for (const n of sheet.nodes) {
      const data = n.data as unknown as EquipmentNodeData;
      tagById.set(n.id, (data.tag ?? '').trim());
    }

    /** node id -> line numbers of pipes attached to it (for the valve list). */
    const linesByNodeId = new Map<string, string[]>();
    const sizesByNodeId = new Map<string, string>();
    /**
     * node id -> (port id -> what is on the far end), for the nozzle schedule's
     * "Connected To" column. A nozzle with no pipe is a SPARE, and saying so is
     * the point of a schedule — a blank cell is ambiguous between "spare" and
     * "not filled in yet", so the column carries the explicit text instead.
     *
     * The far end is reported as the other item's TAG when it has one,
     * otherwise its line number when the pipe is a free line running to empty
     * space, because either can be the only identifying information available.
     */
    const nodeById = new Map(sheet.nodes.map((n) => [n.id, n]));
    const connectedByPort = new Map<string, Map<string, string>>();
    for (const e of sheet.edges) {
      const data = e.data as unknown as PipeEdgeData | undefined;
      if (isFreeLine(data)) continue; // free lines seat on no node
      const label = (data?.lineNumber ?? '').trim();
      for (const nodeId of [e.source, e.target]) {
        if (!nodeId) continue;
        if (label) {
          const existing = linesByNodeId.get(nodeId) ?? [];
          if (!existing.includes(label)) existing.push(label);
          linesByNodeId.set(nodeId, existing);
        }
        const size = (data?.lineSize ?? '').trim();
        if (size && !sizesByNodeId.has(nodeId)) sizesByNodeId.set(nodeId, size);
      }
      // Record both directions, each keyed by the port it attaches to.
      // DiagramEdge.endpoints are nullable in the type; an edge missing one is
      // already a validation error, so skipping it here is safe.
      const ends: Array<[string | null | undefined, string | null | undefined, string | null | undefined]> = [
        [e.source, e.sourceHandle, e.target],
        [e.target, e.targetHandle, e.source],
      ];
      for (const [fromId, fromHandle, otherId] of ends) {
        if (!fromId || !fromHandle || !otherId) continue;
        const otherTag = (nodeById.get(otherId)?.data as unknown as EquipmentNodeData | undefined)?.tag?.trim();
        const far = otherTag || label || '(unlabelled)';
        const bucket = connectedByPort.get(fromId) ?? new Map<string, string>();
        if (!bucket.has(fromHandle)) bucket.set(fromHandle, far);
        connectedByPort.set(fromId, bucket);
      }
    }

    // ── Line list: one row per pipe/signal line ──
    for (const e of sheet.edges) {
      const data = e.data as unknown as PipeEdgeData | undefined;
      const free = isFreeLine(data);
      lineRows.push({
        sheet: sheet.name,
        lineNumber: (data?.lineNumber ?? '').trim() || '(unnumbered line)',
        lineType: data?.lineType === 'signal' ? 'Signal' : 'Process',
        lineSize: (data?.lineSize ?? '').trim(),
        lineName: (data?.lineName ?? '').trim(),
        material: (data?.materialOfConstruction ?? '').trim(),
        jacketed: data?.jacketed ? 'Yes' : '',
        // A free line is seated on nothing by design (PRD §4.1 carve-out), so
        // say so explicitly rather than leaving two empty cells that read
        // like missing data.
        source: free ? '(free line)' : tagById.get(e.source) ?? e.source ?? '',
        destination: free ? '(free line)' : tagById.get(e.target) ?? e.target ?? '',
      });
    }

    // ── Per-node lists ──
    for (const n of sheet.nodes) {
      const data = n.data as unknown as EquipmentNodeData;
      const symbol = symbolsByKind[data.kind];
      if (!symbol) continue; // unknown kind: validation already flags this
      const category = symbol.category;

      if (UNLISTED_CATEGORIES.has(category)) {
        unlisted[category] = (unlisted[category] ?? 0) + 1;
        continue;
      }

      if (INSTRUMENT_CATEGORIES.has(category)) {
        instrumentRows.push({
          sheet: sheet.name,
          tag: (data.tag ?? '').trim(),
          instrumentFunction: instrumentFunctionLabel(data.tag),
          loopNumber: data.loopNumber?.trim() || parseLoopNumber(data.tag) || '',
          service: (data.properties?.service ?? '').trim(),
        });
        continue;
      }

      if (VALVE_CATEGORIES.has(category)) {
        const lines = linesByNodeId.get(n.id) ?? [];
        valveRows.push({
          sheet: sheet.name,
          tag: (data.tag ?? '').trim(),
          valveType: valveTypeLabel(data.kind),
          onLine: lines.join(' / '),
          // Prefer the valve's own declared size; fall back to the size of the
          // line it sits on, which is the useful figure when the data sheet
          // has not been filled in yet.
          size: (data.properties?.size ?? '').trim() || sizesByNodeId.get(n.id) || '',
        });
        continue;
      }

      // ── Nozzle schedule rows for this item (§4.9.3) ──
      // Read from the EFFECTIVE ports (instance override or symbol default) so
      // a nozzle the engineer added on this node appears here immediately, and
      // one they deleted disappears. Position is deliberately not a column —
      // it is unpickable geometry, not a procurement fact.
      const effectivePorts = getEffectivePorts(data.kind, data.ports);
      if (NOZZLE_SCHEDULE_CATEGORIES.has(category)) {
        const connectedTo = connectedByPort.get(n.id) ?? new Map<string, string>();
        for (const port of effectivePorts) {
          if (port.kind !== 'process') continue; // signal ports are terminations
          nozzleRows.push({
            sheet: sheet.name,
            equipmentTag: (data.tag ?? '').trim() || '(untagged)',
            nozzle: port.id,
            nozzleLabel: port.label ?? '',
            nozzleSize: (port.size ?? '').trim(),
            nozzleRating: (port.rating ?? '').trim(),
            nozzleConnection: connectedTo.get(port.id) ?? 'SPARE — no connection',
          });
        }
      }

      equipmentRows.push({
        sheet: sheet.name,
        tag: (data.tag ?? '').trim(),
        equipmentType: symbol.label,
        service: (data.properties?.service ?? '').trim(),
        keyDataSheet: keyDataSheetCell(data),
      });
    }
  }

  const sortBySheetThenTag = (rows: ListRow[], key: string) =>
    rows.sort(
      (a, b) => a.sheet.localeCompare(b.sheet) || (a[key] ?? '').localeCompare(b[key] ?? '', undefined, { numeric: true }),
    );

  return {
    lists: [
      {
        id: 'lines',
        title: 'Line List',
        columns: ['sheet', 'lineNumber', 'lineType', 'lineSize', 'lineName', 'material', 'jacketed', 'source', 'destination'],
        rows: sortBySheetThenTag(lineRows, 'lineNumber'),
        emptyHint: 'No lines yet. Connect two ports, or drag from a port into empty space to draw a free line.',
      },
      {
        id: 'valves',
        title: 'Valve List',
        columns: ['sheet', 'tag', 'valveType', 'onLine', 'size'],
        rows: sortBySheetThenTag(valveRows, 'tag'),
        emptyHint: 'No valves on the canvas yet.',
      },
      {
        id: 'instruments',
        title: 'Instrument Index',
        columns: ['sheet', 'tag', 'instrumentFunction', 'loopNumber', 'service'],
        rows: sortBySheetThenTag(instrumentRows, 'tag'),
        emptyHint: 'No instruments on the canvas yet.',
      },
      {
        id: 'equipment',
        title: 'Equipment List',
        columns: ['sheet', 'tag', 'equipmentType', 'service', 'keyDataSheet'],
        rows: sortBySheetThenTag(equipmentRows, 'tag'),
        emptyHint: 'No equipment on the canvas yet.',
      },
      {
        id: 'nozzles',
        title: 'Nozzle Schedule',
        columns: ['sheet', 'equipmentTag', 'nozzle', 'nozzleLabel', 'nozzleSize', 'nozzleRating', 'nozzleConnection'],
        rows: nozzleRows.sort(
          (a, b) =>
            a.sheet.localeCompare(b.sheet) ||
            (a.equipmentTag ?? '').localeCompare(b.equipmentTag ?? '', undefined, { numeric: true }) ||
            (a.nozzle ?? '').localeCompare(b.nozzle ?? '', undefined, { numeric: true }),
        ),
        emptyHint: 'No nozzles yet. Every pressure-retaining item declares at least one nozzle by default.',
      },
    ],
    unlisted,
  };
}

/** Escape one CSV cell: quote when it contains a comma, quote, or newline. */
function csvCell(value: string): string {
  const v = value ?? '';
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Render a list as CSV. Header row uses the human labels (not internal
 * keys) so the file is readable by whoever receives it, not just by this
 * app. Always emits a trailing newline — POSIX text convention.
 */
export function listToCsv(list: EngineeringList): string {
  const header = list.columns.map((c) => csvCell(COLUMN_LABELS[c] ?? c)).join(',');
  const body = list.rows.map((row) => list.columns.map((c) => csvCell(row[c] ?? '')).join(','));
  return [header, ...body, ''].join('\n');
}

/** Suggested download name, e.g. "My Project - Line List.csv". */
export function listCsvFileName(projectName: string, list: EngineeringList): string {
  const base = (projectName || 'pid-project').replace(/[^\w\-. ]+/g, '_').trim() || 'pid-project';
  return `${base} - ${list.title}.csv`;
}
