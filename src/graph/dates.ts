/** Year resolution. Wikidata is authoritative; the article text is a last resort. */

// Only 4-digit years are trusted from prose: 3-digit matches pick up areas,
// populations and distances ("of 142 km²") far more often than real dates.
const CE_PATTERN = /\b(?:in|on|of|since|from|by)\s+(?:\w+\s+\d{1,2},?\s+)?(\d{4})\b/i;
const BCE_PATTERN = /\b(\d{1,4})\s*(?:BCE?|B\.C\.)\b/i;
const BARE_YEAR = /\b(1[0-9]{3}|20[0-2][0-9])\b/;

/**
 * Best-effort year from an article intro. Only used when Wikidata has no date;
 * deliberately conservative, since a wrong year misplaces the node on the timeline.
 */
export function yearFromText(text: string): number | undefined {
  if (!text) return undefined;
  const head = text.slice(0, 500);

  const bce = BCE_PATTERN.exec(head);
  if (bce) return -Number(bce[1]);

  const currentYear = new Date().getFullYear();

  const ce = CE_PATTERN.exec(head);
  if (ce) {
    const year = Number(ce[1]);
    if (year >= 1000 && year <= currentYear) return year;
  }

  const bare = BARE_YEAR.exec(head);
  if (bare) {
    const year = Number(bare[1]);
    if (year <= currentYear) return year;
  }

  return undefined;
}

/** Years embedded in titles like "1939 Chillán earthquake" or "Treaty of Paris (1783)". */
const TITLE_YEAR = /(?:^|\()(\d{3,4})(?:$|\)|\s)/;

export function yearFromTitle(title: string): number | undefined {
  const match = TITLE_YEAR.exec(title);
  if (!match) return undefined;
  const year = Number(match[1]);
  return year >= 100 && year <= new Date().getFullYear() + 1 ? year : undefined;
}

/**
 * Wikidata first, then the title, then the article text. The title beats the text
 * because intros routinely name other years ("surpassed by the 1960 quake").
 */
export function resolveYear(
  wikidataYear: number | undefined,
  title: string,
  extract: string,
): number | undefined {
  return wikidataYear ?? yearFromTitle(title) ?? yearFromText(extract);
}
