import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ContextGraph, ContextNode, NodeKind } from '../types';
import { KIND_STYLE, toFlowNodes, toFlowEdges, applyDagreLayout } from '../types';
import ContextNodeComponent from './ContextNodeComponent';

interface YarnMapProps {
  graph: ContextGraph;
  selectedId: string | null;
  onNodeClick: (node: ContextNode) => void;
  onPaneClick: () => void;
}

const nodeTypes = { contextNode: ContextNodeComponent };

const EDGE_COLOR = '#475569';
const EDGE_COLOR_DIM = '#334155';
const EDGE_COLOR_ACTIVE = '#60a5fa';

/** Style edges by selection: plain when nothing is selected, otherwise highlight (and label) those touching the selected node */
function styleEdge(edge: Edge, selectedId: string | null): Edge {
  if (selectedId === null) {
    return {
      ...edge,
      style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
    };
  }
  if (edge.source === selectedId || edge.target === selectedId) {
    return {
      ...edge,
      animated: true,
      label: (edge.data as { label?: string } | undefined)?.label,
      style: { stroke: EDGE_COLOR_ACTIVE, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR_ACTIVE },
      labelStyle: { fill: '#cbd5e1', fontSize: 11 },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      zIndex: 10,
    };
  }
  return {
    ...edge,
    style: { stroke: EDGE_COLOR_DIM, strokeWidth: 1.5, opacity: 0.15 },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR_DIM },
  };
}

function YarnMapInner({ graph, selectedId, onNodeClick, onPaneClick }: YarnMapProps) {
  const rawNodes = useMemo(() => toFlowNodes(graph.nodes), [graph]);
  const rawEdges = useMemo(() => toFlowEdges(graph.edges), [graph]);
  const layoutNodes = useMemo(() => applyDagreLayout(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const { fitView } = useReactFlow();

  // Reset layout and refit only when the graph itself changes (not on selection)
  useEffect(() => {
    setNodes(layoutNodes);
    // Give React Flow a tick to render, then fit the view
    requestAnimationFrame(() => fitView({ padding: 0.18 }));
  }, [layoutNodes, setNodes, fitView]);

  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId],
  );
  const displayEdges = useMemo(
    () => rawEdges.map((e) => styleEdge(e, selectedId)),
    [rawEdges, selectedId],
  );

  const presentKinds = useMemo(
    () => (Object.keys(KIND_STYLE) as NodeKind[]).filter((k) => graph.nodes.some((n) => n.kind === k)),
    [graph.nodes],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const contextNode = graph.nodes.find((n) => n.id === node.id);
      if (contextNode) onNodeClick(contextNode);
    },
    [graph.nodes, onNodeClick],
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#334155" gap={20} />
        <Controls
          className="!bg-slate-800 !border-slate-600 !shadow-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
        />
        <MiniMap
          nodeColor={(n) => (n.data as { color?: string }).color ?? '#3b82f6'}
          maskColor="rgba(15, 23, 42, 0.8)"
          className="!bg-slate-800 !border-slate-600"
          style={{ width: 140, height: 90 }}
        />
        {presentKinds.length > 0 && (
          <Panel position="top-left">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 max-w-xs px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-600 text-[11px] text-slate-300">
              {presentKinds.map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: KIND_STYLE[k].color }} />
                  {KIND_STYLE[k].label}
                </span>
              ))}
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export default function YarnMap(props: YarnMapProps) {
  return (
    <ReactFlowProvider>
      <YarnMapInner {...props} />
    </ReactFlowProvider>
  );
}
