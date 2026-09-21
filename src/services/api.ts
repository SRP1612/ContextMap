import type { ContextGraph, ContextDepth } from '../types';

export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super('Rate limit reached');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export async function generateGraph(
  articleTitle: string,
  articleText: string,
  depth: ContextDepth = 'standard',
): Promise<ContextGraph> {
  const res = await fetch('/api/generate-graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: articleTitle, text: articleText, depth }),
  });

  if (res.status === 429 || res.status === 503) {
    const body = await res.json();
    throw new RateLimitError(body.retryAfter ?? 60);
  }

  if (!res.ok) {
    // Server errors are JSON ({ error }); fall back to raw text for anything else (e.g. a proxy error page)
    const raw = await res.text();
    let msg = raw;
    try {
      msg = JSON.parse(raw).error ?? raw;
    } catch { /* not JSON */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }

  return res.json();
}
