import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(express.json({ limit: '1mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
// Models to try, in order (comma-separated in .env as GEMINI_MODEL). Free-tier quotas are per model and newer
// models see demand spikes, so a chain of fallbacks keeps the app usable. Models get retired: see
// https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/gemini-api/docs/deprecations
const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3-flash-preview,gemini-3.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
// Classifying the subject is trivial, so it tries cheap "lite" models first and saves the premium models'
// small free daily quota for the real generation. It falls back to the main chain if the lite models fail.
const CLASSIFY_MODELS = [
  ...(process.env.GEMINI_CLASSIFY_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  ...GEMINI_MODELS,
];

const CURRENT_YEAR = new Date().getFullYear();
// Characters of article text sent to the model (~10k tokens)
const MAX_ARTICLE_CHARS = 40000;

/* ── Scales ─────────────────────────────────────────────────────────────
 * A scale is a time window measured from an "anchor" year: the subject's own
 * date for events, people, organizations and works, or today for timeless
 * subjects (concepts, technologies, places). `back`/`forward` are years either
 * side of the anchor; null means unbounded. The window is enforced in code
 * after generation, not just requested in the prompt.
 */

type Scale = 'immediate' | 'generational' | 'historical' | 'deep';

interface ScaleConfig {
  back: number | null;
  forward: number | null;
  minNodes: number;
  maxNodes: number;
  focus: string;
}

const SCALES: Record<Scale, ScaleConfig> = {
  immediate: {
    back: 15,
    forward: 10,
    minNodes: 12,
    maxNodes: 18,
    focus:
      'Go fine-grained: the specific people, decisions, incidents, meetings, documents and turning points of the run-up and aftermath, dated to the year. Concrete and granular beats sweeping.',
  },
  generational: {
    back: 75,
    forward: 50,
    minNodes: 10,
    maxNodes: 16,
    focus:
      'Cover what happened within living memory: movements, policies, technologies, rivalries and social shifts that set the stage, plus how the subject changed things afterwards.',
  },
  historical: {
    back: 300,
    forward: 200,
    minNodes: 12,
    maxNodes: 20,
    focus:
      'Cover the institutions, ideologies, economic systems, cultural currents and demographic shifts that took shape over centuries and made the subject possible or likely.',
  },
  deep: {
    back: null,
    forward: null,
    minNodes: 16,
    maxNodes: 28,
    focus: `Trace the deepest roots as far back as they honestly go. Include philosophical and intellectual movements, religious and ideological transformations, long-wave economic and technological change, demographic upheavals and the habits and traditions inherited across generations.
Think like a longue durée historian (Braudel, Annales School): connect deep structures to the surface subject, and show how earlier catastrophes or triumphs rewired later societies.`,
  },
};

const isScale = (v: unknown): v is Scale => typeof v === 'string' && v in SCALES;

const NODE_KINDS = ['subject', 'cause', 'consequence', 'person', 'place', 'idea', 'parallel'];
const SUBJECT_KINDS = ['event', 'person', 'organization', 'work', 'concept', 'place'];
// Subjects with no single date: their context is measured backward from today
const TIMELESS_SUBJECTS = new Set(['concept', 'place']);

interface TimeWindow {
  start: number | null;
  end: number | null;
  anchor: number;
  label: string;
}

function formatYear(y: number): string {
  return y < 0 ? `${-y} BCE` : String(y);
}

function computeWindow(scale: Scale, subjectKind: string, anchorYear: unknown): TimeWindow {
  const cfg = SCALES[scale];
  const anchor =
    TIMELESS_SUBJECTS.has(subjectKind) || typeof anchorYear !== 'number' || !Number.isFinite(anchorYear)
      ? CURRENT_YEAR
      : Math.min(Math.round(anchorYear), CURRENT_YEAR);
  if (cfg.back === null || cfg.forward === null) {
    return { start: null, end: null, anchor, label: 'All of history' };
  }
  const start = anchor - cfg.back;
  const end = Math.min(anchor + cfg.forward, CURRENT_YEAR);
  return { start, end, anchor, label: `${formatYear(start)} – ${formatYear(end)}` };
}

/* ── Model output ───────────────────────────────────────────────────────── */

interface RawNode {
  id: string;
  label: string;
  kind?: string;
  year?: string;
  startYear?: number;
  endYear?: number;
  hook?: string;
  summary: string;
  wikipediaUrl?: string;
}

interface RawEdge {
  source: string;
  target: string;
  label: string;
}

interface RawGraph {
  title: string;
  summary?: string;
  nodes: RawNode[];
  edges: RawEdge[];
}

const str = (description: string) => ({ type: SchemaType.STRING, description }) as const;
const int = (description: string) => ({ type: SchemaType.INTEGER, description }) as const;

const CLASSIFY_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    subjectKind: { type: SchemaType.STRING, format: 'enum', enum: SUBJECT_KINDS },
    anchorYear: int('Year the time window is measured from. BCE years are negative (1 BCE = -1).'),
  },
  required: ['subjectKind', 'anchorYear'],
};

const GRAPH_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: str('Short title for the map'),
    summary: str('4-6 sentence narrative of how the threads fit together'),
    nodes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: str('unique_snake_case_id'),
          label: str('Short, specific, searchable name'),
          kind: { type: SchemaType.STRING, format: 'enum', enum: NODE_KINDS },
          year: str('Short human-readable date label, e.g. "1789", "c. 1540s", "1914–1918", "c. 10,000 BCE"'),
          startYear: int('Year it began (BCE negative)'),
          endYear: int('Year it ended; omit for a point in time'),
          hook: str('One sentence (max 25 words): why this matters or what is surprising about it'),
          summary: str('3-5 sentences: what it is and precisely how it connects to neighbouring nodes'),
          wikipediaUrl: str('https://en.wikipedia.org/wiki/Article_Name of a real article'),
        },
        required: ['id', 'label', 'kind', 'year', 'startYear', 'hook', 'summary', 'wikipediaUrl'],
      },
    },
    edges: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          source: str('id of the node that led to / influenced the target'),
          target: str('id of the node that was led to / influenced'),
          label: str('At most 6 words describing the link'),
        },
        required: ['source', 'target', 'label'],
      },
    },
  },
  required: ['title', 'summary', 'nodes', 'edges'],
};

