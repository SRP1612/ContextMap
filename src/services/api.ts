import type { ContextGraph } from '../types';

/**
 * Calls our local API server which in turn calls Anthropic's Claude
 * to generate a causal context graph for the given Wikipedia article.
 */
export async function generateGraph(
  articleTitle: string,
  articleText: string,
): Promise<ContextGraph> {
  const res = await fetch('/api/generate-graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: articleTitle, text: articleText }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API error ${res.status}: ${msg}`);
  }

  return res.json();
}
