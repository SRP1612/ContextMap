import type { ContextGraph, ContextDepth } from '../types';

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

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API error ${res.status}: ${msg}`);
  }

  return res.json();
}
