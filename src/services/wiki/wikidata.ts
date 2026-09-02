import { fetchJson, SPARQL_API, queueSparql, withRetry } from './http';
import {
  RELATION_PROPERTIES,
  REVERSIBLE_PROPERTIES,
  DATE_PROPERTIES,
  RELATION_BY_PID,
  isHubArticle,
} from './properties';

export interface WikidataRelation {
  fromQid: string;
  toQid: string;
  toTitle: string;
  toLabel: string;
  pid: string;
  label: string;
  year?: number;
}

interface SparqlBinding {
  seed?: { value: string };
  item?: { value: string };
  prop?: { value: string };
  other?: { value: string };
  article?: { value: string };
  date?: { value: string };
  reverse?: boolean;
}

interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

const qidFromUri = (uri: string) => uri.split('/').pop() ?? '';
const pidFromUri = (uri: string) => uri.split('/').pop() ?? '';

/** Wikidata encodes years before 1 CE with a leading minus and pads to 4+ digits. */
function yearFromIso(iso?: string): number | undefined {
  if (!iso) return undefined;
  const match = /^(-?\d+)-/.exec(iso);
  if (!match) return undefined;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : undefined;
}

function titleFromArticleUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  const slug = uri.split('/wiki/').pop();
  if (!slug) return undefined;
  return decodeURIComponent(slug).replace(/_/g, ' ');
}

/**
 * Expand a whole frontier of QIDs in a single round trip per direction.
 * Only entities with an English Wikipedia article are returned, so every
 * node on the map is clickable.
 */
export async function expandFrontier(
  qids: string[],
  signal?: AbortSignal,
): Promise<WikidataRelation[]> {
  if (qids.length === 0) return [];

  // A single UNION query over a multi-QID frontier regularly exceeds the public
  // endpoint's budget; two directed queries in parallel are far cheaper.
  const [forward, reverse] = await Promise.all([
    runDirectedQuery(qids, 'forward', signal),
    runDirectedQuery(qids, 'reverse', signal),
  ]);

  return dedupe([...forward, ...reverse]);
}

async function runDirectedQuery(
  qids: string[],
  direction: 'forward' | 'reverse',
  signal?: AbortSignal,
): Promise<SparqlBinding[]> {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const activeProps = direction === 'forward' ? RELATION_PROPERTIES : REVERSIBLE_PROPERTIES;
  const props = activeProps.map((r) => `wdt:${r.pid}`).join(' ');
  const dateProps = DATE_PROPERTIES.map((p) => `wdt:${p}`).join('|');
  const triple = direction === 'forward' ? '?seed ?prop ?other.' : '?other ?prop ?seed.';

  // No wikibase:label service here — labels come free from the Wikipedia titles,
  // and the service roughly triples query time.
  const query = `
SELECT ?seed ?prop ?other ?article ?date WHERE {
  VALUES ?seed { ${values} }
  VALUES ?prop { ${props} }
  ${triple}
  ?article schema:about ?other ;
           schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?other ${dateProps} ?date. }
}
LIMIT 300`;

  const url = `${SPARQL_API}?format=json&query=${encodeURIComponent(query)}`;
  const data = await queueSparql(
    () => withRetry(() => fetchJson<SparqlResponse>(url, { signal, timeoutMs: 20_000 })),
    signal,
  );
  const bindings = data.results?.bindings ?? [];

  return direction === 'forward'
    ? bindings
    : bindings.map((b) => ({ ...b, reverse: true }) as SparqlBinding);
}

function dedupe(bindings: SparqlBinding[]): WikidataRelation[] {
  const byKey = new Map<string, WikidataRelation>();

  for (const b of bindings) {
    const title = titleFromArticleUri(b.article?.value);
    if (!title || isHubArticle(title)) continue;

    const fromQid = qidFromUri(b.seed?.value ?? '');
    const toQid = qidFromUri(b.other?.value ?? '');
    const pid = pidFromUri(b.prop?.value ?? '');
    if (!fromQid || !toQid || fromQid === toQid) continue;

    const relation = RELATION_BY_PID.get(pid);
    if (!relation) continue;

    const year = yearFromIso(b.date?.value);
    const key = `${fromQid}|${pid}|${toQid}`;
    const existing = byKey.get(key);

    // An entity can carry several date properties; always keep the earliest so
    // repeated runs produce identical output.
    if (existing) {
      if (year !== undefined && (existing.year === undefined || year < existing.year)) {
        existing.year = year;
      }
      continue;
    }

    byKey.set(key, {
      fromQid,
      toQid,
      toTitle: title,
      toLabel: title,
      pid,
      label: b.reverse ? relation.reverse : relation.forward,
      year,
    });
  }

  return [...byKey.values()];
}

/** Fetch dates for entities that were not dated during frontier expansion. */
export async function getDates(
  qids: string[],
  signal?: AbortSignal,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (qids.length === 0) return out;

  const values = qids.map((q) => `wd:${q}`).join(' ');
  const dateProps = DATE_PROPERTIES.map((p) => `wdt:${p}`).join('|');

  const query = `
SELECT ?item ?date WHERE {
  VALUES ?item { ${values} }
  ?item ${dateProps} ?date.
}`;

  const url = `${SPARQL_API}?format=json&query=${encodeURIComponent(query)}`;
  const data = await queueSparql(
    () => withRetry(() => fetchJson<SparqlResponse>(url, { signal, timeoutMs: 20_000 })),
    signal,
  );

  for (const b of data.results?.bindings ?? []) {
    const qid = qidFromUri(b.item?.value ?? '');
    const year = yearFromIso(b.date?.value);
    if (!qid || year === undefined) continue;
    const existing = out.get(qid);
    if (existing === undefined || year < existing) out.set(qid, year);
  }

  return out;
}
