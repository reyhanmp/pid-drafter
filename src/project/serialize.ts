/**
 * Project JSON save/load (PRD §4.4) + localStorage autosave payload.
 *
 * ── Envelope schema (pid-drafter project file, version 2) ─────────────
 * {
 *   "schema": "pid-drafter/project",   // self-identifying marker
 *   "version": 2,                      // bump on breaking format changes
 *   "savedAt": "2026-09-12T10:00:00.000Z",
 *   "projectName": "Saponification Plant",
 *   "sheets": [                        // ordered; order field is authoritative
 *     {
 *       "id": "sheet-abc-1",
 *       "name": "Sheet 1",
 *       "order": 0,
 *       "nodes": [                     // react-flow nodes
 *         {
 *           "id": "vessel-vertical-17...",
 *           "type": "equipment",
 *           "position": { "x": 120, "y": 240 },
 *           "handles": [ { "id": "top", "type": "source", "position": "top" } ],
 *           "data": {
 *             "kind": "vessel-vertical",     // MUST exist in symbolsByKind
 *             "tag": "V-101",
 *             "width": 60, "height": 120,
 *             "rotation": 0,                  // 0 | 90 | 180 | 270
 *             "ports": [ { "id": "top", "label": "Top Nozzle", "x": 30,
 *                          "y": 0, "direction": { "x": 0, "y": -1 },
 *                          "kind": "process" } ],   // optional per-instance override
 *             "properties": { "designPressure": "6" },   // data-sheet bag
 *             "offpageTargetSheetId": "sheet-xyz-2",     // offpage-connector only
 *             "offpageTargetTag": "TT-101"               // offpage-connector only
 *           }
 *         }
 *       ],
 *       "edges": [                     // pipes / signal lines
 *         {
 *           "id": "pipe-a-top-b-in-17...",
 *           "source": "vessel-vertical-17...", "target": "pump-centrifugal-17...",
 *           "sourceHandle": "top", "targetHandle": "inlet",
 *           "type": "pipe",
 *           "data": { "lineType": "process", "lineNumber": "1\u00bd\"-LPS2-710.01",
 *                     "lineSize": "1.5\"", "materialOfConstruction": "Carbon Steel - ASME B16.5 Class 150",
 *                     "jacketed": false, "sourceDirection": {...}, "targetDirection": {...} }
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ──────────────────────────────────────────────────────────────────────
 *
 * Load is STRICT: unknown symbol kind, malformed/missing ports, bad
 * version, or unknown line type => a clear human-readable error and NO
 * partial state mutation (validation completes before the caller touches
 * state). Transient `__*` keys are stripped on save so they never leak
 * into a file.
 */
import type { Edge, Node } from '@xyflow/react';
import { symbolsByKind } from '../symbols';
import { PROJECT_SCHEMA_ID, PROJECT_VERSION, type Project, type ProjectSheet } from './types';
import { normalizeNumbering } from './numbering';
import { isLineType } from '../edges/lineKind';

/** File-format shape: the in-memory Project plus a schema marker + timestamp. */
export interface ProjectFileEnvelope {
  schema: typeof PROJECT_SCHEMA_ID;
  version: number;
  savedAt: string;
  projectName: string;
  /** Optional numbering config (PRD §4.3); absent in files written before v2.1. */
  numbering?: unknown;
  sheets: ProjectSheet[];
}

export interface LoadResult {
  ok: boolean;
  project?: Project;
  /** Human-readable reasons the file was rejected. Empty when ok. */
  errors: string[];
}

/** Strip transient, app-computed keys (all `__`-prefixed) from node data. */
function sanitizeNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('__')) continue;
    out[k] = v;
  }
  return out;
}

/** Serialize the current project into a versioned, self-describing envelope. */
export function serializeProject(project: Project): ProjectFileEnvelope {
  return {
    schema: PROJECT_SCHEMA_ID,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    projectName: project.projectName,
    numbering: normalizeNumbering(project.numbering),
    sheets: project.sheets.map((s) => ({
      ...s,
      nodes: s.nodes.map((n) => ({ ...n, data: sanitizeNodeData(n.data as Record<string, unknown>) })),
    })),
  };
}

/** Pretty-printed JSON text for download. */
export function projectToJson(project: Project): string {
  return JSON.stringify(serializeProject(project), null, 2);
}

