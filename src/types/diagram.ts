/**
 * Shared node/edge data types for the diagram. Kept independent of
 * react-flow's own Node/Edge generics so the validity engine can operate
 * on plain data (see src/validation/).
 */
import type { SymbolPort } from '../symbols/types';

export interface EquipmentNodeData {
  /** Symbol registry key, e.g. "vessel-vertical". */
  kind: string;
  /** Equipment/instrument tag, e.g. "V-101", "TT-204". Must be unique. */
  tag: string;
  /** Loop number shown beside instrument bubbles, e.g. "204". Optional. */
  loopNumber?: string;
  width: number;
  height: number;
  [key: string]: unknown;
}

/** Plain-data view of a port used by the connector + validity engine. */
export interface ResolvedPort extends SymbolPort {
  nodeId: string;
}

/** A pipe/signal-line connection between two declared ports. */
export interface PipeEdgeData {
  /** 'process' (solid) or 'signal' (dashed) — mirrors ISA line convention. */
  lineType: 'process' | 'signal';
  /** Line number label shown along the pipe, optional in this phase. */
  lineNumber?: string;
  [key: string]: unknown;
}
