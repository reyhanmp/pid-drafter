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
import SymbolPalette from './components/SymbolPalette';
import ValidationPanel from './components/ValidationPanel';
import DataSheetPanel from './components/DataSheetPanel';
import LineDataSheetPanel from './components/LineDataSheetPanel';
import SheetTabs from './components/SheetTabs';
import ProjectTopBar from './components/ProjectTopBar';
import { useProject } from './project/useProject';
import { symbolsByKind } from './symbols';
import { validateDiagram, validateProject, type DiagramNode, type DiagramEdge } from './validation/validateDiagram';
import { validateSpecCompatibility } from './validation/specValidation';
import { getProjectLoopMates } from './validation/instrumentLoops';
import { offpageDisplayLabel, isOffpageConnector } from './validation/offpageReferences';
import type { EquipmentNodeData, PipeEdgeData } from './types/diagram';
import './App.css';

const nodeTypes = { equipment: EquipmentNode };
const edgeTypes = { pipe: PipeEdge };

const GRID = 20;

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
  } = store;

  const nodes = activeSheet?.nodes ?? [];
  const edges = activeSheet?.edges ?? [];

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
   */
  const nodesWithHighlights = useMemo(
    () =>
      nodes.map((n) => {
        const data = n.data as unknown as EquipmentNodeData;
        const isActive = n.id === hoveredNodeId && loopHighlight.onSheetMateIds.size + loopHighlight.offSheetMateCount > 0;
        const isMate = loopHighlight.onSheetMateIds.has(n.id);

        const patch: Record<string, unknown> = {};
        const strip: string[] = [];

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
    [nodes, hoveredNodeId, loopHighlight, sheetsForRefs],
  );

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
          project={project}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          autosaveStatus={autosaveStatus}
          onLoad={handleLoad}
          onOpenLists={() => setShowLists(true)}
        />
        {showLists && (
          <EngineeringListsPanel
            sheets={sheets}
            projectName={projectName}
            onClose={() => setShowLists(false)}
          />
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
            <ValidationPanel errors={projectValidation.errors} specWarnings={specWarnings} />
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
