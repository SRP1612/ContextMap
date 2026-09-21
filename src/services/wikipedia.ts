import type { WikiSearchResult } from '../types';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

/**
 * Search Wikipedia for articles matching `query`.
 * Returns up to `limit` results (default 8).
 */
export async function searchWikipedia(
  query: string,
  limit = 8,
): Promise<WikiSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
    origin: '*', // CORS
  });

  const res = await fetch(`${WIKI_API}?${params}`);
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);

  const data = await res.json();
  const results: WikiSearchResult[] = (data.query?.search ?? []).map(
    (item: { title: string; snippet: string; pageid: number }) => ({
      title: item.title,
      description: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''), // strip HTML
      pageId: item.pageid,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    }),
  );

  return results;
}

/** Fetch the plain-text extract of a Wikipedia article by title. */
export async function getWikipediaExtract(title: string): Promise<string> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'extracts',
    exintro: '0',
    explaintext: '1',
    exsectionformat: 'plain',
    format: 'json',
    origin: '*',
  });

  const res = await fetch(`${WIKI_API}?${params}`);
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);

  const data = await res.json();
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0] as { extract?: string } | undefined;
  return page?.extract ?? '';
}
