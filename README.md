# ContextMap

An interactive causal knowledge graph that maps the historical and topical context behind any event. Search for a Wikipedia-verified event (historical or current), and an AI generates a visual "yarn map" showing the chain of causes, consequences, and connections — with links to learn more about each one.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-orange)

## How It Works

1. **Search** — Type an event in the search bar. Results come from Wikipedia's API, ensuring every entry is a real, verifiable topic.
2. **Generate** — Select a result. The app fetches the Wikipedia article text and sends it to Google Gemini, which identifies 4-8 causal events forming a chain leading to (and resulting from) the main event.
3. **Explore** — The causal graph renders as an interactive node map. Drag nodes, zoom in/out, and click any node to read its summary and follow Wikipedia links.

### Example: 1939 Chillán Earthquake

The app ships with a hardcoded example demonstrating how the Spanish conquest of Chile in the 1540s set off a multi-century chain of events — replacing indigenous building practices with heavy European adobe construction — that directly amplified the death toll of the 1939 earthquake nearly 400 years later.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A free [Google Gemini API key](https://aistudio.google.com/apikey) (no credit card required)

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/ContextMap.git
cd ContextMap

# Install dependencies
npm install

# Set up your API key
cp .env.example .env
# Edit .env and paste your Gemini API key
```

### Running

**Option A — Desktop (one command):**

Double-click `ContextMap.bat` or run:

```bash
npm start
```

Then open http://localhost:3001 in your browser.

**Option B — Development mode (hot reload):**

```bash
# Terminal 1: API server
npm run dev:server

# Terminal 2: Vite dev server with hot reload
npm run dev
```

Then open http://localhost:5173.

## Project Structure

```
ContextMap/
├── server/
│   └── index.ts              # Express API server + Gemini integration
├── src/
│   ├── components/
│   │   ├── ContextNodeComponent.tsx  # Custom styled graph node
│   │   ├── DetailPanel.tsx           # Sidebar with node details + Wikipedia links
│   │   ├── SearchPanel.tsx           # Wikipedia entity search with autocomplete
│   │   └── YarnMap.tsx               # React Flow graph visualization
│   ├── data/
│   │   └── chillanExample.ts         # Hardcoded example: 1939 Chillán earthquake
│   ├── services/
│   │   ├── api.ts                    # Frontend → API server bridge
│   │   └── wikipedia.ts              # Wikipedia search + article text fetcher
│   ├── types.ts                      # TypeScript types + graph conversion helpers
│   ├── App.tsx                       # Main application shell
│   └── main.tsx                      # Entry point
├── .env.example              # API key template (copy to .env)
├── ContextMap.bat            # One-click Windows launcher
└── package.json
```

## Tech Stack

- **Frontend:** React 19, TypeScript, [React Flow](https://reactflow.dev/), Tailwind CSS
- **Backend:** Express 5 (serves both API and built frontend)
- **AI:** Google Gemini 2.5 Flash (free tier)
- **Data Source:** Wikipedia API (ensures verifiable, factual input)

## Configuration

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key ([get one free](https://aistudio.google.com/apikey)) |
| `PORT` | Server port (default: `3001`) |

## Security Notes

- **API keys are never committed.** The `.env` file is in `.gitignore`. Only `.env.example` (with placeholder values) is tracked.
- **User input is restricted** to Wikipedia entity search — users cannot inject free-form prompts into the AI.

## License

MIT
