import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

type Depth = 'narrow' | 'standard' | 'extended' | 'deep';

const DEPTH_CONFIG: Record<Depth, { years: number; nodeRange: string; extra: string }> = {
  narrow: {
    years: 50,
    nodeRange: '4-6',
    extra: 'Focus on direct, proximate causes and immediate consequences. Stick to concrete, well-documented events.',
  },
  standard: {
    years: 100,
    nodeRange: '4-8',
    extra: 'Include key historical context — political, economic, and social factors that set the stage for the event.',
  },
  extended: {
    years: 200,
    nodeRange: '6-10',
    extra: `Go beyond proximate causes. Include socioeconomic transformations, cultural movements, demographic shifts,
and institutional changes that created the conditions for this event over centuries. Consider how trade patterns,
class structures, technological revolutions, and colonial histories thread into the causal chain.`,
  },
  deep: {
    years: 500,
    nodeRange: '8-14',
    extra: `Trace the deepest roots — up to 500 years of causal history. Include:
- Philosophical and intellectual movements (Enlightenment, Scholasticism, Humanism, etc.)
- Cultural and psychological shifts in collective consciousness — changes in how societies understood risk, progress, fate, nature, or the self
- Religious and ideological transformations that reshaped values and institutions
- Long-wave economic cycles: feudalism → mercantilism → capitalism, wealth concentration, class creation
- Demographic upheavals (plagues, migrations, urbanization) and their multi-generational ripple effects
- Traditions, habits, and social norms inherited across generations that persisted into the event's era
- How earlier catastrophes or triumphs rewired societal DNA — e.g., the Black Death creating a labor-scarce economy that empowered the middle class centuries later
Think like a longue durée historian (Braudel, Annales School). Connect deep structures to the surface event.`,
  },
};

function buildSystemPrompt(depth: Depth): string {
  const cfg = DEPTH_CONFIG[depth];
  return `You are a historian, philosopher, and causal analyst. Given the title and text of a Wikipedia article about a historical or topical event, produce a structured causal context map.

Identify ${cfg.nodeRange} key events, concepts, movements, or shifts that form a causal chain leading to (and possibly resulting from) the main event. Look back up to ${cfg.years} years before the event for relevant context.

${cfg.extra}

Return ONLY valid JSON matching this exact schema — no markdown fences, no commentary:

{
  "title": "Short title of the main event",
  "summary": "3-5 sentence narrative explaining how these events interconnect causally across time, highlighting the deepest threads",
  "nodes": [
    {
      "id": "unique_snake_case_id",
      "label": "Short Human-Readable Label",
      "year": "Year or date range (e.g. '1540s' or '1939')",
      "summary": "2-4 sentence explanation of this event/concept and its role in the causal chain. Be specific about HOW it connects to other nodes.",
      "wikipediaUrl": "https://en.wikipedia.org/wiki/Relevant_Article"
    }
  ],
  "edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "Short description of the causal link"
    }
  ]
}

Rules:
- Every node id referenced in edges must exist in nodes.
- Order nodes roughly chronologically.
- Wikipedia URLs must point to real, existing articles. Use the standard format: https://en.wikipedia.org/wiki/Article_Name
- Focus on causation, not just correlation. Each edge should explain WHY one event led to another.
- Include the main event itself as one of the nodes.
- Be historically accurate. Do not invent events.
- Edges can skip intermediate nodes to show long-range causal links.
- The graph should tell a compelling story of how deep history shaped this moment.`;
}

function isTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return message.includes('503') || message.includes('429')
    || message.toLowerCase().includes('service unavailable')
    || message.toLowerCase().includes('resource has been exhausted')
    || message.toLowerCase().includes('high demand');
}

app.post('/api/generate-graph', async (req, res) => {
  const { title, text, depth: rawDepth } = req.body;
  const depth: Depth = ['narrow', 'standard', 'extended', 'deep'].includes(rawDepth) ? rawDepth : 'standard';

  if (!title || !text) {
    res.status(400).json({ error: 'title and text are required' });
    return;
  }

  // Truncate to ~12k chars to stay within reasonable token limits
  const truncatedText = text.slice(0, 12000);

  try {
    const tokenLimit = depth === 'deep' ? 16384 : depth === 'extended' ? 12288 : 8192;
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemPrompt(depth),
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: tokenLimit,
      },
    });

    const prompt = `Analyze this Wikipedia article and produce a causal context map.\n\nTitle: ${title}\n\nArticle text:\n${truncatedText}`;

    // Retry with exponential backoff for transient errors (503, 429)
    const MAX_RETRIES = 3;
    let lastError: unknown;
    let result;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (retryErr) {
        lastError = retryErr;
        if (attempt < MAX_RETRIES && isTransientError(retryErr)) {
          const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          console.warn(`Gemini transient error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay / 1000}s...`, retryErr instanceof Error ? retryErr.message : retryErr);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          throw retryErr;
        }
      }
    }
    if (!result) throw lastError;

    const responseText = result.response.text();
    if (!responseText) {
      res.status(500).json({ error: 'Empty response from Gemini' });
      return;
    }

    // Strip markdown fences if present, then parse JSON
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const graph = JSON.parse(cleaned);

    // Basic validation
    if (!graph.title || !graph.nodes || !graph.edges) {
      res.status(500).json({ error: 'Invalid graph structure from Gemini' });
      return;
    }

    res.json(graph);
  } catch (err) {
    console.error('Error generating graph:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ContextMap running at http://localhost:${PORT}`);
});
