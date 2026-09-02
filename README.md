# ContextMap

An interactive knowledge graph that maps the context around any Wikipedia topic. Search for a topic and ContextMap builds a visual "yarn map" of related events, people, places and concepts — drawn entirely from Wikidata's structured relationships and Wikipedia's own relevance ranking.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![No AI](https://img.shields.io/badge/AI-none-brightgreen) ![License](https://img.shields.io/badge/License-GPLv3-blue)

**No AI. No API keys. No server. One HTML file.**

Because the graph is derived from structured data rather than a language model, the same topic at the same settings always produces the same map.

## Getting Started

Download `ContextMap.html` and double-click it. That's the whole process — it runs in any modern browser and needs an internet connection only to reach Wikipedia and Wikidata.

## How It Works

1. **Search** — Results come from Wikipedia's search API, so every entry is a real article.
2. **Set depth and width** — Two independent sliders:
   - **Depth (1–3)** — how many hops out from your topic to travel.
   - **Width (2–8)** — how many branches to keep per topic. Width shrinks with each hop so distant rings don't explode.
3. **Build** — For each article, ContextMap pulls typed relationships from Wikidata and related articles from Wikipedia's `morelike` search, ranks the candidates, and keeps the best.
4. **Explore** — Drag and zoom the map, click a node for its summary, or rebuild the map around any node.

### Where connections come from

Edges are labelled with the actual Wikidata property that links two items:

| Group | Properties |
|---|---|
| Causal | has cause, has effect, immediate cause |
| Sequence | follows, followed by, replaces, replaced by |
| Composition | part of, has part |
| Actors | participant, participated in |
| Place | location, country |

When Wikidata has no relationship, the edge falls back to a dashed **"closely related"** line derived from Wikipedia relevance. Solid labelled edges are verifiable; dashed ones are inferred.

Place properties are only followed forward. Reversing them would pull in every unrelated article that happens to share a country.

### Dates and layout

Node years resolve from Wikidata first, then the article title, then the article text. Nodes with no resolvable date render dimmed and dashed.

- **Chronological** — left to right by year.
- **Radial** — your topic at the centre, one ring per hop.

Switching layouts only repositions nodes; it never refetches.

## Reliability

The public Wikidata endpoint rate-limits bursts, so requests are serialized with spacing and retried with exponential backoff. If Wikidata is unreachable the map still builds from Wikipedia relevance alone and a banner explains that some links are unlabelled — a single failing source can never blank the map.

A typical depth 2 / width 5 build uses about 13 requests.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
```

### Building

```bash
npm run build:release
```

Produces `release/ContextMap.html` — a single self-contained file (~455 KB) with all JavaScript and CSS inlined. Nothing else is needed to run it.

### Project Structure

```
ContextMap/
├── src/
│   ├── components/
│   │   ├── ContextNodeComponent.tsx  # Custom styled graph node
│   │   ├── ControlBar.tsx            # Depth/width sliders + layout toggle
│   │   ├── DetailPanel.tsx           # Node details, Wikipedia + Wikidata links
│   │   ├── SearchPanel.tsx           # Wikipedia search with autocomplete
│   │   └── YarnMap.tsx               # React Flow visualization
│   ├── graph/
│   │   ├── builder.ts                # Breadth-first expansion
│   │   ├── dates.ts                  # Year resolution
│   │   ├── layout.ts                 # Chronological + radial layouts
│   │   └── ranking.ts                # Deterministic candidate scoring
│   ├── services/wiki/
│   │   ├── articles.ts               # Batched extracts, morelike, links
│   │   ├── http.ts                   # Fetch, timeout, retry, SPARQL queue
│   │   ├── properties.ts             # Wikidata property whitelist
│   │   ├── search.ts                 # Article search
│   │   └── wikidata.ts               # SPARQL frontier expansion
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── legacy/                   # Previous AI-based implementation, kept for reference
└── package.json
```

## Tech Stack

- **Frontend:** React 19, TypeScript, [React Flow](https://reactflow.dev/), [Dagre](https://github.com/dagrejs/dagre), Tailwind CSS
- **Data:** [Wikidata Query Service](https://query.wikidata.org/) (SPARQL) and the [Wikipedia Action API](https://www.mediawiki.org/wiki/API:Main_page)
- **Build:** Vite with [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)

Both data sources are public, anonymous, CORS-enabled and require no key. No custom request headers are sent anywhere, since a custom header would trigger a CORS preflight and break the `file://` use case.

## Known Limitations

- **Geographic drift** — maps seeded on a place-heavy topic can pull in loosely related local articles.
- **Sparse Wikidata** — topics with few structured relationships produce mostly dashed "closely related" edges.
- **English Wikipedia only.**

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

In short: you are free to use, modify, and distribute this project, but any derivative works must also be released under GPL v3 with source code available.
