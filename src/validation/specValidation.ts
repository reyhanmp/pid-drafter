/**
 * Spec-driven soft validation (PRD §4.1 / §4.7 revision note).
 *
 * A line carries an assigned piping spec — material of construction +
 * pressure class, from `MATERIAL_OF_CONSTRUCTION_OPTIONS` (see
 * src/types/diagram.ts). Components placed on that line declare their
 * OWN material/rating via free-text data-sheet fields (`materialOfConstruction`
 * on vessels/pumps/heat exchangers/agitators, `bodyMaterial` +
 * `pressureRating` on valves — see src/dataSheet/fieldSchemas.ts).
 *
 * Since component fields are free text (engineers type whatever's on the
 * real data sheet) while the line spec is a constrained dropdown, this
 * is necessarily a heuristic match, not an exact string comparison:
 * both sides are parsed into a coarse material family + a numeric
 * pressure class, then compared. This is intentionally a SOFT warning
 * (visible, listed, non-blocking) — never a hard validation error — so
 * false positives from the free-text heuristic never block export.
 */
import { symbolsByKind } from '../symbols';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';

export interface SpecDiagramNode {
  id: string;
  data: EquipmentNodeData;
}

export interface SpecDiagramEdge {
  id: string;
  source: string;
  target: string;
  data?: PipeEdgeData;
}

export type SpecWarningKind = 'material-mismatch' | 'pressure-class-mismatch';

export interface SpecWarning {
  kind: SpecWarningKind;
  message: string;
  nodeIds: string[];
  edgeId: string;
}

/** Coarse material family buckets — specific alloys/grades within a bucket are treated as compatible with each other. */
type MaterialFamily =
  | 'carbon-steel'
  | 'stainless-steel'
  | 'duplex-stainless-steel'
  | 'chrome-moly-alloy-steel'
  | 'plastic'
  | 'copper';

/** Ordered longest-substring-first so e.g. "Stainless Steel 316L" matches before a bare "Stainless Steel". */
const MATERIAL_FAMILY_KEYWORDS: Array<{ pattern: RegExp; family: MaterialFamily }> = [
  { pattern: /duplex stainless steel/i, family: 'duplex-stainless-steel' },
  { pattern: /stainless steel/i, family: 'stainless-steel' },
  { pattern: /\bss\s?3\d\dl?\b/i, family: 'stainless-steel' },
  { pattern: /chrome-?moly/i, family: 'chrome-moly-alloy-steel' },
  { pattern: /carbon steel/i, family: 'carbon-steel' },
  { pattern: /\bcs\b/i, family: 'carbon-steel' },
  { pattern: /ptfe-lined carbon steel/i, family: 'carbon-steel' },
  { pattern: /\bcpvc\b/i, family: 'plastic' },
  { pattern: /\bpvc\b/i, family: 'plastic' },
  { pattern: /\bhdpe\b/i, family: 'plastic' },
  { pattern: /\bptfe\b/i, family: 'plastic' },
  { pattern: /\bcopper\b/i, family: 'copper' },
];

const FAMILY_LABEL: Record<MaterialFamily, string> = {
  'carbon-steel': 'carbon steel',
  'stainless-steel': 'stainless steel',
  'duplex-stainless-steel': 'duplex stainless steel',
  'chrome-moly-alloy-steel': 'chrome-moly alloy steel',
  plastic: 'plastic (PVC/CPVC/PTFE/HDPE)',
  copper: 'copper',
};

function parseMaterialFamily(text: string | undefined): MaterialFamily | null {
  if (!text) return null;
  for (const { pattern, family } of MATERIAL_FAMILY_KEYWORDS) {
    if (pattern.test(text)) return family;
  }
  return null;
}

/** Extract an ASME/ANSI pressure class number (150/300/600/900/1500/2500) from free text like "ASME B16.5 Class 300" or "ANSI 300#". */
function parsePressureClass(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(?:class|ansi|#)\s*[:#]?\s*(150|300|600|900|1500|2500)\b/i) ?? text.match(/\b(150|300|600|900|1500|2500)\s*#/);
  return match ? Number(match[1]) : null;
}

/** A component's own declared material/rating text, pulled from whichever data-sheet field applies to its category. */
function componentDeclaredSpec(node: SpecDiagramNode): { materialText: string | null; pressureText: string | null } {
  const props = node.data.properties ?? {};
  // Valves declare body material + pressure rating separately; everything
  // else with a rich data sheet uses a single combined "materialOfConstruction" field.
  const materialText = props.bodyMaterial ?? props.materialOfConstruction ?? null;
  const pressureText = props.pressureRating ?? props.materialOfConstruction ?? null;
  return { materialText, pressureText };
}

/** Whether a node's symbol category has a data-sheet field worth checking at all (skip instruments, terminators, etc.). */
function hasCheckableSpecFields(node: SpecDiagramNode): boolean {
  const symbol = symbolsByKind[node.data.kind];
  if (!symbol) return false;
  return symbol.category === 'Vessels' || symbol.category === 'Pumps' || symbol.category === 'Valves' || symbol.category === 'Heat Exchangers' || symbol.category === 'Reactors' || symbol.category === 'Columns';
}

/**
 * Compare one line's assigned spec against one endpoint component's
 * declared material/rating, returning any soft warnings. A component
 * with no declared spec field filled in yet produces no warning (nothing
 * to contradict) — this only fires once there's an actual, comparable
 * mismatch, not for incomplete data sheets.
 */
function checkEndpoint(edge: SpecDiagramEdge, lineSpec: string, node: SpecDiagramNode): SpecWarning[] {
  if (!hasCheckableSpecFields(node)) return [];
  const { materialText, pressureText } = componentDeclaredSpec(node);
  const warnings: SpecWarning[] = [];

  const lineFamily = parseMaterialFamily(lineSpec);
  const componentFamily = parseMaterialFamily(materialText ?? undefined);
  if (lineFamily && componentFamily && lineFamily !== componentFamily) {
    warnings.push({
      kind: 'material-mismatch',
      message: `${node.data.tag || node.id}: declared material (${FAMILY_LABEL[componentFamily]}) does not match line spec (${FAMILY_LABEL[lineFamily]}) on pipe ${edge.id}`,
      nodeIds: [node.id],
      edgeId: edge.id,
    });
  }

  const lineClass = parsePressureClass(lineSpec);
  const componentClass = parsePressureClass(pressureText ?? undefined);
  if (lineClass && componentClass && componentClass < lineClass) {
    warnings.push({
      kind: 'pressure-class-mismatch',
      message: `${node.data.tag || node.id}: declared rating (Class ${componentClass}) is below the line spec's pressure class (Class ${lineClass}) on pipe ${edge.id}`,
      nodeIds: [node.id],
      edgeId: edge.id,
    });
  }

  return warnings;
}

/**
 * Run spec-driven soft validation across every line that carries a
 * material-of-construction/pressure-class spec, checking both endpoint
 * components' own declared material/rating data-sheet fields against it.
 */
export function validateSpecCompatibility(nodes: SpecDiagramNode[], edges: SpecDiagramEdge[]): SpecWarning[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const warnings: SpecWarning[] = [];

  for (const edge of edges) {
    const lineSpec = edge.data?.materialOfConstruction;
    if (!lineSpec) continue; // no spec assigned to this line yet — nothing to check against

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (sourceNode) warnings.push(...checkEndpoint(edge, lineSpec, sourceNode));
    if (targetNode) warnings.push(...checkEndpoint(edge, lineSpec, targetNode));
  }

  return warnings;
}
