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

const SYSTEM_PROMPT = `You are a historian and causal analyst. Given the title and text of a Wikipedia article about a historical or topical event, your job is to produce a structured causal context map.

Identify 4-8 key events or concepts that form a causal chain leading to (and possibly resulting from) the main event. Each node should be a real, verifiable historical event or concept.

Return ONLY valid JSON matching this exact schema — no markdown fences, no commentary:

{
  "title": "Short title of the main event",
  "summary": "2-4 sentence narrative explaining how these events interconnect causally",
  "nodes": [
    {
      "id": "unique_snake_case_id",
      "label": "Short Human-Readable Label",
      "year": "Year or date range (e.g. '1540s' or '1939')",
      "summary": "2-3 sentence explanation of this event and its role in the causal chain",
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
- Be historically accurate. Do not invent events.`;

app.post('/api/generate-graph', async (req, res) => {
  const { title, text } = req.body;

  if (!title || !text) {
    res.status(400).json({ error: 'title and text are required' });
    return;
  }

  // Truncate to ~12k chars to stay within reasonable token limits
  const truncatedText = text.slice(0, 12000);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(
      `Analyze this Wikipedia article and produce a causal context map.\n\nTitle: ${title}\n\nArticle text:\n${truncatedText}`,
    );

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
