import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import type { ContextNode, ContextEdge, LayoutMode } from '../types';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 84;

/** Node colour by hop distance rather than arbitrary index, so depth is readable. */
const HOP_COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'];

export function toFlowNodes(nodes: ContextNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: 'contextNode',
    position: { x: 0, y: 0 },
    data: { ...n, color: HOP_COLORS[Math.min(n.hop, HOP_COLORS.length - 1)] },
  }));
}

export function toFlowEdges(edges: ContextEdge[]): Edge[] {
  return edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: !e.inferred,
    style: {
      stroke: e.inferred ? '#475569' : '#64748b',
      strokeWidth: e.inferred ? 1.5 : 2,
      strokeDasharray: e.inferred ? '4 4' : undefined,
    },
    labelStyle: { fill: '#94a3b8', fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.85 },
    labelBgPadding: [6, 3] as [number, number],
  }));
}

/** Left-to-right by date. Undated nodes inherit rank from their graph position. */
function chronologicalLayout(nodes: Node[], edges: Edge[], source: ContextNode[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 140, ranker: 'longest-path' });

  const yearById = new Map(source.map((n) => [n.id, n.year]));
  const dated = source.filter((n) => n.year !== undefined).sort((a, b) => a.year! - b.year!);
  const rankByYear = new Map<number, number>();
  dated.forEach((n, i) => {
    if (!rankByYear.has(n.year!)) rankByYear.set(n.year!, i);
  });

  nodes.forEach((node) => {
    const year = yearById.get(node.id);
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rank: year !== undefined ? rankByYear.get(year) : undefined,
    });
  });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}

/** Seed at the centre, one ring per hop, ordered by score within each ring. */
function radialLayout(nodes: Node[], source: ContextNode[]): Node[] {
  const RING_SPACING = 340;
  const byHop = new Map<number, ContextNode[]>();
  for (const n of source) {
    const list = byHop.get(n.hop);
    if (list) list.push(n);
    else byHop.set(n.hop, [n]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [hop, ring] of byHop) {
    const ordered = [...ring].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    if (hop === 0) {
      ordered.forEach((n) => positions.set(n.id, { x: 0, y: 0 }));
      continue;
    }
    const radius = hop * RING_SPACING;
    ordered.forEach((n, i) => {
      const angle = (i / ordered.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(n.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
  }));
}

export function applyLayout(
  mode: LayoutMode,
  nodes: Node[],
  edges: Edge[],
  source: ContextNode[],
): Node[] {
  return mode === 'radial'
    ? radialLayout(nodes, source)
    : chronologicalLayout(nodes, edges, source);
}