const CLASSIFY_PROMPT = `Classify the subject of a Wikipedia article and choose the anchor year for a timeline of its context.
Set subjectKind to one of: event, person, organization, work, concept, place.
Set anchorYear (an integer; BCE years are negative, 1 BCE = -1):
- event: the year it began or peaked
- person: the year of their most significant achievement or reign
- organization or work: the year it was founded or published
- concept (this includes objects, technologies, fields and phenomena) or place: ${CURRENT_YEAR}, the current year. These have no single date, so their context is measured backward from today.`;

function buildSystemPrompt(scale: Scale, subjectKind: string, window: TimeWindow): string {
  const cfg = SCALES[scale];
  let windowRule: string;
  if (window.start === null || window.end === null) {
    windowRule = "There is no time limit: reach as far back as the subject's real roots go, and forward to the present day.";
  } else {
    const basis = TIMELESS_SUBJECTS.has(subjectKind)
      ? `This ${subjectKind} has no single date, so the map covers the recent past up to today.`
      : `The map is anchored on ${formatYear(window.anchor)}, covering the run-up and the aftermath.`;
    windowRule = `${basis} The time window is ${formatYear(window.start)} to ${formatYear(window.end)}. Every node's startYear must fall inside it (a span may begin earlier if it overlaps the window). Nodes outside the window are discarded, so leave them out however interesting they are. Only the "subject" node is exempt from the window; its dates can be whatever is true.`;
  }

  return `You are a historian and research guide. Given the title and text of a Wikipedia article, build a map of the most interesting, specific context around the subject: what shaped it, what it shaped, and the side doors a curious reader could walk through into further research.

The subject is a ${subjectKind}.

TIME WINDOW
${windowRule}

SCOPE AND EMPHASIS FOR THIS SCALE
${cfg.focus}

NODES
Return ${cfg.minNodes}-${cfg.maxNodes} nodes if the window supports that many real, well-documented items. Return fewer rather than padding or inventing.
- Exactly one node has kind "subject": the searched subject itself.
- Other kinds: "cause" (helped bring the subject about), "consequence" (flowed from the subject), "person", "place", "idea" (a movement, doctrine, technology or practice), "parallel" (a comparable case elsewhere or at another time that illuminates the subject).
- Prefer specific, named, searchable things (a person, treaty, invention, book, battle, doctrine, place) over vague themes like "Economic changes". Each node should be a good starting point for someone to research on its own.
- Include several non-obvious nodes: connections a casual reader would not expect but that are real and well documented.
- "hook" is one punchy sentence. "summary" is 3-5 sentences that explain HOW the node connects to the nodes around it.
- wikipediaUrl must point to a real, existing English Wikipedia article.

EDGES
An edge means the source led to or influenced the target, so the source is generally earlier. Every node needs at least one edge. Use roughly 1.3-1.6 edges per node, and allow long-range links that skip intermediate nodes. Keep labels to 6 words or fewer and make them explain WHY, not just "led to".

Also give the map a short "title" and a 4-6 sentence "summary" narrating how the threads fit together.
Be historically accurate. Do not invent events, people, places or dates; if unsure of a date, use the best-supported year.`;
}

