import type { ContextGraph, ContextNode, ContextEdge, GraphSettings } from '../types';
import { NODE_BUDGET, widthForHop } from '../types';
import { getArticleMeta, getRelatedArticles, getOutboundLinks } from '../services/wiki/articles';
import { expandFrontier, getDates, type WikidataRelation } from '../services/wiki/wikidata';
import { RELATION_BY_PID } from '../services/wiki/properties';
import { resolveYear } from './dates';
import { mergeCandidates, rankCandidates, type Candidate } from './ranking';

export interface BuildOptions extends GraphSettings {
  timeWindow?: number;
  signal?: AbortSignal;
}

interface WorkingNode extends ContextNode {
  outboundLinks?: Set<string>;
}

/** Tracks request count and swallows per-source failures so one outage cannot blank the map. */
class BuildSession {
  requests = 0;
  degraded = false;
  readonly failures: string[] = [];

  async run<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    this.requests++;
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      console.warn(`[contextmap] ${label} failed:`, err);
      this.degraded = true;
      this.failures.push(label);
      return fallback;
    }
  }
}

export async function buildGraph(seedTitle: string, opts: BuildOptions): Promise<ContextGraph> {
  const { depth, width, timeWindow, signal } = opts;
  const session = new BuildSession();
  const chronological = opts.layout === 'chronological';

  const seedMetaMap = await session.run(
    'seed metadata',
    () => getArticleMeta([seedTitle], signal),
    new Map(),
  );
  const seedMeta = seedMetaMap.get(seedTitle) ?? [...seedMetaMap.values()][0];
  if (!seedMeta) throw new Error(`Could not load the article "${seedTitle}".`);

  const nodes = new Map<string, WorkingNode>();
  const edges: ContextEdge[] = [];

  const seedDates = seedMeta.qid
    ? await session.run('seed date', () => getDates([seedMeta.qid!], signal), new Map<string, number>())
    : new Map<string, number>();
  const seedYear = resolveYear(
    seedMeta.qid ? seedDates.get(seedMeta.qid) : undefined,
    seedMeta.title,
    seedMeta.extract,
  );

  nodes.set(seedMeta.title, {
    id: seedMeta.title,
    label: seedMeta.title,
    title: seedMeta.title,
    qid: seedMeta.qid,
    year: seedYear,
    summary: seedMeta.extract,
    thumbnail: seedMeta.thumbnail,
    wikipediaUrl: seedMeta.url,
    hop: 0,
    score: Number.POSITIVE_INFINITY,
  });

  let frontier: WorkingNode[] = [nodes.get(seedMeta.title)!];

  for (let hop = 0; hop < depth; hop++) {
    if (nodes.size >= NODE_BUDGET) break;

    const limit = widthForHop(width, hop);
    const relations = await collectRelations(frontier, session, signal);
    const perNodeCandidates = await collectCandidates(frontier, relations, session, signal);

    const selected: { parent: WorkingNode; candidate: Candidate; score: number }[] = [];
    for (const [parent, candidates] of perNodeCandidates) {
      const ranked = rankCandidates(mergeCandidates(candidates), limit, {
        chronological,
        seedYear,
        timeWindow,
      });
      for (const r of ranked) selected.push({ parent, ...r });
    }

    const newTitles = [
      ...new Set(selected.map((s) => s.candidate.title).filter((t) => !nodes.has(t))),
    ].slice(0, NODE_BUDGET - nodes.size);

    if (newTitles.length === 0) break;

    const metaMap = await session.run(
      `metadata hop ${hop + 1}`,
      () => getArticleMeta(newTitles, signal),
      new Map(),
    );

    const nextFrontier: WorkingNode[] = [];
    for (const { parent, candidate, score } of selected) {
      const meta = metaMap.get(candidate.title);

      if (meta && !nodes.has(meta.title)) {
        const node: WorkingNode = {
          id: meta.title,
          label: meta.title,
          title: meta.title,
          qid: meta.qid ?? candidate.qid,
          year: resolveYear(candidate.year, meta.title, meta.extract),
          summary: meta.extract,
          thumbnail: meta.thumbnail,
          wikipediaUrl: meta.url,
          hop: hop + 1,
          score,
        };
        nodes.set(meta.title, node);
        nextFrontier.push(node);
      }

      const targetTitle = meta?.title ?? candidate.title;
      if (!nodes.has(targetTitle) || targetTitle === parent.title) continue;
      if (edges.some((e) => e.source === parent.title && e.target === targetTitle)) continue;

      edges.push({
        source: parent.title,
        target: targetTitle,
        label: candidate.relationLabel ?? 'closely related',
        group: candidate.group,
        inferred: !candidate.group,
      });
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return {
    title: seedMeta.title,
    summary: seedMeta.extract.split('\n')[0] ?? '',
    nodes: [...nodes.values()].map(stripInternal),
    edges,
    requestCount: session.requests,
    degraded: session.degraded,
  };
}

function stripInternal(node: WorkingNode): ContextNode {
  const rest = { ...node };
  delete rest.outboundLinks;
  return rest;
}

/** One SPARQL call expands the whole frontier; a failure degrades to link-only edges. */
async function collectRelations(
  frontier: WorkingNode[],
  session: BuildSession,
  signal?: AbortSignal,
): Promise<Map<string, WikidataRelation[]>> {
  const qids = frontier.map((n) => n.qid).filter((q): q is string => Boolean(q));
  const byQid = new Map<string, WikidataRelation[]>();
  if (qids.length === 0) return byQid;

  const relations = await session.run('wikidata expansion', () => expandFrontier(qids, signal), []);

  for (const rel of relations) {
    const list = byQid.get(rel.fromQid);
    if (list) list.push(rel);
    else byQid.set(rel.fromQid, [rel]);
  }
  return byQid;
}

async function collectCandidates(
  frontier: WorkingNode[],
  relations: Map<string, WikidataRelation[]>,
  session: BuildSession,
  signal?: AbortSignal,
): Promise<Map<WorkingNode, Candidate[]>> {
  const result = new Map<WorkingNode, Candidate[]>();

  const perNode = await Promise.all(
    frontier.map(async (node) => {
      // Link position only informs ranking near the seed, and each fetch costs a
      // request per node per hop — by far the largest driver of build time.
      const wantLinks = node.hop === 0;
      const [related, links] = await Promise.all([
        session.run(`morelike ${node.title}`, () => getRelatedArticles(node.title, 20, signal), []),
        wantLinks
          ? session.run(`links ${node.title}`, () => getOutboundLinks(node.title, 300, signal), [])
          : Promise.resolve<string[]>([]),
      ]);
      return { node, related, links };
    }),
  );

  for (const { node, related, links } of perNode) {
    node.outboundLinks = new Set(links);
    const candidates: Candidate[] = [];

    for (const rel of relations.get(node.qid ?? '') ?? []) {
      candidates.push({
        title: rel.toTitle,
        qid: rel.toQid,
        group: RELATION_BY_PID.get(rel.pid)?.group,
        relationLabel: rel.label,
        year: rel.year,
      });
    }

    related.forEach((title, i) => candidates.push({ title, morelikeRank: i }));

    links.forEach((title, i) =>
      candidates.push({ title, linkPosition: i, linkCount: links.length }),
    );

    // A link back to the parent is a strong two-way relevance signal.
    for (const c of candidates) {
      const parentLinks = node.outboundLinks;
      if (parentLinks?.has(c.title)) c.mutualLink = true;
    }

    result.set(node, candidates);
  }

  return result;
}
