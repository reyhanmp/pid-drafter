/**
 * useProject — the single owner of multi-sheet project state (PRD §4.8).
 *
 * Extracted out of DrawingCanvas so App.tsx stays a view layer: this hook
 * owns the ordered sheet list, the active sheet, every per-sheet
 * mutation (equipment drop, pipe connect, tag/nozzle/data-sheet edits),
 * the sheet-tab operations, and debounced localStorage autosave.
 *
 * Existing canvas behavior (palette drag-drop, port-to-port connectors,
 * data sheets, rotation, custom nozzles) is preserved 1:1 — the mutation
 * bodies were moved here verbatim from DrawingCanvas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { symbolsByKind } from '../symbols';
import { getRenderedPorts } from '../symbols/effectivePorts';
import { toReactFlowHandles } from '../symbols/toReactFlowHandles';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';
import type { Node as RFNode } from '@xyflow/react';
import { AUTOSAVE_DEBOUNCE_MS, isStorageAvailable, readAutosave, storageUnavailableNotice, writeAutosave } from './autosave';
import { createEmptyProject, defaultSheetName, newSheetId, type Project, type ProjectSheet } from './types';
import {
  normalizeNumbering,
  nextTagFor,
  planUnnumberedLines,
  type LineNumberingScheme,
  type NumberingConfig,
  type TagNumberingScheme,
} from './numbering';

/**
 * Auto-tagging now reads the project's NUMBERING CONFIG (PRD §4.3) rather than
 * a hardcoded 101 seed — see ./numbering.ts, which owns the scheme, the
 * collision guard and the fallback to the old behaviour for projects saved
 * before the config existed.
 *
 * The duplicate guarantee previously provided here is preserved: nextTagFor()
 * scans every tag in the whole project (all sheets) and advances past any
 * collision, so auto-tagging still cannot introduce the duplicate-tag error
 * the validity engine refuses to export (PRD §4.1/§4.8).
 */

export interface ProjectStore {
  project: Project;
  projectName: string;
  sheets: ProjectSheet[];
  activeSheetId: string;
  activeSheet: ProjectSheet;
  activeSheetIndex: number;
  /** Debounced localStorage autosave status, surfaced in the top bar. */
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'unavailable';
  /** Non-blocking notice explaining why autosave is off. Null when healthy. */
  autosaveNotice: string | null;
  dismissAutosaveNotice: () => void;

  setProjectName: (name: string) => void;

  setActiveSheet: (sheetId: string) => void;
  addSheet: () => void;
  renameSheet: (sheetId: string, name: string) => void;
  reorderSheet: (sheetId: string, toIndex: number) => void;
  /** Returns false (and does nothing) when it would remove the last sheet. */
  deleteSheet: (sheetId: string) => boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection, activeNodes: Node[]) => void;
  updateNodeData: (nodeId: string, patch: Partial<EquipmentNodeData>) => void;
  /**
   * Add a FREE LINE (drawn into empty space, no nozzles). Returns its id.
   * Stored as an edge with data.freePipe so selection/delete/save work,
   * but filtered out of what react-flow renders and exempted from the
   * validity engine.
   */
  addFreeLine: (start: { x: number; y: number }, end: { x: number; y: number }) => string;
  /** Remove any line (pipe, signal line, or free line) by id. */
  removeEdge: (edgeId: string) => void;
  updateEdgeData: (edgeId: string, patch: Partial<PipeEdgeData>) => void;
  commitTagEdit: (nodeId: string, tag: string) => void;

  replaceProject: (project: Project) => void;
  /** Drop a new equipment/instrument instance of `kind` at a canvas position. */
  addNodeFromSymbol: (kind: string, position: { x: number; y: number }) => void;

  // ── Configurable numbering (PRD §4.3) ──
  /** The project's numbering config, always fully populated (never undefined). */
  numbering: NumberingConfig;
  setTagNumbering: (patch: Partial<TagNumberingScheme>) => void;
  setLineNumbering: (patch: Partial<LineNumberingScheme>) => void;
  /**
   * Assign line numbers to every unnumbered line on the ACTIVE sheet, in
   * reading order. Lines that already carry a number are left untouched.
   * Returns the number of lines numbered.
   */
  numberUnnumberedLines: () => number;
}

