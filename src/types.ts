import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';

/** A single event/concept on the yarn map */
export interface ContextNode {
  id: string;
  label: string;
  year?: string;
  summary: string;
  wikipediaUrl?: string;
}

/** A causal link between two nodes */
export interface ContextEdge {
  source: string;
  target: string;
  label: string;
}

/** Full graph returned by the API */
export interface ContextGraph {
  title: string;
  summary: string;
  nodes: ContextNode[];
  edges: ContextEdge[];
}

/** Wikipedia search result entry */
export interface WikiSearchResult {
  title: string;
  description: string;
  pageId: number;
  url: string;
}

/** Context depth presets controlling time range and analytical breadth */
export type ContextDepth = 'narrow' | 'standard' | 'extended' | 'deep';

export const DEPTH_OPTIONS: { value: ContextDepth; label: string; description: string }[] = [
  { value: 'narrow',   label: 'Narrow (50 yr)',       description: 'Direct causes and immediate aftermath' },
  { value: 'standard', label: 'Standard (100 yr)',     description: 'Key historical context and consequences' },
  { value: 'extended', label: 'Extended (200 yr)',      description: 'Socioeconomic and cultural factors' },
  { value: 'deep',     label: 'Deep History (500 yr)',  description: 'Philosophical shifts, collective unconscious, long-chain causality' },
];

/* ── helpers to convert ContextGraph → React Flow ── */

const NODE_COLORS: Record<number, string> = {
  0: '#3b82f6', // blue
  1: '#8b5cf6', // violet
  2: '#ec4899', // pink
  3: '#f97316', // orange
  4: '#10b981', // emerald
  5: '#06b6d4', // cyan
  6: '#eab308', // yellow
};

export function toFlowNodes(nodes: ContextNode[]): Node[] {
  return nodes.map((n, i) => {
    const color = NODE_COLORS[i % Object.keys(NODE_COLORS).length];
    return {
      id: n.id,
      type: 'contextNode',
      position: { x: 0, y: 0 }, // placeholder — dagre will set real positions
      data: { ...n, color },
    };
  });
}

export function toFlowEdges(edges: ContextEdge[]): Edge[] {
  return edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    style: { stroke: '#64748b', strokeWidth: 2 },
    labelStyle: { fill: '#94a3b8', fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.85 },
    labelBgPadding: [6, 3] as [number, number],
  }));
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

/** Apply dagre layout to position nodes hierarchically (left → right, chronological) */
export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}
