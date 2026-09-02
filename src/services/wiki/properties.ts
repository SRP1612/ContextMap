/** Wikidata property whitelist. These replace the AI-generated edge labels:
 *  each entry is a real, verifiable relation with a human-readable label. */

export type RelationGroup = 'causal' | 'sequence' | 'composition' | 'actors' | 'place';

export interface RelationProperty {
  pid: string;
  /** Label used when the seed is the subject: seed --pid--> other */
  forward: string;
  /** Label used when the seed is the object: other --pid--> seed */
  reverse: string;
  group: RelationGroup;
  /** Place links are only meaningful forward; reversing "country" pulls in
   *  every unrelated entity that shares the country. */
  reversible: boolean;
}

/** Weight applied during ranking; causal/sequence links make the best story. */
export const GROUP_WEIGHT: Record<RelationGroup, number> = {
  causal: 3.0,
  sequence: 3.0,
  composition: 2.0,
  actors: 2.0,
  // Place links are weak context: they cluster a map around wherever it happened.
  place: 0.8,
};

export const RELATION_PROPERTIES: RelationProperty[] = [
  { pid: 'P828',  forward: 'has cause',          reverse: 'led to',              group: 'causal',      reversible: true },
  { pid: 'P1542', forward: 'has effect',         reverse: 'resulted from',       group: 'causal',      reversible: true },
  { pid: 'P1478', forward: 'immediate cause',    reverse: 'immediately caused',  group: 'causal',      reversible: true },
  { pid: 'P1536', forward: 'immediate cause of', reverse: 'immediately preceded',group: 'causal',      reversible: true },

  { pid: 'P155',  forward: 'follows',            reverse: 'followed by',         group: 'sequence',    reversible: true },
  { pid: 'P156',  forward: 'followed by',        reverse: 'follows',             group: 'sequence',    reversible: true },
  { pid: 'P1365', forward: 'replaces',           reverse: 'replaced by',         group: 'sequence',    reversible: true },
  { pid: 'P1366', forward: 'replaced by',        reverse: 'replaces',            group: 'sequence',    reversible: true },

  { pid: 'P361',  forward: 'part of',            reverse: 'has part',            group: 'composition', reversible: true },
  { pid: 'P527',  forward: 'has part',           reverse: 'part of',             group: 'composition', reversible: true },

  { pid: 'P710',  forward: 'participant',        reverse: 'participated in',     group: 'actors',      reversible: true },
  { pid: 'P1344', forward: 'participated in',    reverse: 'participant',         group: 'actors',      reversible: true },

  { pid: 'P276',  forward: 'location',           reverse: 'location of',         group: 'place',       reversible: false },
];

export const REVERSIBLE_PROPERTIES = RELATION_PROPERTIES.filter((r) => r.reversible);

export const RELATION_BY_PID = new Map(RELATION_PROPERTIES.map((r) => [r.pid, r]));

/** Date properties, in resolution priority order. */
export const DATE_PROPERTIES = ['P585', 'P571', 'P580', 'P582', 'P576'] as const;

/** Generic hub articles that dominate link graphs and flatten the map if allowed in. */
export const HUB_STOPLIST = new Set([
  'United States', 'United Kingdom', 'France', 'Germany', 'Russia', 'China', 'Japan',
  'Europe', 'Asia', 'Africa', 'North America', 'South America', 'Latin', 'English language',
  'World War I', 'World War II', 'Christianity', 'Catholic Church', 'Earth',
]);

const HUB_PATTERNS = [
  /^List of /i,
  /^Index of /i,
  /^Outline of /i,
  /^\d{1,4}(s)?$/,               // bare years: "1939", "1930s"
  /^\d{1,2}(st|nd|rd|th) century$/i,
  /\(disambiguation\)$/i,
  /^Category:/i,
  /^Template:/i,
  /^Portal:/i,
  /^Wikipedia:/i,
  /^Help:/i,
];

export function isHubArticle(title: string): boolean {
  return HUB_STOPLIST.has(title) || HUB_PATTERNS.some((re) => re.test(title));
}
