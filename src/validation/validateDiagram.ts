/**
 * Validity engine — pure functions over plain node/edge data, decoupled
 * from react-flow internals so it's testable in isolation and reusable
 * by a future export/print pipeline.
 */
import { symbolsByKind } from '../symbols/index';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';

export interface DiagramNode {
  id: string;
  data: EquipmentNodeData;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PipeEdgeData;
}

export type ValidationErrorKind = 'duplicate-tag' | 'unconnected-pipe';

export interface ValidationError {
  kind: ValidationErrorKind;
  message: string;
  /** Node ids implicated in this error, e.g. both nodes sharing a duplicate tag. */
  nodeIds: string[];
  /** Edge id implicated, if this is a pipe-connection error. */
  edgeId?: string;
}

export interface ValidationResult {
  errors: ValidationError[];
}

/** Rule 1: every equipment/instrument tag must be unique. */
function checkUniqueTags(nodes: DiagramNode[]): ValidationError[] {
  const byTag = new Map<string, string[]>();
  for (const node of nodes) {
    const tag = (node.data.tag ?? '').trim();
    if (!tag) continue;
    const ids = byTag.get(tag) ?? [];
    ids.push(node.id);
    byTag.set(tag, ids);
  }
  const errors: ValidationError[] = [];
  for (const [tag, ids] of byTag) {
    if (ids.length > 1) {
      errors.push({
        kind: 'duplicate-tag',
        message: `Duplicate tag "${tag}" used by ${ids.length} items`,
        nodeIds: ids,
      });
    }
  }
  return errors;
}

/**
 * Rule 2: every pipe/signal line must terminate on a declared port on a
 * known symbol. This is structurally guaranteed by the connector system
 * (edges may only be created from a react-flow Handle bound to a real
 * port id), but we verify defensively here in case data was edited
 * out-of-band (e.g. a future JSON load in a later phase).
 */
function checkPortConnections(nodes: DiagramNode[], edges: DiagramEdge[]): ValidationError[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const errors: ValidationError[] = [];

  for (const edge of edges) {
    const problems: string[] = [];

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (!sourceNode) problems.push('source equipment missing');
    if (!targetNode) problems.push('target equipment missing');

    if (sourceNode) {
      const symbol = symbolsByKind[sourceNode.data.kind];
      if (!symbol) {
        problems.push('source equipment has unknown symbol kind');
      } else if (!edge.sourceHandle || !symbol.ports.some((p) => p.id === edge.sourceHandle)) {
        problems.push('source end is not attached to a declared port');
      }
    }

    if (targetNode) {
      const symbol = symbolsByKind[targetNode.data.kind];
      if (!symbol) {
        problems.push('target equipment has unknown symbol kind');
      } else if (!edge.targetHandle || !symbol.ports.some((p) => p.id === edge.targetHandle)) {
        problems.push('target end is not attached to a declared port');
      }
    }

    if (problems.length > 0) {
      errors.push({
        kind: 'unconnected-pipe',
        message: `Pipe ${edge.id}: ${problems.join('; ')}`,
        nodeIds: [edge.source, edge.target].filter(Boolean),
        edgeId: edge.id,
      });
    }
  }

  return errors;
}

/** Run all validity rules against a diagram and return every current error. */
export function validateDiagram(nodes: DiagramNode[], edges: DiagramEdge[]): ValidationResult {
  return {
    errors: [...checkUniqueTags(nodes), ...checkPortConnections(nodes, edges)],
  };
}
