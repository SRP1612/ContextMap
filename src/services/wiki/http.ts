/** Shared fetch helpers. No custom headers anywhere — they would trigger a CORS
 *  preflight that breaks the file:// deployment target. */

export const WIKI_API = 'https://en.wikipedia.org/w/api.php';
export const SPARQL_API = 'https://query.wikidata.org/sparql';

export class WikiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WikiRequestError';
    this.status = status;
  }
}

interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Fetch JSON with a hard timeout, honouring an external abort signal. */
export async function fetchJson<T>(
  url: string,
  { signal, timeoutMs = 15_000 }: FetchOptions = {},
): Promise<T> {
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), timeoutMs);

  const onExternalAbort = () => timer.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const res = await fetch(url, { signal: timer.signal });
    if (!res.ok) {
      throw new WikiRequestError(`Request failed: ${res.status} ${res.statusText}`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    // Distinguish a caller-initiated cancel from our own timeout.
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (signal?.aborted) throw err;
      throw new WikiRequestError(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Build a MediaWiki Action API URL. `origin=*` enables anonymous CORS. */
export function wikiUrl(params: Record<string, string>): string {
  return `${WIKI_API}?${new URLSearchParams({
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  })}`;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry transient failures (rate limits, upstream hiccups, timeouts). */
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      const status = err instanceof WikiRequestError ? err.status : null;
      const transient = status === 429 || status === 503 || status === 502 || status === undefined;
      if (!transient || attempt >= retries) throw err;
      await delay(800 * 2 ** attempt);
    }
  }
}

const SPARQL_MIN_GAP_MS = 700;
let sparqlChain: Promise<unknown> = Promise.resolve();
let lastSparqlAt = 0;

// Identical queries recur constantly while dragging a slider or revisiting a topic.
// Wikidata's public endpoint throttles hard, so never ask it the same thing twice.
const sparqlCache = new Map<string, unknown>();

export function getCachedSparql<T>(key: string): T | undefined {
  return sparqlCache.get(key) as T | undefined;
}

export function setCachedSparql(key: string, value: unknown): void {
  sparqlCache.set(key, value);
}

/**
 * Serialise SPARQL calls and space them out. The public endpoint returns 429
 * when queries arrive back-to-back, which is the main stability risk.
 */
export function queueSparql<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const result = sparqlChain.then(async () => {
    // A superseded build must not hold the queue while its spacing and retry
    // delays elapse; that stalls the build the user is actually waiting on.
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const gap = Date.now() - lastSparqlAt;
    if (gap < SPARQL_MIN_GAP_MS) await delay(SPARQL_MIN_GAP_MS - gap);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      return await fn();
    } finally {
      lastSparqlAt = Date.now();
    }
  });
  sparqlChain = result.catch(() => undefined);
  return result;
}

/** Split a list into fixed-size chunks (Action API caps titles at 50 per request). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
