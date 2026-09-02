import { GROUP_WEIGHT, isHubArticle, type RelationGroup } from '../services/wiki/properties';

export interface Candidate {
  title: string;
  qid?: string;
  /** Strongest Wikidata relation found linking this candidate to the source. */
  group?: RelationGroup;
  relationLabel?: string;
  /** Rank in the morelike result list, if present. */
  morelikeRank?: number;
  /** Position in the source article's outbound link list, if present. */
  linkPosition?: number;
  linkCount?: number;
  mutualLink?: boolean;
  year?: number;
}

export interface ScoreContext {
  chronological: boolean;
  /** Seed year, used to damp topics far outside the era of interest. */
  seedYear?: number;
  timeWindow?: number;
}

const MORELIKE_WEIGHT = 1.5;
const MUTUAL_LINK_WEIGHT = 1.0;
const LINK_POSITION_WEIGHT = 0.5;
const UNDATED_PENALTY = 1.5;
const OUT_OF_WINDOW_PENALTY = 2.0;

export function scoreCandidate(c: Candidate, ctx: ScoreContext): number {
  let score = 0;

  if (c.group) score += GROUP_WEIGHT[c.group];

  if (c.morelikeRank !== undefined && c.morelikeRank >= 0) {
    // Decay by rank so the top relevance hits dominate.
    score += MORELIKE_WEIGHT * (1 / (1 + c.morelikeRank * 0.15));
  }

  if (c.mutualLink) score += MUTUAL_LINK_WEIGHT;

  if (c.linkPosition !== undefined && c.linkCount) {
    score += LINK_POSITION_WEIGHT * (1 - c.linkPosition / c.linkCount);
  }

  if (ctx.chronological && c.year === undefined) score -= UNDATED_PENALTY;

  if (
    ctx.timeWindow !== undefined &&
    ctx.seedYear !== undefined &&
    c.year !== undefined &&
    Math.abs(c.year - ctx.seedYear) > ctx.timeWindow
  ) {
    score -= OUT_OF_WINDOW_PENALTY;
  }

  return score;
}

/**
 * Rank candidates and keep the best `limit`. Ties break on title so that
 * repeated runs with identical inputs produce identical maps.
 */
export function rankCandidates(
  candidates: Candidate[],
  limit: number,
  ctx: ScoreContext,
): { candidate: Candidate; score: number }[] {
  return candidates
    .filter((c) => !isHubArticle(c.title))
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, ctx) }))
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .slice(0, limit);
}

/** Merge duplicate candidates for the same article, keeping the strongest signals. */
export function mergeCandidates(candidates: Candidate[]): Candidate[] {
  const byTitle = new Map<string, Candidate>();

  for (const c of candidates) {
    const existing = byTitle.get(c.title);
    if (!existing) {
      byTitle.set(c.title, { ...c });
      continue;
    }
    if (c.group && (!existing.group || GROUP_WEIGHT[c.group] > GROUP_WEIGHT[existing.group])) {
      existing.group = c.group;
      existing.relationLabel = c.relationLabel;
    }
    if (c.morelikeRank !== undefined) {
      existing.morelikeRank =
        existing.morelikeRank === undefined
          ? c.morelikeRank
          : Math.min(existing.morelikeRank, c.morelikeRank);
    }
    if (c.linkPosition !== undefined) {
      existing.linkPosition =
        existing.linkPosition === undefined
          ? c.linkPosition
          : Math.min(existing.linkPosition, c.linkPosition);
      existing.linkCount = c.linkCount ?? existing.linkCount;
    }
    existing.mutualLink = existing.mutualLink || c.mutualLink;
    existing.qid = existing.qid ?? c.qid;
    if (existing.year === undefined) existing.year = c.year;
  }

  return [...byTitle.values()];
}
