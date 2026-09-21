import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ContextGraph, ContextNode } from '../types';
import { toFlowNodes, toFlowEdges, applyDagreLayout } from '../types';
import ContextNodeComponent from './ContextNodeComponent';

interface YarnMapProps {
  graph: ContextGraph;
  onNodeClick: (node: ContextNode) => void;
}

const nodeTypes = { contextNode: ContextNodeComponent };

function YarnMapInner({ graph, onNodeClick }: YarnMapProps) {
  const rawNodes = useMemo(() => toFlowNodes(graph.nodes), [graph]);
  const rawEdges = useMemo(() => toFlowEdges(graph.edges), [graph]);
  const layoutNodes = useMemo(() => applyDagreLayout(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);
  const { fitView } = useReactFlow();

  // Update nodes/edges when graph prop changes
  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(rawEdges);
    // Give React Flow a tick to render, then fit the view
    requestAnimationFrame(() => fitView({ padding: 0.3 }));
  }, [layoutNodes, rawEdges, setNodes, setEdges, fitView]);

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
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#334155" gap={20} />
        <Controls
          className="!bg-slate-800 !border-slate-600 !shadow-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
        />
        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(15, 23, 42, 0.8)"
          className="!bg-slate-800 !border-slate-600"
        />
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
