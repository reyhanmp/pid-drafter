import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EquipmentNode from './components/EquipmentNode';
import PipeEdge from './edges/PipeEdge';
import SymbolPalette from './components/SymbolPalette';
import ValidationPanel from './components/ValidationPanel';
import { symbolsByKind } from './symbols';
import { getRenderedPorts } from './symbols/effectivePorts';
import { toReactFlowHandles } from './symbols/toReactFlowHandles';
import DataSheetPanel from './components/DataSheetPanel';
import LineDataSheetPanel from './components/LineDataSheetPanel';
import { validateDiagram, type DiagramEdge, type DiagramNode } from './validation/validateDiagram';
import { validateSpecCompatibility } from './validation/specValidation';
import { getLoopMateIds } from './validation/instrumentLoops';
import type { EquipmentNodeData, PipeEdgeData } from './types/diagram';
import './App.css';

const nodeTypes = { equipment: EquipmentNode };
const edgeTypes = { pipe: PipeEdge };

const GRID = 20;

let tagCounter: Record<string, number> = {};
function nextTag(prefix: string): string {
  tagCounter[prefix] = (tagCounter[prefix] ?? 0) + 1;
  return `${prefix}-${100 + tagCounter[prefix]}`;
}

function DrawingCanvas() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  /**
   * onConnect fires only when react-flow has resolved a drag onto a
   * valid Handle — since every Handle on an EquipmentNode corresponds
   * 1:1 to a declared symbol port, this structurally guarantees pipes
   * can only originate/terminate at real ports (PRD 4.1/4.3).
   * We stash each endpoint's port normal onto the edge's data so the
   * custom PipeEdge renderer can build an orthogonal path that respects
   * both directions.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
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
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [nodes],
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

      const id = `${symbol.kind}-${Date.now()}`;
      const newNode: Node = {
        id,
        type: 'equipment',
        position,
        // Declared directly (not measured from the DOM) so React Flow's
        // handle bounds are always correct from the first render, and
        // stay correct if this node's ports are later customized - see
        // toReactFlowHandles.ts for why this avoids a real timing race.
        handles: toReactFlowHandles(symbol.ports),
        data: {
          kind: symbol.kind,
          tag: nextTag(symbol.tagPrefix),
          width: symbol.defaultWidth,
          height: symbol.defaultHeight,
          // Stable callback reference (updateNodeData is a useCallback with
          // no deps) stashed directly on node.data so EquipmentNode can
          // drive nozzle-drag repositions through the SAME update path the
          // DataSheetPanel's numeric/rotation controls use, without a
          // parallel state-update mechanism. See EquipmentNode.tsx's drag
          // handlers.
          __updateNodeData: updateNodeData,
        } satisfies EquipmentNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition],
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

  const updateEdgeData = useCallback((edgeId: string, patch: Partial<PipeEdgeData>) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e;
        const nextData = { ...e.data, ...patch } as PipeEdgeData & Record<string, unknown>;
        const updated: Edge = { ...e, data: nextData };
        // Line type toggle should also flip the arrowhead marker convention
        // used at creation time (process lines carry a directional arrow,
        // signal/instrument lines do not).
        if ('lineType' in patch) {
          updated.markerEnd =
            nextData.lineType === 'process' ? { type: MarkerType.ArrowClosed, width: 14, height: 14 } : undefined;
        }
        return updated;
      }),
    );
  }, []);

  const updateNodeData = useCallback((nodeId: string, patch: Partial<EquipmentNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const nextData = { ...n.data, ...patch };
        const updated: Node = { ...n, data: nextData };
        // If this patch changes the node's effective ports (nozzle
        // added/removed/repositioned/dragged) OR its rotation, keep
        // node.handles in lockstep so React Flow's connection system
        // never reads stale geometry - see toReactFlowHandles.ts. Handles
        // must always be built from the RENDERED (rotated) port set, not
        // the raw unrotated ports, or connections would land in the
        // wrong place on a rotated node.
        if ('ports' in patch || 'rotation' in patch) {
          const nd = nextData as unknown as EquipmentNodeData;
          const renderedPorts = getRenderedPorts(nd.kind, nd.ports, nd.rotation, nd.width, nd.height);
          updated.handles = toReactFlowHandles(renderedPorts);
        }
        return updated;
      }),
    );
  }, []);

  const commitTagEdit = useCallback(() => {
    if (!editingNodeId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === editingNodeId ? { ...n, data: { ...n.data, tag: editingValue.trim() } } : n)),
    );
    setEditingNodeId(null);
  }, [editingNodeId, editingValue]);

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
  const validation = useMemo(() => validateDiagram(diagramNodes, diagramEdges), [diagramNodes, diagramEdges]);
  const specWarnings = useMemo(() => validateSpecCompatibility(diagramNodes, diagramEdges), [diagramNodes, diagramEdges]);

  /**
   * Instrument loop cross-referencing (PRD §4.7): purely hover-driven,
   * per explicit user decision ("hover only — highlight while hovering,
   * clears on mouse-leave"). Does NOT fall back to node selection —
   * selecting a node (to open its data sheet) is a persistent state,
   * unrelated to the transient/exploratory hover signal this feature is
   * meant to be; falling back to selection would make the highlight
   * "stick" any time a user opens a data sheet, which is not what was
   * asked for. Purely derived from tag text via getLoopMateIds — no
   * separate loop-membership state to maintain.
   */
  const activeLoopNodeId = hoveredNodeId;
  const loopMateIds = useMemo(() => getLoopMateIds(diagramNodes, activeLoopNodeId), [diagramNodes, activeLoopNodeId]);

  /**
   * Feed loop-highlight state into each node's data so EquipmentNode can
   * render a highlight ring without a parallel prop-drilling path — same
   * pattern already used for __updateNodeData. Only nodes that are
   * currently a loop mate (or the active node itself) get a truthy flag;
   * everything else stays visually unchanged.
   */
  const nodesWithLoopHighlight = useMemo(
    () =>
      nodes.map((n) => {
        const isActive = n.id === activeLoopNodeId && loopMateIds.size > 0;
        const isMate = loopMateIds.has(n.id);
        if (!isActive && !isMate) {
          if (!('__loopHighlight' in n.data)) return n;
          const { __loopHighlight: _drop, ...rest } = n.data as Record<string, unknown>;
          return { ...n, data: rest };
        }
        return { ...n, data: { ...n.data, __loopHighlight: true } };
      }),
    [nodes, activeLoopNodeId, loopMateIds],
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
      {(selectedNode || selectedEdge) && (
        <div className="left-rail">
          {selectedNode ? (
            <DataSheetPanel
              nodeId={selectedNode.id}
              data={selectedNode.data as unknown as EquipmentNodeData}
              connectedPortIds={connectedPortIds}
              onUpdateData={updateNodeData}
              onClose={() => setSelectedNodeId(null)}
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
      <div className="canvas-wrapper" ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodesWithLoopHighlight}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Delete', 'Backspace']}
          snapToGrid
          snapGrid={[GRID, GRID]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={GRID} />
          <Controls />
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
                  if (e.key === 'Enter') commitTagEdit();
                  if (e.key === 'Escape') setEditingNodeId(null);
                }}
              />
              <div className="tag-edit-actions">
                <button onClick={commitTagEdit}>Save</button>
                <button onClick={() => setEditingNodeId(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="right-rail">
        <ValidationPanel errors={validation.errors} specWarnings={specWarnings} />
        <SymbolPalette />
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
