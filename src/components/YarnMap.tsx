import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ContextGraph, ContextNode } from '../types';
import { toFlowNodes, toFlowEdges } from '../types';
import ContextNodeComponent from './ContextNodeComponent';

interface YarnMapProps {
  graph: ContextGraph;
  onNodeClick: (node: ContextNode) => void;
}

const nodeTypes = { contextNode: ContextNodeComponent };

export default function YarnMap({ graph, onNodeClick }: YarnMapProps) {
  const initialNodes = useMemo(() => toFlowNodes(graph.nodes), [graph]);
  const initialEdges = useMemo(() => toFlowEdges(graph.edges), [graph]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