/** Filesystem-safe filename derived from the project name. */
export function projectFileName(projectName: string): string {
  const base = (projectName || 'untitled')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'untitled'}.pidproj.json`;
}

const ROTATIONS = new Set([0, 90, 180, 270]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validate one node. Returns a list of human-readable problems (empty = valid). */
function validateNode(raw: unknown, where: string): string[] {
  const errs: string[] = [];
  if (!raw || typeof raw !== 'object') return [`${where}: not an object`];
  const n = raw as Record<string, unknown>;

  if (typeof n.id !== 'string' || !n.id) errs.push(`${where}: missing node id`);
  const pos = n.position as Record<string, unknown> | undefined;
  if (!pos || !isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) {
    errs.push(`${where}: position must be { x: number, y: number }`);
  }

  const data = n.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    errs.push(`${where}: missing node data`);
    return errs;
  }

  const kind = data.kind;
  if (typeof kind !== 'string' || !kind) {
    errs.push(`${where}: missing symbol kind`);
  } else if (!symbolsByKind[kind]) {
    errs.push(`${where}: unknown symbol kind "${kind}" — this symbol no longer exists in the palette`);
  }

  if (typeof data.tag !== 'string') errs.push(`${where}: missing tag`);
  if (!isFiniteNumber(data.width) || !isFiniteNumber(data.height)) {
    errs.push(`${where}: width/height must be numbers`);
  }
  if (data.rotation !== undefined && !ROTATIONS.has(data.rotation as number)) {
    errs.push(`${where}: rotation must be 0, 90, 180 or 270`);
  }
  if (data.properties !== undefined) {
    if (typeof data.properties !== 'object' || data.properties === null || Array.isArray(data.properties)) {
      errs.push(`${where}: properties must be an object`);
    }
  }

  // Ports: malformed ports would silently break the connection system, so
  // they are a hard import failure rather than a repaired field.
  if (data.ports !== undefined) {
    if (!Array.isArray(data.ports)) {
      errs.push(`${where}: ports must be an array of nozzle definitions`);
    } else {
      (data.ports as unknown[]).forEach((p, i) => {
        if (!p || typeof p !== 'object') {
          errs.push(`${where}: port #${i + 1} is not an object`);
          return;
        }
        const port = p as Record<string, unknown>;
        if (typeof port.id !== 'string' || !port.id) errs.push(`${where}: port #${i + 1} missing id`);
        if (!isFiniteNumber(port.x) || !isFiniteNumber(port.y)) errs.push(`${where}: port #${i + 1} missing numeric x/y`);
        const dir = port.direction as Record<string, unknown> | undefined;
        if (!dir || !isFiniteNumber(dir.x) || !isFiniteNumber(dir.y)) {
          errs.push(`${where}: port #${i + 1} missing direction normal { x, y }`);
        }
        if (port.kind !== 'process' && port.kind !== 'signal') {
          errs.push(`${where}: port #${i + 1} kind must be "process" or "signal"`);
        }
      });
    }
  }

  // Off-page connector targets must be strings when present.
  if (data.offpageTargetSheetId !== undefined && typeof data.offpageTargetSheetId !== 'string') {
    errs.push(`${where}: offpageTargetSheetId must be a string`);
  }
  if (data.offpageTargetTag !== undefined && typeof data.offpageTargetTag !== 'string') {
    errs.push(`${where}: offpageTargetTag must be a string`);
  }

  return errs;
}

/** Validate one edge (pipe / signal line). */
function validateEdge(raw: unknown, where: string, nodeIds: Set<string>): string[] {
  const errs: string[] = [];
  if (!raw || typeof raw !== 'object') return [`${where}: not an object`];
  const e = raw as Record<string, unknown>;

  // FREE LINE: attached to NO equipment, so it has no source/target node
  // ids and no handles. This must be checked BEFORE the node-id rules
  // below, otherwise a project containing a free line fails to load
  // entirely (caught by scripts/verify-freeline.cjs: "missing source
  // equipment id" for a perfectly valid free line).
  const freeData = e.data as Record<string, unknown> | undefined;
  if (freeData?.freePipe === true) {
    if (typeof e.id !== 'string' || !e.id) errs.push(`${where}: missing pipe id`);
    const badPoint = (v: unknown) =>
      !v || typeof v !== 'object' ||
      !Number.isFinite((v as Record<string, unknown>).x) ||
      !Number.isFinite((v as Record<string, unknown>).y);
    if (badPoint(freeData.freeStart)) errs.push(`${where}: free line is missing valid start coordinates`);
    if (badPoint(freeData.freeEnd)) errs.push(`${where}: free line is missing valid end coordinates`);
    return errs;
  }

  if (typeof e.id !== 'string' || !e.id) errs.push(`${where}: missing pipe id`);
  if (typeof e.source !== 'string' || !e.source) errs.push(`${where}: missing source equipment id`);
  if (typeof e.target !== 'string' || !e.target) errs.push(`${where}: missing target equipment id`);
  if (typeof e.source === 'string' && !nodeIds.has(e.source)) {
    errs.push(`${where}: source equipment "${e.source}" is not on this sheet`);
  }
  if (typeof e.target === 'string' && !nodeIds.has(e.target)) {
    errs.push(`${where}: target equipment "${e.target}" is not on this sheet`);
  }
  const data = e.data as Record<string, unknown> | undefined;
  if (data && data.lineType !== undefined && !isLineType(data.lineType)) {
    errs.push(
      `${where}: line type must be "process" (pipe), "signal" (signal line) or "boundary" (battery limit)`,
    );
  }

  return errs;
}