export function useProject(): ProjectStore {
  // Restore the debounced autosave on startup (PRD §4.4). A missing or
  // corrupt payload falls back to a fresh single-sheet project rather than
  // failing to start.
  const [project, setProject] = useState<Project>(() => readAutosave() ?? createEmptyProject());
  // Empty until the user picks a tab — activeSheet falls back to sheet 1.
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unavailable'>('idle');
  const [autosaveNotice, setAutosaveNotice] = useState<string | null>(null);

  // Resolve the active sheet id against the CURRENT project; falls back to
  // the first sheet so a stale/removed id can never leave a blank canvas.
  const activeSheet = useMemo(
    () => project.sheets.find((s) => s.id === activeSheetId) ?? project.sheets[0],
    [project, activeSheetId],
  );
  const resolvedActiveId = activeSheet?.id ?? '';

  /** Patch the ACTIVE sheet's nodes/edges via an updater on that sheet. */
  const patchActiveSheet = useCallback(
    (updater: (sheet: ProjectSheet) => ProjectSheet) => {
      setProject((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => (s.id === resolvedActiveId ? updater(s) : s)),
      }));
    },
    [resolvedActiveId],
  );

  // ── Per-sheet canvas mutations (moved verbatim from DrawingCanvas) ──
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => patchActiveSheet((s) => ({ ...s, nodes: applyNodeChanges(changes, s.nodes) })),
    [patchActiveSheet],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => patchActiveSheet((s) => ({ ...s, edges: applyEdgeChanges(changes, s.edges) })),
    [patchActiveSheet],
  );

  /**
   * onConnect fires only when react-flow has resolved a drag onto a valid
   * Handle — since every Handle on an EquipmentNode corresponds 1:1 to a
   * declared symbol port, this structurally guarantees pipes can only
   * originate/terminate at real ports (PRD §4.1/§4.3). Each endpoint's
   * port normal is stashed on the pipe's data so the custom PipeEdge
   * renderer can build an orthogonal path respecting both directions.
   *
   * `activeNodes` is passed in rather than read from state so the closure
   * never sees a stale sheet.
   */
  const onConnect = useCallback(
    (connection: Connection, activeNodes: Node[]) => {
      const sourceNode = activeNodes.find((n) => n.id === connection.source);
      const targetNode = activeNodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceSymbol = symbolsByKind[(sourceNode.data as unknown as EquipmentNodeData).kind];
      const targetSymbol = symbolsByKind[(targetNode.data as unknown as EquipmentNodeData).kind];
      const sourceData = sourceNode.data as unknown as EquipmentNodeData;
      const targetData = targetNode.data as unknown as EquipmentNodeData;
      const sourcePorts = getRenderedPorts(sourceData.kind, sourceData.ports, sourceData.rotation, sourceData.width, sourceData.height);
      const targetPorts = getRenderedPorts(targetData.kind, targetData.ports, targetData.rotation, targetData.width, targetData.height);
      const sourcePort = sourcePorts.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetPorts.find((p) => p.id === connection.targetHandle);
      if (!sourceSymbol || !targetSymbol) return;
      if (!sourcePort || !targetPort) return; // defensive: refuse to create an unseated pipe

      const lineType: PipeEdgeData['lineType'] =
        sourcePort.kind === 'signal' || targetPort.kind === 'signal' ? 'signal' : 'process';

      const newEdge: Edge = {
        id: `pipe-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'pipe',
        markerEnd: lineType === 'process' ? { type: MarkerType.ArrowClosed, width: 14, height: 14 } : undefined,
        data: {
          lineType,
          sourceDirection: sourcePort.direction,
          targetDirection: targetPort.direction,
        } satisfies PipeEdgeData & Record<string, unknown>,
      };
      patchActiveSheet((s) => ({ ...s, edges: addEdge(newEdge, s.edges) }));
    },
    [patchActiveSheet],
  );

  /**
   * Add a FREE LINE: a line drawn into empty space, attached to no
   * nozzle (explicit user decision — see PipeEdgeData.freePipe).
   *
   * It is stored as an ordinary edge on the sheet so selection, deletion,
   * autosave and JSON save/load all work unchanged, but carries explicit
   * geometry and is filtered OUT of what <ReactFlow> renders, because
   * react-flow edges require both endpoints to be node handles. The
   * overlay (components/FreeLineLayer.tsx) draws it inside the viewport
   * instead. The validity engine skips it via the freePipe flag.
   */
  const addFreeLine = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const id = `freeline-${Date.now()}-${Math.round(start.x)}-${Math.round(start.y)}`;
      const edge: Edge = {
        id,
        // react-flow requires non-null source/target strings; these are
        // inert placeholders, never resolved, because this edge is
        // filtered out before it reaches the canvas.
        source: '',
        target: '',
        type: 'free-line',
        data: {
          lineType: 'process',
          freePipe: true,
          freeStart: start,
          freeEnd: end,
        } satisfies PipeEdgeData & Record<string, unknown>,
      };
      patchActiveSheet((s) => ({ ...s, edges: [...s.edges, edge] }));
      return id;
    },
    [patchActiveSheet],
  );

  /**
   * Remove a pipe/signal/free line by id. Free lines ACTUALLY need this:
   * they are filtered out of what react-flow renders, so the usual
   * useReactFlow().setEdges() delete path cannot see them (it operates on
   * react-flow's own internal edge list). The project store is the single
   * source of truth for both, so deletion goes through here.
   */
  const removeEdge = useCallback(
    (edgeId: string) => {
      patchActiveSheet((s) => ({ ...s, edges: s.edges.filter((e) => e.id !== edgeId) }));
    },
    [patchActiveSheet],
  );

  const updateEdgeData = useCallback(
    (edgeId: string, patch: Partial<PipeEdgeData>) => {
      patchActiveSheet((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== edgeId) return e;
          const nextData = { ...e.data, ...patch } as PipeEdgeData & Record<string, unknown>;
          const updated: Edge = { ...e, data: nextData };
          // Line type toggle also flips the arrowhead convention captured at
          // creation time (process pipes carry a directional arrow, signal
          // lines do not).
          if ('lineType' in patch) {
            updated.markerEnd =
              nextData.lineType === 'process' ? { type: MarkerType.ArrowClosed, width: 14, height: 14 } : undefined;
          }
          return updated;
        }),
      }));
    },
    [patchActiveSheet],
  );

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<EquipmentNodeData>) => {
      patchActiveSheet((s) => ({
        ...s,
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const nextData = { ...n.data, ...patch };
          const updated: RFNode = { ...n, data: nextData };
          // If this patch changes the node's effective ports (nozzle
          // added/removed/repositioned/dragged) OR its rotation, keep
          // node.handles in lockstep so React Flow's connection system
          // never reads stale geometry. Handles are always built from the
          // RENDERED (rotated) port set — building them from raw unrotated
          // ports would land connections in the wrong place on a rotated node.
          if ('ports' in patch || 'rotation' in patch) {
            const nd = nextData as unknown as EquipmentNodeData;
            const renderedPorts = getRenderedPorts(nd.kind, nd.ports, nd.rotation, nd.width, nd.height);
            updated.handles = toReactFlowHandles(renderedPorts);
          }
          return updated;
        }),
      }));
    },
    [patchActiveSheet],
  );

  const commitTagEdit = useCallback(
    (nodeId: string, tag: string) => {
      patchActiveSheet((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, tag: tag.trim() } } : n,
        ),
      }));
    },
    [patchActiveSheet],
  );

  /** Drop a new equipment/instrument instance at a flow position. */
  const addNodeFromSymbol = useCallback(
    (kind: string, position: { x: number; y: number }) => {
      const symbol = symbolsByKind[kind];
      if (!symbol) return;
      setProject((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => {
          if (s.id !== resolvedActiveId) return s;
          const id = `${symbol.kind}-${Date.now()}`;
          const newNode: Node = {
            id,
            type: 'equipment',
            position,
            // Declared directly (not measured from the DOM) so React Flow's
            // handle bounds are correct from the first render and stay
            // correct if this node's ports are later customized.
            handles: toReactFlowHandles(symbol.ports),
            data: {
              kind: symbol.kind,
              tag: nextTagFor(symbol.tagPrefix, prev.sheets, normalizeNumbering(prev.numbering).tags),
              width: symbol.defaultWidth,
              height: symbol.defaultHeight,
              // Stable callback reference stashed on node.data so
              // EquipmentNode can drive nozzle-drag repositions through the
              // SAME update path the data sheet's controls use.
              __updateNodeData: updateNodeData,
            } satisfies EquipmentNodeData,
          };
          return { ...s, nodes: [...s.nodes, newNode] };
        }),
      }));
    },
    [resolvedActiveId, updateNodeData],
  );

  // ── Sheet-tab operations (PRD §4.8) ──

  const setActiveSheet = useCallback((sheetId: string) => setActiveSheetId(sheetId), []);

  const setProjectName = useCallback((name: string) => setProject((prev) => ({ ...prev, projectName: name })), []);

  const addSheet = useCallback(() => {
    const created = newSheetId();
    setProject((prev) => {
      const order = prev.sheets.length;
      const sheet: ProjectSheet = { id: created, name: defaultSheetName(order), order, nodes: [], edges: [] };
      return { ...prev, sheets: [...prev.sheets, sheet] };
    });
    setActiveSheetId(created);
  }, []);

  const renameSheet = useCallback((sheetId: string, name: string) => {
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => (s.id === sheetId ? { ...s, name } : s)),
    }));
  }, []);

  /** Move a sheet to a new 0-based index, renumbering `order` to stay contiguous. */
  const reorderSheet = useCallback((sheetId: string, toIndex: number) => {
    setProject((prev) => {
      const from = prev.sheets.findIndex((s) => s.id === sheetId);
      if (from < 0) return prev;
      const clamped = Math.max(0, Math.min(prev.sheets.length - 1, toIndex));
      if (clamped === from) return prev;
      const next = [...prev.sheets];
      const [moved] = next.splice(from, 1);
      next.splice(clamped, 0, moved);
      return { ...prev, sheets: next.map((s, i) => ({ ...s, order: i })) };
    });
  }, []);

  /** Delete a sheet. Refuses (returns false) when only one sheet remains. */
  const deleteSheet = useCallback(
    (sheetId: string): boolean => {
      let deleted = false;
      setProject((prev) => {
        if (prev.sheets.length <= 1) return prev; // minimum one sheet always remains
        if (!prev.sheets.some((s) => s.id === sheetId)) return prev;
        deleted = true;
        const remaining = prev.sheets.filter((s) => s.id !== sheetId).map((s, i) => ({ ...s, order: i }));
        return { ...prev, sheets: remaining };
      });
      if (deleted) {
        setActiveSheetId((current) => {
          if (current !== sheetId) return current;
          const fallback = project.sheets.find((s) => s.id !== sheetId);
          return fallback?.id ?? current;
        });
      }
      return deleted;
    },
    [project.sheets],
  );

  const replaceProject = useCallback((next: Project) => {
    setProject(next);
    setActiveSheetId(next.sheets[0]?.id ?? '');
  }, []);

  const dismissAutosaveNotice = useCallback(() => setAutosaveNotice(null), []);

  // ── Configurable numbering (PRD §4.3) ──
  // Always normalised on read, so a project loaded from an older file (no
  // `numbering` block at all) presents a complete config rather than
  // undefined fields the UI would have to guard at every use.
  const numbering = useMemo(() => normalizeNumbering(project.numbering), [project.numbering]);

  const setTagNumbering = useCallback((patch: Partial<TagNumberingScheme>) => {
    setProject((prev) => ({
      ...prev,
      numbering: {
        ...normalizeNumbering(prev.numbering),
        tags: { ...normalizeNumbering(prev.numbering).tags, ...patch },
      },
    }));
  }, []);

  const setLineNumbering = useCallback((patch: Partial<LineNumberingScheme>) => {
    setProject((prev) => ({
      ...prev,
      numbering: {
        ...normalizeNumbering(prev.numbering),
        lines: { ...normalizeNumbering(prev.numbering).lines, ...patch },
      },
    }));
  }, []);

  /**
   * Bulk-number the active sheet's unnumbered lines.
   *
   * Deliberately NOT automatic: numbers appearing without being asked for
   * would be a surprise on an existing drawing, and this tool does not
   * renumber work it did not assign. The plan is computed first (see
   * planUnnumberedLines) so the numbering is deterministic and testable, then
   * applied in one state update rather than one per line.
   */
  const numberUnnumberedLines = useCallback((): number => {
    const scheme = normalizeNumbering(project.numbering).lines;
    const sheet = project.sheets.find((s) => s.id === resolvedActiveId);
    if (!sheet) return 0;
    const plan = planUnnumberedLines(sheet, scheme);
    const byId = new Map(plan.filter((p) => p.proposal).map((p) => [p.edgeId, p.proposal as string]));
    if (byId.size === 0) return 0;
    patchActiveSheet((s) => ({
      ...s,
      edges: s.edges.map((e) => {
        const assigned = byId.get(e.id);
        if (!assigned) return e;
        return { ...e, data: { ...(e.data as object), lineNumber: assigned } as typeof e.data };
      }),
    }));
    return byId.size;
  }, [patchActiveSheet, project.numbering, project.sheets, resolvedActiveId]);

  // ── Debounced localStorage autosave (PRD §4.4) ──
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (!isStorageAvailable()) {
        setAutosaveStatus('unavailable');
        setAutosaveNotice(storageUnavailableNotice());
      }
      return;
    }
    if (!isStorageAvailable()) {
      setAutosaveStatus('unavailable');
      setAutosaveNotice(storageUnavailableNotice());
      return;
    }
    setAutosaveStatus('saving');
    const handle = window.setTimeout(() => {
      const failure = writeAutosave(project);
      if (failure) {
        setAutosaveStatus('unavailable');
        setAutosaveNotice(failure.message);
      } else {
        setAutosaveStatus('saved');
        setAutosaveNotice(null);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [project]);

  return {
    project,
    projectName: project.projectName,
    sheets: project.sheets,
    activeSheetId: resolvedActiveId,
    activeSheet,
    activeSheetIndex: project.sheets.findIndex((s) => s.id === resolvedActiveId),
    autosaveStatus,
    autosaveNotice,
    dismissAutosaveNotice,
    setProjectName,
    setActiveSheet,
    addSheet,
    renameSheet,
    reorderSheet,
    deleteSheet,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    updateEdgeData,
    addFreeLine,
    removeEdge,
    commitTagEdit,
    replaceProject,
    addNodeFromSymbol,
    numbering,
    setTagNumbering,
    setLineNumbering,
    numberUnnumberedLines,
  };
}
