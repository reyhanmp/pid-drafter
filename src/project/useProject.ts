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
import {
  createHistory,
  editKey,
  isUndoableEdgeChange,
  isUndoableNodeChange,
  record,
  REMOVAL_CASCADE_MS,
  removeKey,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from './history';

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
  /**
   * Drop a new instance at a flow position. `opts.tag` sets an explicit tag for
   * callers that already know one (the branch-fitting remediation, where a tee
   * must be tagged as a fitting); omit it and `nextTagFor` derives a tag from
   * the symbol's own prefix.
   */
  addNodeFromSymbol: (kind: string, position: { x: number; y: number }, opts?: { tag?: string }) => void;

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

  // ── Undo / redo (PRD §8's deferral, re-taken) ──
  /** True when there is a step to undo. Drives the top-bar button state. */
  canUndo: boolean;
  /** True when there is a step to redo. */
  canRedo: boolean;
  /** Number of undo steps available — surfaced in the button tooltip. */
  undoDepth: number;
  undo: () => void;
  redo: () => void;
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

  // ── Undo/redo state ──
  // Held in a ref, not React state: history is bookkeeping that no render
  // depends on, and every mutation route needs to read the CURRENT stack
  // synchronously. React state would be a render behind inside a burst of
  // mutations (a drag), which is exactly when correctness matters.
  const historyRef = useRef<History<Project>>(createHistory<Project>());
  // Mirrors of the derived can-undo/can-redo flags, so the store can expose
  // them without forcing a re-render of every consumer on every mutation.
  const [historyVersion, setHistoryVersion] = useState(0);

  /**
   * The current project, mirrored into a ref so `undo`/`redo` can read it
   * without listing `project` as a dependency. Depending on `project` would
   * rebuild those callbacks on every keystroke, which in turn re-renders the
   * top bar and every consumer holding the `undo` identity — a needless
   * render per edit for callbacks that only ever read the latest value.
   */
  const projectRef = useRef(project);
  projectRef.current = project;

  /**
   * Set while a node is mid-drag, so keyboard undo cannot fire mid-gesture.
   * `onNodesChange` reports the node already moved for the current frame; an
   * undo at that moment would be overwritten by the next mousemove, leaving
   * the user convinced undo is broken.
   */
  const dragInProgressRef = useRef(false);

  /**
   * The merge key of the drag gesture in progress.
   *
   * Set on the FIRST frame and held until the drag ends, so every frame of the
   * gesture records against the SAME entry regardless of how many changes React
   * Flow batches per callback.
   *
   * Note what is NOT stored here: a pre-drag snapshot. An earlier version also
   * parked one and passed it into `record` as an override. Mutation-testing the
   * gate proved it was dead weight — the first frame's own `prev` IS the
   * pre-drag state, because nothing has been applied yet for this gesture. The
   * override was removed rather than kept as insurance.
   */
  const dragStartRef = useRef<{ key: string } | null>(null);

  /**
   * Merge key and timestamp of the most recent removal, of either kind.
   *
   * Deleting a node that has pipes attached is ONE user gesture but TWO React
   * Flow callbacks. Measured against the real browser (see the probe in the
   * commit message), the order is:
   *
   *     EDGESCHANGE [{type:'remove', id:'pipe-...'}]
   *     NODESCHANGE [{type:'remove', id:'vessel-...'}]
   *
   * — the EDGE removal arrives FIRST. On its own that ordering makes the
   * cascade impossible to catch by anticipating it from the node side, which is
   * why this ref is direction-agnostic: whichever removal lands first publishes
   * its key, and the other kind of removal landing immediately after reuses it.
   *
   * Recorded as two steps, the first undo restores the node while its pipe
   * stays deleted — a state the user never created, and undoing again then
   * removes the node instead of fixing it. Merging keeps the FIRST entry, whose
   * snapshot is the intact pre-delete state, so one undo restores node and
   * pipes together.
   */
  const lastRemovalRef = useRef<{ key: string; at: number } | null>(null);

  /**
   * Key for a removal, reusing the previous removal's key when this one is part
   * of the same gesture (see lastRemovalRef). Returns the key to record under.
   */
  const removalKey = useCallback((kind: 'node' | 'edge', ids: string) => {
    const prev = lastRemovalRef.current;
    const now = Date.now();
    if (prev && now - prev.at <= REMOVAL_CASCADE_MS) return prev.key;
    const fresh = removeKey(kind, ids);
    lastRemovalRef.current = { key: fresh, at: now };
    return fresh;
  }, []);

  /**
   * THE mutation funnel for anything the user can undo.
   *
   * `updater` receives the CURRENT project and returns the next one, so the
   * pre-change snapshot is captured from the same value React is about to
   * replace. That matters: reading `project` from the closure instead would
   * record a stale snapshot whenever the caller is one render behind — during
   * a drag, or when several mutations land in one tick — and undo would then
   * restore a state that never existed.
   *
   * `mergeKey` groups a continuous gesture into one undo step; see
   * ./history.ts for why that is the difference between working and broken
   * undo. Non-undoable state changes (autosave-driven, or programmatic)
   * bypass this and call setProject directly.
   */
  const mutate = useCallback(
    (updater: (prev: Project) => Project, mergeKey: string) => {
      let recorded = false;
      setProject((prev) => {
        const next = updater(prev);
        // A no-op updater (returned the same object) is not a history step.
        // Several apply* helpers return the input unchanged when nothing
        // matched, and recording those would fill the stack with entries whose
        // undo does nothing visible.
        if (next === prev) return prev;
        historyRef.current = record(historyRef.current, prev, next, mergeKey, Date.now());
        recorded = true;
        return next;
      });
      if (recorded) setHistoryVersion((v) => v + 1);
    },
    [],
  );

  // Resolve the active sheet id against the CURRENT project; falls back to
  // the first sheet so a stale/removed id can never leave a blank canvas.
  const activeSheet = useMemo(
    () => project.sheets.find((s) => s.id === activeSheetId) ?? project.sheets[0],
    [project, activeSheetId],
  );
  const resolvedActiveId = activeSheet?.id ?? '';

  /**
   * Patch the active sheet WITHOUT creating an undo step.
   *
   * For canvas bookkeeping that carries no user intent: selection highlights
   * and node-dimension measurements. These must still be applied — the canvas
   * needs them to work — but recording them would put entries on the stack
   * whose undo does nothing visible, and (worse) a `dimensions` change
   * arriving on mount would make "undo" appear to do nothing at all on a
   * freshly-opened sheet.
   */
  const patchActiveSheetNoHistory = useCallback(
    (updater: (sheet: ProjectSheet) => ProjectSheet) => {
      setProject((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => (s.id === resolvedActiveId ? updater(s) : s)),
      }));
    },
    [resolvedActiveId],
  );

  /**
   * Patch the ACTIVE sheet's nodes/edges via an updater on that sheet.
   *
   * Routes through `mutate`, so every canvas edit — drop, connect, delete,
   * drag, tag edit, nozzle edit — is undoable without each call site having to
   * remember to record history itself. `mergeKey` decides whether the edit
   * joins the previous undo step or starts a new one; see ./history.ts.
   */
  const patchActiveSheet = useCallback(
    (updater: (sheet: ProjectSheet) => ProjectSheet, mergeKey: string) => {
      mutate(
        (prev) => ({
          ...prev,
          sheets: prev.sheets.map((s) => (s.id === resolvedActiveId ? updater(s) : s)),
        }),
        mergeKey,
      );
    },
    [mutate, resolvedActiveId],
  );

  // ── Per-sheet canvas mutations (moved verbatim from DrawingCanvas) ──
  //
  // History for these two is opt-in per change type, not blanket. React Flow
  // emits a change for EVERY mousemove and every node measurement; recording
  // all of them would give one undo step per pixel and a stack full of no-op
  // entries. Only changes that carry user intent are recorded — see
  // isUndoableNodeChange / isUndoableEdgeChange in ./history.ts.
  //
  // Select/dimension changes still APPLY, they just do not create a step, so
  // the canvas behaves exactly as before; only the history differs.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const typed = changes as Array<{ type?: string; id?: string; dragging?: boolean }>;

      // ── Capture the pre-drag snapshot on the FIRST frame of the gesture ──
      // Only here is the project still holding the node at its resting
      // position. See dragStartRef for why recording at drag END cannot work.
      const anyDragging = typed.some((c) => c.type === 'position' && c.dragging === true);
      const anyDragEnded = typed.some((c) => c.type === 'position' && c.dragging === false);
      if (anyDragging) {
        dragInProgressRef.current = true;
        if (!dragStartRef.current) {
          // All nodes in one gesture share a single entry, so the key is
          // deliberately identifier-independent: a multi-select drag must be
          // ONE undo step, not one per selected node.
          dragStartRef.current = { key: editKey('node', 'drag') };
        }
      }
      if (anyDragEnded) dragInProgressRef.current = false;

      const undoable = typed.some((c) => isUndoableNodeChange(c));
      const dragStart = dragStartRef.current;

      if (!undoable && !dragStart) {
        // Non-undoable bookkeeping (selection, dimensions). Apply directly so
        // it never enters the stack, and never merges into a real step.
        patchActiveSheetNoHistory((s) => ({ ...s, nodes: applyNodeChanges(changes, s.nodes) }));
        return;
      }

      // A drag's final frame (or a delete) commits the step. The merge key
      // comes from the gesture captured at drag start so every frame in the
      // gesture targets the same entry regardless of how many changes React
      // Flow batches into each callback.
      const key = dragStart
        ? dragStart.key
        : // A removal joins the previous removal when they are one gesture
          // (delete a node with pipes); see lastRemovalRef.
          removalKey('node', typed.map((c) => c.id ?? '?').join('+'));
      if (dragStart && anyDragEnded) dragStartRef.current = null;

      patchActiveSheet((s) => ({ ...s, nodes: applyNodeChanges(changes, s.nodes) }), key);
    },
    [patchActiveSheet, patchActiveSheetNoHistory, removalKey],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const typedEdge = changes as Array<{ type?: string; id?: string }>;
      const undoable = changes.some((c) => isUndoableEdgeChange(c as { type?: string }));
      if (!undoable) {
        patchActiveSheetNoHistory((s) => ({ ...s, edges: applyEdgeChanges(changes, s.edges) }));
        return;
      }
      // Deleting a node with pipes emits this callback FIRST (measured), so
      // the pipe removal publishes the key and the node removal that follows
      // merges into it — one gesture, one undo step, restoring both together.
      patchActiveSheet(
        (s) => ({ ...s, edges: applyEdgeChanges(changes, s.edges) }),
        removalKey('edge', typedEdge.map((c) => c.id ?? '?').join('+')),
      );
    },
    [patchActiveSheet, patchActiveSheetNoHistory, removalKey],
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
      patchActiveSheet((s) => ({ ...s, edges: addEdge(newEdge, s.edges) }), `connect:${newEdge.id}`);
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
      patchActiveSheet((s) => ({ ...s, edges: [...s.edges, edge] }), `freeline:${id}`);
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
      patchActiveSheet(
        (s) => ({ ...s, edges: s.edges.filter((e) => e.id !== edgeId) }),
        removeKey('edge', edgeId),
      );
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
      }), editKey('edge', edgeId));
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
      }), editKey('node', nodeId));
    },
    [patchActiveSheet],
  );

  const commitTagEdit = useCallback(
    (nodeId: string, tag: string) => {
      patchActiveSheet(
        (s) => ({
          ...s,
          nodes: s.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, tag: tag.trim() } } : n,
          ),
        }),
        editKey('node', nodeId),
      );
    },
    [patchActiveSheet],
  );

  /** Drop a new equipment/instrument instance at a flow position. */
  const addNodeFromSymbol = useCallback(
    (
      kind: string,
      position: { x: number; y: number },
      /**
       * Explicit tag, when the caller already knows one. Used by the
       * over-occupied-nozzle remediation, where the tee dropped to fix the
       * connection must be tagged as the house code for a fitting. Omitted for
       * an ordinary palette drop, which lets `nextTagFor` derive it from the
       * symbol's own prefix.
       */
      opts?: { tag?: string },
    ) => {
      const symbol = symbolsByKind[kind];
      if (!symbol) return;
      mutate((prev) => ({
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
              tag: opts?.tag ?? nextTagFor(symbol.tagPrefix, prev.sheets, normalizeNumbering(prev.numbering).tags),
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
      }), `add:${Date.now()}`);
    },
    [mutate, resolvedActiveId, updateNodeData],
  );

  // ── Sheet-tab operations (PRD §4.8) ──

  const setActiveSheet = useCallback((sheetId: string) => setActiveSheetId(sheetId), []);

  const setProjectName = useCallback(
    (name: string) => mutate((prev) => ({ ...prev, projectName: name }), editKey('sheet', 'project-name')),
    [mutate],
  );

  const addSheet = useCallback(() => {
    const created = newSheetId();
    mutate((prev) => {
      const order = prev.sheets.length;
      const sheet: ProjectSheet = { id: created, name: defaultSheetName(order), order, nodes: [], edges: [] };
      return { ...prev, sheets: [...prev.sheets, sheet] };
    }, `sheet-add:${created}`);
    setActiveSheetId(created);
  }, [mutate]);

  const renameSheet = useCallback(
    (sheetId: string, name: string) => {
      mutate(
        (prev) => ({
          ...prev,
          sheets: prev.sheets.map((s) => (s.id === sheetId ? { ...s, name } : s)),
        }),
        editKey('sheet', sheetId),
      );
    },
    [mutate],
  );

  /** Move a sheet to a new 0-based index, renumbering `order` to stay contiguous. */
  const reorderSheet = useCallback((sheetId: string, toIndex: number) => {
    mutate((prev) => {
      const from = prev.sheets.findIndex((s) => s.id === sheetId);
      if (from < 0) return prev;
      const clamped = Math.max(0, Math.min(prev.sheets.length - 1, toIndex));
      if (clamped === from) return prev;
      const next = [...prev.sheets];
      const [moved] = next.splice(from, 1);
      next.splice(clamped, 0, moved);
      return { ...prev, sheets: next.map((s, i) => ({ ...s, order: i })) };
    }, `sheet-move:${sheetId}:${toIndex}`);
  }, [mutate]);

  /** Delete a sheet. Refuses (returns false) when only one sheet remains. */
  const deleteSheet = useCallback(
    (sheetId: string): boolean => {
      let deleted = false;
      mutate((prev) => {
        if (prev.sheets.length <= 1) return prev; // minimum one sheet always remains
        if (!prev.sheets.some((s) => s.id === sheetId)) return prev;
        deleted = true;
        const remaining = prev.sheets.filter((s) => s.id !== sheetId).map((s, i) => ({ ...s, order: i }));
        return { ...prev, sheets: remaining };
      }, removeKey('edge', `sheet:${sheetId}`));
      if (deleted) {
        setActiveSheetId((current) => {
          if (current !== sheetId) return current;
          const fallback = project.sheets.find((s) => s.id !== sheetId);
          return fallback?.id ?? current;
        });
      }
      return deleted;
    },
    [mutate, project.sheets],
  );

  /**
   * Replace the whole project (JSON load / new project).
   *
   * History is CLEARED rather than extended, deliberately: undo steps from the
   * previous document would restore nodes that belong to a file no longer
   * open, which is worse than having no undo. Loading a file is a new starting
   * point, not an edit.
   */
  const replaceProject = useCallback((next: Project) => {
    setProject(next);
    historyRef.current = createHistory<Project>();
    setHistoryVersion((v) => v + 1);
    setActiveSheetId(next.sheets[0]?.id ?? '');
  }, []);

  const dismissAutosaveNotice = useCallback(() => setAutosaveNotice(null), []);

  // ── Configurable numbering (PRD §4.3) ──
  // Always normalised on read, so a project loaded from an older file (no
  // `numbering` block at all) presents a complete config rather than
  // undefined fields the UI would have to guard at every use.
  const numbering = useMemo(() => normalizeNumbering(project.numbering), [project.numbering]);

  const setTagNumbering = useCallback(
    (patch: Partial<TagNumberingScheme>) => {
      mutate((prev) => ({
        ...prev,
        numbering: {
          ...normalizeNumbering(prev.numbering),
          tags: { ...normalizeNumbering(prev.numbering).tags, ...patch },
        },
      }), editKey('numbering', 'tags'));
    },
    [mutate],
  );

  const setLineNumbering = useCallback(
    (patch: Partial<LineNumberingScheme>) => {
      mutate((prev) => ({
        ...prev,
        numbering: {
          ...normalizeNumbering(prev.numbering),
          lines: { ...normalizeNumbering(prev.numbering).lines, ...patch },
        },
      }), editKey('numbering', 'lines'));
    },
    [mutate],
  );

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
    }), `number-lines:${Date.now()}`);
    return byId.size;
  }, [patchActiveSheet, project.numbering, project.sheets, resolvedActiveId]);

  // ── Undo / redo (PRD §8's deferral, re-taken) ──

  /**
   * Undo. The inverse of `record`: the state being left is pushed onto the
   * redo stack so undo and redo are exact mirror operations — stepping back
   * then forward returns the identical project, with no drift.
   *
   * Blocked while a drag is in progress, because `onNodesChange` fires
   * mid-gesture with the node's position already updated for the current
   * frame: undoing then would restore a state React Flow is about to overwrite
   * on the next mouse move. The whole drag is one history entry, so undoing it
   * once it has settled is the correct behaviour anyway.
   */
  const undo = useCallback(() => {
    if (dragInProgressRef.current) return;
    const result = undoHistory(historyRef.current, projectRef.current);
    if (!result) return;
    historyRef.current = result.history;
    setProject(result.state);
    setHistoryVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    if (dragInProgressRef.current) return;
    const result = redoHistory(historyRef.current, projectRef.current);
    if (!result) return;
    historyRef.current = result.history;
    setProject(result.state);
    setHistoryVersion((v) => v + 1);
  }, []);

  // Derived from the ref, but memoised on `historyVersion` so the values are
  // recomputed only when the stack actually changes and are stable references
  // between those points.
  const { canUndo, canRedo, undoDepth } = useMemo(
    () => ({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
      undoDepth: historyRef.current.past.length,
    }),
    // historyVersion is the signal, not an input — the ref is the source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

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

    // Undo/redo. The history stack itself lives in a ref (see above); these
    // three are its render-visible projection.
    canUndo,
    canRedo,
    undoDepth,
    undo,
    redo,
  };
}