/**
 * Strictly parse a project file. Returns ok:false with every problem found
 * when anything is wrong — the caller must NOT mutate state in that case.
 */
export function parseProjectJson(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`Not a valid JSON file: ${(err as Error).message}`] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Top level of the file must be a JSON object.'] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (obj.schema !== undefined && obj.schema !== PROJECT_SCHEMA_ID) {
    errors.push(`Unrecognised schema marker "${String(obj.schema)}" — expected "${PROJECT_SCHEMA_ID}".`);
  }

  const version = obj.version;
  if (version === undefined) {
    errors.push('Missing "version" field — this does not look like a PID Drafter project file.');
  } else if (version !== PROJECT_VERSION) {
    errors.push(`Unsupported project version ${String(version)} — this build reads version ${PROJECT_VERSION}.`);
  }

  if (typeof obj.projectName !== 'string') {
    errors.push('Missing "projectName" text.');
  }

  if (!Array.isArray(obj.sheets) || obj.sheets.length === 0) {
    errors.push('The file has no sheets — a project needs at least one drawing sheet.');
  }

  // Bail before deeper structural checks if the envelope itself is unusable.
  if (errors.length > 0) return { ok: false, errors };

  const sheets = obj.sheets as unknown[];
  const seenSheetIds = new Set<string>();
  const parsedSheets: ProjectSheet[] = [];

  sheets.forEach((rawSheet, si) => {
    const label = `Sheet #${si + 1}`;
    if (!rawSheet || typeof rawSheet !== 'object') {
      errors.push(`${label}: not an object`);
      return;
    }
    const s = rawSheet as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id) errors.push(`${label}: missing sheet id`);
    else if (seenSheetIds.has(s.id)) errors.push(`${label}: duplicate sheet id "${s.id}"`);
    else seenSheetIds.add(s.id);
    if (typeof s.name !== 'string' || !s.name) errors.push(`${label}: missing sheet name`);
    if (!Array.isArray(s.nodes)) errors.push(`${label}: nodes must be an array`);
    if (!Array.isArray(s.edges)) errors.push(`${label}: edges must be an array`);
    if (errors.length > 0) return;

    const name = s.name as string;
    const nodes = s.nodes as unknown[];
    const nodeProblems: string[] = [];
    nodes.forEach((n, ni) => {
      nodeProblems.push(...validateNode(n, `${label} "${name}" · equipment #${ni + 1}`));
    });

    const nodeIds = new Set(nodes.map((n) => (n as { id?: unknown }).id).filter((v): v is string => typeof v === 'string'));
    const edgeProblems: string[] = [];
    (s.edges as unknown[]).forEach((e, ei) => {
      edgeProblems.push(...validateEdge(e, `${label} "${name}" · pipe #${ei + 1}`, nodeIds));
    });

    errors.push(...nodeProblems, ...edgeProblems);
    if (nodeProblems.length > 0 || edgeProblems.length > 0) return;

    parsedSheets.push({
      id: s.id as string,
      name,
      order: typeof s.order === 'number' && Number.isFinite(s.order) ? s.order : si,
      nodes: nodes as Node[],
      edges: s.edges as Edge[],
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const project: Project = {
    version: version as number,
    projectName: obj.projectName as string,
    // A missing or partial `numbering` block is NOT an error: every project
    // saved before this field existed must still load, and normalizeNumbering
    // fills in defaults that reproduce the previous hardcoded behaviour.
    numbering: normalizeNumbering(obj.numbering),
    sheets: parsedSheets.slice().sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i })),
  };
  return { ok: true, project, errors: [] };
}

/** Strip transient keys from a loaded project so nothing stale is revived. */
export function hydrateTransientClean(project: Project): Project {
  return {
    ...project,
    sheets: project.sheets.map((s) => ({
      ...s,
      nodes: s.nodes.map((n) => ({ ...n, data: sanitizeNodeData(n.data as Record<string, unknown>) })),
    })),
  };
}
