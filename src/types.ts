import type { Node, Edge } from '@xyflow/react';

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
  const count = nodes.length;
  const centerX = 400;
  const centerY = 300;
  const radiusX = 320;
  const radiusY = 220;

  return nodes.map((n, i) => {
    // Arrange in an arc/ellipse so they don't overlap
    const angle = (Math.PI / (count - 1 || 1)) * i - Math.PI / 2;
    const x = count === 1 ? centerX : centerX + radiusX * Math.cos(angle);
    const y = count === 1 ? centerY : centerY + radiusY * Math.sin(angle) + 100;
    const color = NODE_COLORS[i % Object.keys(NODE_COLORS).length];

    return {
      id: n.id,
      type: 'contextNode',
      position: { x, y },
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
