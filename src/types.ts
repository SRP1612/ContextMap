import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';

/** What role a node plays relative to the searched subject */
export type NodeKind = 'subject' | 'cause' | 'consequence' | 'person' | 'place' | 'idea' | 'parallel';

/** A single event/concept on the yarn map */
export interface ContextNode {
  id: string;
  label: string;
  kind?: NodeKind;
  /** Display label for the date, e.g. "1789" or "c. 1540s" */
  year?: string;
  /** Numeric years (BCE negative) — used for sorting and window enforcement */
  startYear?: number;
  endYear?: number;
  /** One-line "why this matters" */
  hook?: string;
  summary: string;
  wikipediaUrl?: string;
}

/** A causal link between two nodes */
export interface ContextEdge {
  source: string;
  target: string;
  label: string;
}

/** The time window a graph was generated for */
export interface ContextWindow {
  label: string;
  startYear: number | null;
  endYear: number | null;
  anchorYear: number;
}

/** Full graph returned by the API */
export interface ContextGraph {
  title: string;
  summary: string;
  subjectKind?: string;
  window?: ContextWindow;
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

/** Scale presets controlling the time window and analytical breadth */
export type ContextScale = 'immediate' | 'generational' | 'historical' | 'deep';

export const SCALE_OPTIONS: { value: ContextScale; label: string; description: string }[] = [
  { value: 'immediate',    label: 'Immediate (~15 yr)',    description: 'Run-up and aftermath: specific people, decisions and incidents' },
  { value: 'generational', label: 'Generational (~75 yr)', description: 'Movements, policies and technologies within living memory' },
  { value: 'historical',   label: 'Historical (~300 yr)',  description: 'Institutions, ideologies and economic systems' },
  { value: 'deep',         label: 'Deep time',             description: 'Origins and long-run roots, as far back as they go' },
];

/** Display style per node kind */
export const KIND_STYLE: Record<NodeKind, { label: string; color: string }> = {
  subject:     { label: 'Subject',     color: '#f8fafc' },
  cause:       { label: 'Cause',       color: '#f97316' },
  consequence: { label: 'Consequence', color: '#10b981' },
  person:      { label: 'Person',      color: '#3b82f6' },
  place:       { label: 'Place',       color: '#eab308' },
  idea:        { label: 'Idea',        color: '#8b5cf6' },
  parallel:    { label: 'Parallel',    color: '#ec4899' },
};

/** Style for a node's kind, or undefined for missing/unknown kinds */
export function kindStyle(kind: string | undefined): { label: string; color: string } | undefined {
  return kind && kind in KIND_STYLE ? KIND_STYLE[kind as NodeKind] : undefined;
}

/* ── helpers to convert ContextGraph → React Flow ── */

// Fallback palette for nodes without a (known) kind
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
    const color = kindStyle(n.kind)?.color ?? NODE_COLORS[i % Object.keys(NODE_COLORS).length];
    return {
      id: n.id,
      type: 'contextNode',
      position: { x: 0, y: 0 }, // placeholder — dagre will set real positions
      data: { ...n, color },
    };
  });
}

/** Plain edges; the map decides how to style them (depends on the current selection) */
export function toFlowEdges(edges: ContextEdge[]): Edge[] {
  return edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    data: { label: e.label },
  }));
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;

/** Apply dagre layout to position nodes hierarchically (left → right, chronological) */
export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 140 });

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
