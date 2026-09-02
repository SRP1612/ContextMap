import { fetchJson, wikiUrl, chunk, articleUrl } from './http';
import { isHubArticle } from './properties';

export interface ArticleMeta {
  title: string;
  pageId: number;
  extract: string;
  qid?: string;
  thumbnail?: string;
  url: string;
}

interface ApiPage {
  pageid: number;
  title: string;
  missing?: boolean;
  extract?: string;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
  thumbnail?: { source: string };
}

interface ApiResponse {
  query?: { pages?: ApiPage[] };
}

/** Fetch intro extract, Wikidata QID and thumbnail for up to 50 titles per request. */
export async function getArticleMeta(
  titles: string[],
  signal?: AbortSignal,
): Promise<Map<string, ArticleMeta>> {
  const out = new Map<string, ArticleMeta>();
  if (titles.length === 0) return out;

  const batches = chunk([...new Set(titles)], 50);
  const responses = await Promise.all(
    batches.map((batch) =>
      fetchJson<ApiResponse>(
        wikiUrl({
          action: 'query',
          titles: batch.join('|'),
          prop: 'extracts|pageprops|pageimages',
          exintro: '1',
          explaintext: '1',
          exsectionformat: 'plain',
          ppprop: 'wikibase_item|disambiguation',
          piprop: 'thumbnail',
          pithumbsize: '320',
          redirects: '1',
        }),
        { signal },
      ),
    ),
  );

  for (const data of responses) {
    for (const page of data.query?.pages ?? []) {
      if (page.missing || page.pageprops?.disambiguation !== undefined) continue;
      out.set(page.title, {
        title: page.title,
        pageId: page.pageid,
        extract: page.extract ?? '',
        qid: page.pageprops?.wikibase_item,
        thumbnail: page.thumbnail?.source,
        url: articleUrl(page.title),
      });
    }
  }

  return out;
}

/** MediaWiki's built-in "more like this" relevance search — deterministic, one request. */
export async function getRelatedArticles(
  title: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<string[]> {
  const data = await fetchJson<{ query?: { search?: { title: string }[] } }>(
    wikiUrl({
      action: 'query',
      list: 'search',
      srsearch: `morelike:${title}`,
      srlimit: String(limit),
      srprop: '',
// morelike is expensive server-side; this keeps it cacheable and fast.
      srqiprofile: 'classic',
    }),
    { signal },
  );

  return (data.query?.search ?? [])
    .map((r) => r.title)
    .filter((t) => t !== title && !isHubArticle(t));
}

/** Outbound article links, in the order they appear in the source article. */
export async function getOutboundLinks(
  title: string,
  limit = 300,
  signal?: AbortSignal,
): Promise<string[]> {
  const data = await fetchJson<{ query?: { pages?: { links?: { title: string }[] }[] } }>(
    wikiUrl({
      action: 'query',
      titles: title,
      prop: 'links',
      plnamespace: '0',
      pllimit: String(limit),
      redirects: '1',
    }),
    { signal },
  );

  const links = data.query?.pages?.[0]?.links ?? [];
  return links.map((l) => l.title).filter((t) => !isHubArticle(t));
}
