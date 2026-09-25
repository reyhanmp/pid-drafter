import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ConnectionMode,
  useReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type FinalConnectionState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EquipmentNode from './components/EquipmentNode';
import PipeEdge from './edges/PipeEdge';
import PipeConnectionLine from './edges/PipeConnectionLine';
import FreeLineLayer from './components/FreeLineLayer';
import EngineeringListsPanel from './components/EngineeringListsPanel';
import NumberingSettingsPanel from './components/NumberingSettingsPanel';
import SymbolPalette from './components/SymbolPalette';
import ValidationPanel from './components/ValidationPanel';
import ConnectNoticePanel, { type ConnectNotice } from './components/ConnectNoticePanel';
import DataSheetPanel from './components/DataSheetPanel';
import LineDataSheetPanel from './components/LineDataSheetPanel';
import SheetTabs from './components/SheetTabs';
import ProjectTopBar from './components/ProjectTopBar';
import { useProject } from './project/useProject';
import { symbolsByKind } from './symbols';
import { validateDiagram, validateProject, type DiagramNode, type DiagramEdge } from './validation/validateDiagram';
import {
  canConnect,
  getSuggestedPortId,
  numberOccupiedPorts,
  portKey,
} from './validation/connectionRules';
import { validateSpecCompatibility } from './validation/specValidation';
import { validateTagSemantics } from './validation/tagSemantics';
import { reconcileNozzles } from './validation/nozzleReconciliation';
import { getProjectLoopMates } from './validation/instrumentLoops';
import { offpageDisplayLabel, isOffpageConnector } from './validation/offpageReferences';
import type { EquipmentNodeData, PipeEdgeData } from './types/diagram';
import './App.css';

const nodeTypes = { equipment: EquipmentNode };
const edgeTypes = { pipe: PipeEdge };

const GRID = 20;

/**
 * Gap between a branch fitting's box and the equipment it branches from, on
 * top of the fitting's own span. Enough that a grid-snapped placement cannot
 * land the fitting's edge back inside the equipment box.
 */
const CLEARANCE = 14;