/* ── Post-processing ────────────────────────────────────────────────────── */

/**
 * Models occasionally emit duplicate node ids or edges that point at unknown nodes,
 * which the map can't render. Drop those rather than fail the whole request.
 */
function sanitizeGraph(raw: RawGraph): RawGraph {
  const ids = new Set<string>();
  const nodes: RawNode[] = [];
  for (const n of raw.nodes) {
    if (n && typeof n.id === 'string' && n.id && !ids.has(n.id)) {
      ids.add(n.id);
      nodes.push(n);
    }
  }
  const edges = raw.edges.filter((e) => e && ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  const dropped = raw.nodes.length - nodes.length + (raw.edges.length - edges.length);
  if (dropped > 0) console.warn(`Dropped ${dropped} invalid node/edge entries from model output`);
  return { ...raw, nodes, edges };
}

/** Enforce the scale's time window: drop nodes that fall outside it, then clean up dangling edges. */
function scopeGraph(raw: RawGraph, window: TimeWindow) {
  const { start, end } = window;
  // Models are loose with boundary years (a "1950s" node stamped 1950 against a 1951 window), so allow a little slack
  const slack = start === null || end === null ? 0 : Math.max(3, Math.round((end - start) * 0.06));
  const isInside = (n: RawNode) => {
    if (start === null || end === null || n.kind === 'subject' || typeof n.startYear !== 'number') return true;
    const last = typeof n.endYear === 'number' ? n.endYear : n.startYear;
    return last >= start - slack && n.startYear <= end + slack;
  };
  const outside = raw.nodes.filter((n) => !isInside(n));
  const graph = sanitizeGraph({ ...raw, nodes: raw.nodes.filter(isInside) });
  return { graph, outside };
}

/**
 * Models invent plausible-looking Wikipedia URLs. Check them against Wikipedia in one batched request:
 * follow redirects to the canonical article, and drop links to pages that don't exist (the node stays).
 * If Wikipedia can't be reached the graph is returned unchecked.
 */
async function validateWikipediaLinks(nodes: RawNode[]): Promise<void> {
  const titleOf = (url?: string): string | null => {
    try {
      const u = new URL(url ?? '');
      if (!/(^|.)en.wikipedia.org$/.test(u.hostname) || !u.pathname.startsWith('/wiki/')) return null;
      return decodeURIComponent(u.pathname.slice('/wiki/'.length)).replace(/_/g, ' ');
    } catch {
      return null;
    }
  };

  const titles = [...new Set(nodes.map((n) => titleOf(n.wikipediaUrl)).filter((t): t is string => t !== null))];
  const exists = new Map<string, string | null>(); // requested title -> canonical title (null = missing)
  try {
    for (let i = 0; i < titles.length; i += 50) {
      const batch = titles.slice(i, i + 50);
      const params = new URLSearchParams({ action: 'query', format: 'json', redirects: '1', titles: batch.join('|') });
      const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { 'User-Agent': 'ContextMap (local research tool)' } });
      if (!res.ok) return;
      const q = (await res.json()).query as {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages: Record<string, { title: string; missing?: string }>;
      };
      const hop = new Map<string, string>();
      for (const m of [...(q.normalized ?? []), ...(q.redirects ?? [])]) hop.set(m.from, m.to);
      const pages = new Map(Object.values(q.pages).map((p) => [p.title, p]));
      for (const t of batch) {
        let cur = t;
        for (let d = 0; d < 5 && hop.has(cur); d++) cur = hop.get(cur)!;
        const page = pages.get(cur);
        exists.set(t, page && page.missing === undefined ? page.title : null);
      }
    }
  } catch {
    return;
  }

  let dropped = 0;
  for (const n of nodes) {
    const t = titleOf(n.wikipediaUrl);
    if (t === null) {
      if (n.wikipediaUrl) { delete n.wikipediaUrl; dropped++; }
      continue;
    }
    const canonical = exists.get(t);
    if (canonical) n.wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical.replace(/ /g, '_'))}`;
    else { delete n.wikipediaUrl; dropped++; }
  }
  if (dropped > 0) console.warn(`Dropped ${dropped} Wikipedia link(s) that don't exist`);
}

