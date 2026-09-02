import type { WikiSearchResult } from '../../types';
import { fetchJson, wikiUrl, articleUrl } from './http';

interface SearchResponse {
  query?: { search?: { title: string; snippet: string; pageid: number }[] };
}

/** Autocomplete search used by the search panel. */
export async function searchWikipedia(
  query: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<WikiSearchResult[]> {
  const data = await fetchJson<SearchResponse>(
    wikiUrl({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(limit),
    }),
    { signal },
  );

  return (data.query?.search ?? []).map((item) => ({
    title: item.title,
    description: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
    pageId: item.pageid,
    url: articleUrl(item.title),
  }));
}