function DrawingCanvas() {
  // All multi-sheet project state lives in the store (PRD §4.8) — this
  // component is purely the view + interaction layer over it.
  const store = useProject();
  const {
    project,
    projectName,
    sheets,
    activeSheetId,
    activeSheet,
    autosaveStatus,
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
    commitTagEdit,
    replaceProject,
    addNodeFromSymbol,
    addFreeLine,
    removeEdge,
    autosaveNotice,
    dismissAutosaveNotice,
    canUndo,
    canRedo,
    undoDepth,
    undo,
    redo,
    numbering,
    setTagNumbering,
    setLineNumbering,
    numberUnnumberedLines,
  } = store;

  const nodes = activeSheet?.nodes ?? [];
  const edges = activeSheet?.edges ?? [];

  /**
   * Per-port pipe counts for the whole active sheet (PRD §7a items 1+2),
   * computed ONCE from the real edges and consumed three ways: pushed down to
   * each node as a transient data field (so EquipmentNode can draw a spent
   * nozzle as spent), used by the connect guard to decide whether a connection
   * is physically possible, and used to find the free nozzle a branch fitting
   * should go on. One occupancy definition for all three, so the port the user
   * sees as empty is the port the rule agrees is empty.
   */
  const byNodeId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const occupiedPorts = useMemo(() => numberOccupiedPorts(edges), [edges]);

  /**
   * Free lines have no node endpoints, so they cannot be react-flow edges
   * (react-flow requires a source AND target handle). They are split out
   * here: `pipedEdges` goes to <ReactFlow>, `freeLines` renders through
   * the FreeLineLayer overlay in the same coordinate system.
   */
  const freeLines = useMemo(
    () => edges.filter((e) => (e.data as PipeEdgeData | undefined)?.freePipe === true),
    [edges],
  );

  /**
   * How many lines on the ACTIVE sheet still need a number (PRD §4.3).
   * Counted here rather than in the settings panel so the panel stays a
   * presentation component and the number is derived from the same `edges`
   * the canvas renders. Free lines are excluded — they are not numbered runs.
   */
  const unnumberedOnActiveSheet = useMemo(
    () =>
      edges.filter((e) => {
        const d = e.data as PipeEdgeData | undefined;
        if (d?.freePipe) return false;
        return !(d?.lineNumber ?? '').trim();
      }).length,
    [edges],
  );
  const pipedEdges = useMemo(
    () => edges.filter((e) => (e.data as PipeEdgeData | undefined)?.freePipe !== true),
    [edges],
  );

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  /** Selected free line (overlay-rendered; not a react-flow edge selection). */
  const [selectedFreeLineId, setSelectedFreeLineId] = useState<string | null>(null);
  /** PRD §4.6 engineering-lists view — derived on render from `sheets`. */
  const [showLists, setShowLists] = useState(false);
  const [showNumbering, setShowNumbering] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  /**
   * Selection is per-sheet state: switching sheets clears the open data
   * sheet / line data sheet so the panels never describe equipment that
   * isn't on the canvas in front of you.
   */
  const handleSheetSelect = useCallback(
    (sheetId: string) => {
      setActiveSheet(sheetId);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
      setHoveredNodeId(null);
      setSelectedFreeLineId(null);
    },
    [setActiveSheet],
  );

  const handleSheetDelete = useCallback(
    (sheetId: string) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setHoveredNodeId(null);
      deleteSheet(sheetId);
    },
    [deleteSheet],
  );

  const handleLoad = useCallback(
    (loaded: Parameters<typeof replaceProject>[0]) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
      setHoveredNodeId(null);
      replaceProject(loaded);
    },
    [replaceProject],
  );

  const handleConnect = useCallback((connection: Parameters<typeof onConnect>[0]) => onConnect(connection, nodes), [onConnect, nodes]);

  /**
   * Refuse a connection onto a nozzle that already carries a pipe (PRD §7a
   * items 1+2, decided in src/validation/connectionRules.ts).
   *
   * This is the place the rule has to be enforced, because it runs DURING the
   * drag: react-flow asks before creating the edge, so the user sees the
   * refusal in their hand rather than watching a line appear and then vanish.
   * `onConnect` alone would be too late — by then the edge exists, and
   * silently deleting it again is indistinguishable from a broken drag.
   *
   * Two ends can be refused at once (dragging a pipe between two spent
   * nozzles) and the message names whichever is checked first, so the user is
   * told about one concrete problem rather than a compound one.
   */
  /**
   * Explains the refusal, and offers the action that actually resolves it —
   * dropping a branch fitting on a free nozzle and running the line through
   * that. A bare "no" would leave the user with no legal way to draw the
   * header+branch arrangement, which is the ordinary case this rule exists to
   * make drawable.
   */
  const rejectConnection = useCallback(
    (nodeId: string, reason: string) => {
      const node = byNodeId.get(nodeId);
      const data = node?.data as unknown as EquipmentNodeData | undefined;
      if (!node || !data) {
        setConnectNotice({ message: reason });
        return;
      }
      const occupied: Record<string, number> = {};
      for (const port of symbolsByKind[data.kind]?.ports ?? []) {
        const count = occupiedPorts.get(portKey(nodeId, port.id)) ?? 0;
        if (count > 0) occupied[port.id] = count;
      }
      const freePortId = getSuggestedPortId(data.kind, occupied, symbolsByKind[data.kind]?.multiBranchPorts);
      const freePort = symbolsByKind[data.kind]?.ports.find((p) => p.id === freePortId);
      setConnectNotice({
        message: freePort
          ? `${reason} ${data.tag} still has a free nozzle (${freePort.label}) — a tee goes there.`
          : reason,
        tee: freePort
          ? {
              nodeId,
              portId: freePort.id,
              nodeLabel: data.tag,
              portLabel: freePort.label,
            }
          : undefined,
      });
    },
    [byNodeId, occupiedPorts],
  );

  const addTeeAt = useCallback(
    (tee: NonNullable<ConnectNotice['tee']>) => {
      const node = byNodeId.get(tee.nodeId);
      const data = node?.data as unknown as EquipmentNodeData | undefined;
      if (!node || !data) return;
      const symbol = symbolsByKind[data.kind];
      const port = symbol?.ports.find((p) => p.id === tee.portId);
      if (!port) return;

      /**
       * Place the tee just outside the free nozzle, along its outward normal,
       * SNAPPED to the grid so it lines up with the run.
       *
       * The gap is the fitting's own size plus a margin, measured from the
       * nozzle — not an arbitrary distance. The first version used a fixed 24px
       * from the port point, which for a nozzle on the top edge left the tee's
       * lower 4px underneath the vessel: the port sits ON the boundary, so the
       * gap has to cover the half of the fitting that extends BACK toward the
       * equipment. A branch fitting buried under the thing it branches from is
       * worse than no offer at all, and only a geometric assertion catches it.
       */
      const TEE = symbolsByKind['tee-branch'];
      const teeSpan = Math.max(TEE?.defaultWidth ?? 24, TEE?.defaultHeight ?? 24);
      const gap = teeSpan + CLEARANCE;
      const pos = {
        x: Math.round((node.position.x + port.x + port.direction.x * gap) / GRID) * GRID,
        y: Math.round((node.position.y + port.y + port.direction.y * gap) / GRID) * GRID,
      };

      /**
       * A branch fitting is tagged as a fitting, not as a piece of equipment
       * with an auto-incremented equipment tag. Vessels, pumps and the rest are
       * numbered because they are the things a plant counts; a tee is
       * identified by its line number, and the house code for one is `TEE-101`.
       * The tag still has to be UNIQUE (that rule is what stops two things
       * answering to one name), so it is numbered from the project's existing
       * `TEE-` tags, falling back to the plain `TEE-101` form.
       */
      const used = sheets.flatMap((s) => s.nodes.map((n) => (n.data as unknown as EquipmentNodeData).tag ?? ''));
      let tag = 'TEE-101';
      let seq = 101;
      while (used.includes(tag)) {
        seq += 1;
        tag = `TEE-${seq}`;
      }

      addNodeFromSymbol('tee-branch', pos, { tag });
      setConnectNotice({
        message: `${tag} placed on ${tee.nodeLabel} ${tee.portLabel}. Draw the line into the tee's run and branch off it.`,
      });
    },
    [addNodeFromSymbol, byNodeId, sheets],
  );

  const isValidConnection = useCallback(
    (connection: Parameters<typeof canConnect>[0]) => {
      const decision = canConnect(connection, nodes, edges);
      if (decision.allowed) return true;
      // The REFUSED end, as decided by the rule — not "whichever end is the
      // target". See ConnectionDecision.blockedNodeId for why that distinction
      // is load-bearing: the tee offer would otherwise land on the equipment
      // that was never the problem.
      const culprit = decision.blockedNodeId;
      if (culprit) rejectConnection(culprit, decision.reason ?? 'That nozzle is already in use.');
      return false;
    },
    [nodes, edges, rejectConnection],
  );

  /**
   * Releasing a connection drag in EMPTY SPACE draws a FREE LINE
   * (explicit user decision): a plain line attached to no nozzle, which
   * the validity engine deliberately does not police.
   *
   * `onConnect` fires only when both ends land on a declared port; this
   * handles the other case. A drag that ended on a node/handle but was
   * rejected is NOT a free line — only a drop on bare canvas is.
   */
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid) return;             // a seated pipe was created
      if (!state.from || !state.fromNode) return;
      const target = event.target as HTMLElement | null;
      if (!target?.classList?.contains('react-flow__pane')) return;

      const end = screenToFlowPosition({
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
      });
      addFreeLine({ x: state.from.x, y: state.from.y }, { x: end.x, y: end.y });
    },
    [addFreeLine, screenToFlowPosition],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData('application/pid-symbol-kind');
      const symbol = symbolsByKind[kind];
      if (!symbol) return;

      const rawPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const position = {
        x: Math.round((rawPosition.x - symbol.defaultWidth / 2) / GRID) * GRID,
        y: Math.round((rawPosition.y - symbol.defaultHeight / 2) / GRID) * GRID,
      };
      addNodeFromSymbol(kind, position);
    },
    [screenToFlowPosition, addNodeFromSymbol],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_evt, node) => {
    setEditingNodeId(node.id);
    setEditingValue((node.data as unknown as EquipmentNodeData).tag ?? '');
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_evt, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_evt, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleCommitTagEdit = useCallback(() => {
    if (!editingNodeId) return;
    commitTagEdit(editingNodeId, editingValue);
    setEditingNodeId(null);
  }, [editingNodeId, editingValue, commitTagEdit]);

  /**
   * Off-page connector labels need the whole PROJECT (target sheet names +
   * whatever is tagged on them), so a connector's resolved reference is
   * computed here and stashed on its node data for the symbol geometry to
   * draw. This is also what makes a stale reference visibly read as broken.
   */
  const sheetsForRefs = useMemo(
    () =>
      sheets.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        nodes: s.nodes.map((n) => ({ id: n.id, data: n.data as unknown as EquipmentNodeData })),
      })),
    [sheets],
  );

  // ── Project-wide validity (PRD §4.1 + §4.8) ──
  const projectValidation = useMemo(
    () =>
      validateProject(
        sheets.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          nodes: s.nodes.map((n) => ({ id: n.id, data: n.data as unknown as EquipmentNodeData })) as DiagramNode[],
          edges: s.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            data: e.data as unknown as PipeEdgeData,
          })) as DiagramEdge[],
        })),
      ),
    [sheets],
  );

  // Spec-compatibility soft warnings are per-sheet (they concern the pipe
  // and the component sitting on it), so the active sheet's view is used.
  const diagramNodes: DiagramNode[] = useMemo(
    () => nodes.map((n) => ({ id: n.id, data: n.data as unknown as EquipmentNodeData })),
    [nodes],
  );
  const diagramEdges: DiagramEdge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        data: e.data as unknown as PipeEdgeData,
      })),
    [edges],
  );
  const specWarnings = useMemo(() => validateSpecCompatibility(diagramNodes, diagramEdges), [diagramNodes, diagramEdges]);
  /**
   * PRD §4.9.3 correction / §7a item 6 — nozzle ↔ line reconciliation. The
   * other half of the spec check: `specWarnings` above compares the line's
   * spec against the *component's* declared fields, this compares what the
   * line says about itself (size, pressure class) against the *nozzle* it is
   * actually bolted to at each end. Soft only — a reducer makes a larger line
   * on a smaller nozzle legal, so that case is a notice, not a defect.
   */
  const nozzleWarnings = useMemo(() => reconcileNozzles(diagramNodes, diagramEdges), [diagramNodes, diagramEdges]);
  /** PRD §4.9.2 — soft tag/line semantics warnings (ISA-5.1 reading, prefix match, line-number grammar). */
  const tagWarnings = useMemo(() => validateTagSemantics(diagramNodes, diagramEdges), [diagramNodes, diagramEdges]);
  /** Every line number in the project, so the line editor suggests this drawing's own house codes first. */
  const allLineNumbers = useMemo(
    () => sheets.flatMap((s) => s.edges.map((e) => (e.data as unknown as PipeEdgeData | undefined)?.lineNumber ?? '')).filter(Boolean),
    [sheets],
  );

  // Per-sheet structural errors stay available (used nowhere in the panel
  // now that validateProject supersedes it, but kept wired so a future
  // per-sheet export gate can read them without recomputing).
  const sheetValidation = useMemo(() => validateDiagram(diagramNodes, diagramEdges), [diagramNodes, diagramEdges]);
  void sheetValidation;

  /**
   * Instrument loop cross-referencing (PRD §4.7), extended across sheets by
   * §4.8: hovering an instrument highlights same-sheet loop mates inline,
   * and reports a real count of the loop mates that live on other sheets.
   * Purely derived from tag text — no separate loop-membership state.
   */
  const loopHighlight = useMemo(
    () =>
      getProjectLoopMates(
        sheets.map((s) => ({
          id: s.id,
          name: s.name,
          nodes: s.nodes.map((n) => ({ id: n.id, data: n.data as unknown as EquipmentNodeData })),
        })),
        activeSheetId,
        hoveredNodeId,
      ),
    [sheets, activeSheetId, hoveredNodeId],
  );

  /**
   * Feed loop-highlight state (and off-page resolved labels) into node data
   * so EquipmentNode can render without a parallel prop-drilling path —
   * same pattern already used for __updateNodeData. Transient keys are
   * stripped on save, so none of this reaches the project JSON.
   *
   * Occupancy counts are pushed down the same way (PRD §7a items 1+2), so a
   * node draws a spent nozzle as spent without the renderer reaching for edge
   * state — and the port the user sees as empty is the port the connect rule
   * agrees is empty, because both read this one map.
   */
  const nodesWithHighlights = useMemo(
    () =>
      nodes.map((n) => {
        const data = n.data as unknown as EquipmentNodeData;
        const isActive = n.id === hoveredNodeId && loopHighlight.onSheetMateIds.size + loopHighlight.offSheetMateCount > 0;
        const isMate = loopHighlight.onSheetMateIds.has(n.id);

        const patch: Record<string, unknown> = {};
        const strip: string[] = [];

        const occupied: Record<string, number> = {};
        for (const port of symbolsByKind[data.kind]?.ports ?? []) {
          const count = occupiedPorts.get(portKey(n.id, port.id)) ?? 0;
          if (count > 0) occupied[port.id] = count;
        }
        if (Object.keys(occupied).length > 0) patch.__occupiedPorts = occupied;
        else if ('__occupiedPorts' in data) strip.push('__occupiedPorts');
        if (isActive || isMate) patch.__loopHighlight = true;
        else if ('__loopHighlight' in data) strip.push('__loopHighlight');

        if (isActive && loopHighlight.offSheetMateCount > 0) {
          patch.__offshetLoopMateCount = loopHighlight.offSheetMateCount;
          patch.__offshetLoopSheetNames = loopHighlight.offSheetSheetNames;
        } else {
          if ('__offshetLoopMateCount' in data) strip.push('__offshetLoopMateCount');
          if ('__offshetLoopSheetNames' in data) strip.push('__offshetLoopSheetNames');
        }

        if (isOffpageConnector(data)) {
          const label = offpageDisplayLabel(data, sheetsForRefs);
          if (data.__resolvedLabel !== label) patch.__resolvedLabel = label;
        } else if ('__resolvedLabel' in data) {
          strip.push('__resolvedLabel');
        }

        if (Object.keys(patch).length === 0 && strip.length === 0) return n;
        const nextData = { ...n.data, ...patch };
        for (const key of strip) delete (nextData as Record<string, unknown>)[key];
        return { ...n, data: nextData };
      }),
    [nodes, hoveredNodeId, loopHighlight, sheetsForRefs, occupiedPorts],
  );

  /**
   * Refusal feedback for a connection the soundness rule blocked (PRD §7a
   * items 1+2). Held as state rather than pushed through the project store
   * because it is pure view feedback about the user's last gesture — it must
   * NOT be undoable, autosaved, or serialized, and it must survive long enough
   * to be read (a transient flash during a drag would be unreadable).
   *
   * When the blocked equipment still has a free nozzle, `tee` carries the
   * offer to place a branch fitting there, which is the only action that
   * actually makes the connection legal.
   */
  const [connectNotice, setConnectNotice] = useState<ConnectNotice | null>(null);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

  const connectedPortIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNodeId) return set;
    for (const e of edges) {
      if (e.source === selectedNodeId && e.sourceHandle) set.add(e.sourceHandle);
      if (e.target === selectedNodeId && e.targetHandle) set.add(e.targetHandle);
    }
    return set;
  }, [edges, selectedNodeId]);

  return (
    <div className="app-shell">
      <div className="app-main">
        <ProjectTopBar
          onOpenNumbering={() => setShowNumbering(true)}
          project={project}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          autosaveStatus={autosaveStatus}
          onLoad={handleLoad}
          onOpenLists={() => setShowLists(true)}
          canUndo={canUndo}
          canRedo={canRedo}
          undoDepth={undoDepth}
          onUndo={undo}
          onRedo={redo}
        />
        {showLists && (
          <EngineeringListsPanel
            sheets={sheets}
            projectName={projectName}
            onClose={() => setShowLists(false)}
          />
        )}
        {showNumbering && (
          <NumberingSettingsPanel
            numbering={numbering}
            sheets={sheets}
            onTagChange={setTagNumbering}
            onLineChange={setLineNumbering}
            unnumberedCount={unnumberedOnActiveSheet}
            onNumberUnnumbered={numberUnnumberedLines}
            onClose={() => setShowNumbering(false)}
          />
        )}
        {connectNotice && (
          <ConnectNoticePanel notice={connectNotice} onPlaceTee={addTeeAt} onDismiss={() => setConnectNotice(null)} />
        )}
        {autosaveNotice && (
          <div className="autosave-notice" data-testid="autosave-notice" role="status">
            {autosaveNotice}
            <button onClick={dismissAutosaveNotice} aria-label="Dismiss autosave notice">
              ✕
            </button>
          </div>
        )}
        <div className="app-body">
          {(selectedNode || selectedEdge) && (
            <div className="left-rail">
              {selectedNode ? (
                <DataSheetPanel
                  nodeId={selectedNode.id}
                  data={selectedNode.data as unknown as EquipmentNodeData}
                  connectedPortIds={connectedPortIds}
                  onUpdateData={updateNodeData}
                  onClose={() => setSelectedNodeId(null)}
                  sheets={sheetsForRefs}
                  currentSheetId={activeSheetId}
                />
              ) : selectedEdge ? (
                <LineDataSheetPanel
                  edgeId={selectedEdge.id}
                  data={selectedEdge.data as unknown as PipeEdgeData}
                  existingLineNumbers={allLineNumbers}
                  onUpdateData={updateEdgeData}
                  onClose={() => setSelectedEdgeId(null)}
                />
              ) : null}
            </div>
          )}
          <div className="canvas-column">
            <div className="canvas-wrapper" ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>
              <ReactFlow
                nodes={nodesWithHighlights}
                edges={pipedEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                isValidConnection={isValidConnection}
                onConnectEnd={handleConnectEnd}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeClick={onNodeClick}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                connectionLineComponent={PipeConnectionLine}
                deleteKeyCode={['Delete', 'Backspace']}
                snapToGrid
                snapGrid={[GRID, GRID]}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={GRID} />
                <Controls />
                <FreeLineLayer
                  lines={freeLines.map((e) => ({ id: e.id, data: e.data as PipeEdgeData }))}
                  selectedId={selectedFreeLineId}
                  onSelect={setSelectedFreeLineId}
                  onDelete={removeEdge}
                />

              </ReactFlow>
              {editingNodeId && (
                <div className="tag-edit-overlay">
                  <div className="tag-edit-box">
                    <label htmlFor="tag-edit-input">Equipment / instrument tag</label>
                    <input
                      id="tag-edit-input"
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitTagEdit();
                        if (e.key === 'Escape') setEditingNodeId(null);
                      }}
                    />
                    <div className="tag-edit-actions">
                      <button onClick={handleCommitTagEdit}>Save</button>
                      <button onClick={() => setEditingNodeId(null)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <SheetTabs
              sheets={sheets}
              activeSheetId={activeSheetId}
              onSelect={handleSheetSelect}
              onAdd={addSheet}
              onRename={renameSheet}
              onReorder={reorderSheet}
              onDelete={handleSheetDelete}
            />
          </div>
          <div className="right-rail">
            <ValidationPanel errors={projectValidation.errors} specWarnings={specWarnings} tagWarnings={tagWarnings} nozzleWarnings={nozzleWarnings} />
            <SymbolPalette />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <DrawingCanvas />
    </ReactFlowProvider>
  );
}