/* ── Gemini call ────────────────────────────────────────────────────────── */

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : '');

/** The free tier's requests-per-day quota: waiting a minute will not help. */
function isDailyQuotaError(err: unknown): boolean {
  return /PerDay/i.test(errorMessage(err));
}

/** Short-lived overload or rate limit: worth a brief backoff on the same model. */
function isTransientError(err: unknown): boolean {
  const message = errorMessage(err);
  return !isDailyQuotaError(err) && (message.includes('503') || message.includes('429')
    || message.toLowerCase().includes('service unavailable')
    || message.toLowerCase().includes('resource has been exhausted')
    || message.toLowerCase().includes('high demand'));
}

/** Errors that mean "this model can't serve you right now": move on to the next model in the chain. */
function shouldTryNextModel(err: unknown): boolean {
  const message = errorMessage(err);
  return isDailyQuotaError(err) || isTransientError(err) || message.includes('404') || /no longer available|not found/i.test(message);
}

// Models found to be out of daily quota are skipped for a while, so we don't burn requests rediscovering it
const quotaExhaustedUntil = new Map<string, number>();
const QUOTA_SKIP_MS = 60 * 60 * 1000;

/** One structured-output call against one model. No retries here: see callGemini. */
async function callModel(modelName: string, systemInstruction: string, schema: ResponseSchema, prompt: string): Promise<unknown> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      // Thinking tokens count toward this limit on some models, so leave plenty of headroom
      maxOutputTokens: 32768,
    },
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  if (!responseText) throw new Error('Empty response from Gemini');

  // Strip markdown fences if present, then parse JSON
  const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const reason = result.response.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned malformed JSON${reason === 'MAX_TOKENS' ? ' (response was cut off)' : ''}. Please try again.`);
  }
}

/**
 * Structured-output Gemini call that walks the model chain. Overload (503) hits individual requests at
 * random, so on a transient error we move straight on to the next model instead of waiting; if a whole
 * pass fails transiently we pause briefly and go around once more.
 */
async function callGemini(models: string[], systemInstruction: string, schema: ResponseSchema, prompt: string): Promise<unknown> {
  const PASSES = 2;
  let lastError: unknown;
  for (let pass = 0; pass < PASSES; pass++) {
    let sawTransient = false;
    for (const modelName of models) {
      if ((quotaExhaustedUntil.get(modelName) ?? 0) > Date.now()) continue;
      try {
        return await callModel(modelName, systemInstruction, schema, prompt);
      } catch (err) {
        lastError = err;
        if (isDailyQuotaError(err)) {
          quotaExhaustedUntil.set(modelName, Date.now() + QUOTA_SKIP_MS);
          console.warn(`${modelName}: daily quota exhausted, skipping it for a while`);
          continue;
        }
        if (!shouldTryNextModel(err)) throw err;
        if (isTransientError(err)) sawTransient = true;
        console.warn(`${modelName} unavailable (${errorMessage(err).slice(-90).replace(/\s+/g, ' ')}); trying next model`);
      }
    }
    if (!sawTransient) break;
    if (pass < PASSES - 1) await new Promise((r) => setTimeout(r, 4000));
  }
  throw lastError ?? new Error('Daily quota (PerDay) exhausted for every configured model');
}

/** The user message restates the window before AND after the article: models obey the constraint far better that way. */
function buildUserPrompt(title: string, text: string, window: TimeWindow): string {
  const constraint =
    window.start === null || window.end === null
      ? ''
      : `HARD CONSTRAINT: every node except the subject must have a startYear between ${window.start} and ${window.end}. The article below covers much older history; do NOT include older items, even though the article discusses them.\n\n`;
  return `Current year: ${CURRENT_YEAR}\n${constraint}Subject (Wikipedia article title): ${title}\n\nArticle text (may be truncated):\n${text.slice(0, MAX_ARTICLE_CHARS)}\n\n---\n${constraint}Now produce the map.`;
}

async function classifySubject(title: string, text: string): Promise<{ subjectKind: string; anchorYear: number }> {
  const out = (await callGemini(CLASSIFY_MODELS, CLASSIFY_PROMPT, CLASSIFY_SCHEMA, `Title: ${title}\n\nArticle opening:\n${text.slice(0, 6000)}`)) as {
    subjectKind?: string;
    anchorYear?: number;
  };
  return {
    subjectKind: out.subjectKind && SUBJECT_KINDS.includes(out.subjectKind) ? out.subjectKind : 'event',
    anchorYear: typeof out.anchorYear === 'number' ? out.anchorYear : CURRENT_YEAR,
  };
}

async function generateRawGraph(scale: Scale, subjectKind: string, window: TimeWindow, prompt: string): Promise<RawGraph> {
  const graph = (await callGemini(GEMINI_MODELS, buildSystemPrompt(scale, subjectKind, window), GRAPH_SCHEMA, prompt)) as RawGraph;
  if (!graph.title || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Invalid graph structure from Gemini');
  }
  return graph;
}

app.post('/api/generate-graph', async (req, res) => {
  const { title, text, scale: rawScale } = req.body;
  const scale: Scale = isScale(rawScale) ? rawScale : 'generational';

  if (!title || !text) {
    res.status(400).json({ error: 'title and text are required' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({
      error: 'GEMINI_API_KEY is not set. Copy .env.example to .env, add your key (https://aistudio.google.com/apikey) and restart the server.',
    });
    return;
  }

  const articleText = String(text);

  try {
    // Cheap first call: what kind of subject is this, and where is the time window anchored?
    const { subjectKind, anchorYear } = await classifySubject(title, articleText);
    const window = computeWindow(scale, subjectKind, anchorYear);
    const prompt = buildUserPrompt(title, articleText, window);

    let scoped = scopeGraph(await generateRawGraph(scale, subjectKind, window, prompt), window);

    // If the model largely ignored the window, ask once more, telling it what went wrong
    const total = scoped.graph.nodes.length + scoped.outside.length;
    if (scoped.outside.length > total / 3) {
      const examples = scoped.outside.slice(0, 5).map((n) => `"${n.label}" (${n.year ?? n.startYear})`).join(', ');
      console.warn(`[generate] "${title}" ${scale}: ${scoped.outside.length}/${total} nodes outside ${window.label}, retrying. e.g. ${examples}`);
      const retryPrompt = `${prompt}\n\nIMPORTANT: a previous attempt at this subject included items outside the allowed window (${window.label}), for example ${examples}. Those are discarded. Regenerate, keeping every node's startYear inside ${window.label} (only the subject node is exempt).`;
      const second = scopeGraph(await generateRawGraph(scale, subjectKind, window, retryPrompt), window);
      if (second.graph.nodes.length >= scoped.graph.nodes.length) scoped = second;
    }

    const { graph, outside } = scoped;
    if (graph.nodes.length === 0) throw new Error('Gemini returned a graph with no usable nodes');
    await validateWikipediaLinks(graph.nodes);

    console.log(`[generate] "${title}" scale=${scale} kind=${subjectKind} anchor=${window.anchor} window=${window.label} nodes=${graph.nodes.length} (dropped ${outside.length} outside window) edges=${graph.edges.length}`);

    res.json({
      title: graph.title,
      summary: graph.summary ?? '',
      subjectKind,
      window: { label: window.label, startYear: window.start, endYear: window.end, anchorYear: window.anchor },
      nodes: graph.nodes,
      edges: graph.edges,
    });
  } catch (err) {
    console.error('Error generating graph:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';

    // Daily free-tier quota: waiting won't help, so tell the client not to auto-retry
    if (isDailyQuotaError(err)) {
      res.status(429).json({
        error: 'The free-tier daily request quota is used up for every configured model. It resets at midnight Pacific time. To keep going now, set GEMINI_MODEL in .env to a model with quota left, or use another API key.',
        daily: true,
      });
      return;
    }

    // Detect Gemini rate-limit (429) and forward retry-after info
    if (message.includes('429') || message.toLowerCase().includes('resource has been exhausted')) {
      const retryAfter = 60; // Gemini free tier: wait ~60s
      res.status(429).json({ error: 'Rate limit reached. Please wait before trying again.', retryAfter });
      return;
    }

    // Detect service unavailable (503) — transient overload after retries exhausted
    if (message.includes('503') || message.toLowerCase().includes('service unavailable') || message.toLowerCase().includes('high demand')) {
      const retryAfter = 30;
      res.status(503).json({ error: 'Gemini is temporarily unavailable due to high demand. Please try again shortly.', retryAfter });
      return;
    }

    res.status(500).json({ error: message });
  }
});

// Serve the built frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;
// Loopback only: the server holds your API key, so it shouldn't be reachable from the network
app.listen(PORT, '127.0.0.1', () => {
  console.log(`ContextMap running at http://localhost:${PORT}`);
  if (process.env.OPEN_BROWSER !== '0') {
    const url = `http://localhost:${PORT}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` :
                process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd);
  }
});
