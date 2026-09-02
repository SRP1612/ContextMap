import type { RelationGroup } from './services/wiki/properties';

/** A single article on the map. */
export interface ContextNode {
  id: string;
  label: string;
  title: string;
  qid?: string;
  /** Negative values are BCE. Undefined means no date could be resolved. */
  year?: number;
  summary: string;
  thumbnail?: string;
  wikipediaUrl: string;
  /** Hops from the seed article; 0 is the seed itself. */
  hop: number;
  score: number;
}

export interface ContextEdge {
  source: string;
  target: string;
  label: string;
  /** Undefined for link-strength edges, which carry no verifiable relation type. */
  group?: RelationGroup;
  /** True when derived from relatedness rather than a Wikidata property. */
  inferred: boolean;
}

export interface ContextGraph {
  title: string;
  summary: string;
  nodes: ContextNode[];
  edges: ContextEdge[];
  /** Number of HTTP requests used to build the graph; surfaced in the UI. */
  requestCount: number;
  /** Set when Wikidata was unreachable and the map fell back to link strength only. */
  degraded?: boolean;
}

export interface WikiSearchResult {
  title: string;
  description: string;
  pageId: number;
  url: string;
}

export type LayoutMode = 'chronological' | 'radial';

/** User-facing controls. Depth = hops outward, width = branches kept per article. */
export interface GraphSettings {
  depth: number;
  width: number;
  layout: LayoutMode;
}

export const DEPTH_RANGE = { min: 1, max: 3 } as const;
export const WIDTH_RANGE = { min: 2, max: 8 } as const;
export const NODE_BUDGET = 40;

export const DEFAULT_SETTINGS: GraphSettings = {
  depth: 2,
  width: 5,
  layout: 'chronological',
};

/** Width shrinks with distance so hops 2 and 3 do not explode the node count. */
export function widthForHop(width: number, hop: number): number {
  return Math.max(1, Math.ceil(width / (hop + 1)));
}

export function formatYear(year?: number): string {
  if (year === undefined) return '—';
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}
