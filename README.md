# ContextMap

An interactive causal knowledge graph that maps the historical and topical context behind any event. Search for a Wikipedia-verified event (historical or current), and an AI generates a visual "yarn map" showing the chain of causes, consequences, and connections — with links to learn more about each one.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-orange) ![License](https://img.shields.io/badge/License-GPLv3-blue)

## How It Works

1. **Search** — Type an event in the search bar. Results come from Wikipedia's API, ensuring every entry is a real, verifiable topic.
2. **Set Depth** — Choose a context depth from the dropdown: Narrow (50 yr), Standard (100 yr), Extended (200 yr), or Deep History (500 yr). Deeper settings explore philosophical shifts, cultural movements, and long-wave causality.
3. **Generate** — Select a result. The app fetches the Wikipedia article text and sends it to Google Gemini, which identifies causal events forming a chain leading to (and resulting from) the main event. Changing the depth automatically regenerates the graph.
4. **Explore** — The causal graph renders as an interactive node map. Drag nodes, zoom in/out, and click any node to read its summary and follow Wikipedia links.

### Example: 1939 Chillán Earthquake

The app ships with a hardcoded example demonstrating how the Spanish conquest of Chile in the 1540s set off a multi-century chain of events — replacing indigenous building practices with heavy European adobe construction — that directly amplified the death toll of the 1939 earthquake nearly 400 years later.

## Getting Started

### Quick Start (pre-built release)

If you downloaded a release `.zip`, **no build tools are needed** — just Node.js:

1. **Install [Node.js](https://nodejs.org/)** (v18 or later). Verify with `node -v` in a terminal.
2. **Unzip** the release folder anywhere.
3. **Add your API key** — copy `.env.example` to `.env` and paste your free [Google Gemini API key](https://aistudio.google.com/apikey):
   ```
   GEMINI_API_KEY=your_key_here
   ```
4. **Double-click `ContextMap.bat`** — the app opens in your browser at http://localhost:3001.

That's it. No `npm install`, no build step.

### From Source (development)

#### Prerequisites

| Requirement | Version | How to get it |
|---|---|---|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) — use the LTS installer. This also installs `npm`. |
| **npm** | 9+ | Comes with Node.js. Verify: `npm -v` |
| **Gemini API key** | — | Free, no credit card: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

#### Installation

```bash
# Clone the repo
git clone https://github.com/SRP1612/ContextMap.git
cd ContextMap

# Install dependencies
npm install

# Set up your API key
cp .env.example .env
# Edit .env and paste your Gemini API key
```

> **Windows note:** If `cp` doesn't work, just copy `.env.example`, rename the copy to `.env`, and edit it.

#### Running

**Option A — Production mode (one command):**

```bash
npm run build
npm start
```

Then open http://localhost:3001. Or double-click `ContextMap.bat`.

**Option B — Development mode (hot reload):**

```bash
# Terminal 1: API server
npm run dev:server

# Terminal 2: Vite dev server with hot reload
npm run dev
```

Then open http://localhost:5173.

#### Building a Release

To produce a self-contained folder you can zip and share:

```bash
npm run build:release
```

This creates `release/ContextMap/` containing everything needed to run — recipients only need Node.js and their own API key.

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
├── scripts/
│   └── build-release.js              # Builds distributable release folder
├── .env.example              # API key template (copy to .env)
├── ContextMap.bat            # One-click Windows launcher
└── package.json
```

## Tech Stack

- **Frontend:** React 19, TypeScript, [React Flow](https://reactflow.dev/), [Dagre](https://github.com/dagrejs/dagre) (graph layout), Tailwind CSS
- **Backend:** Express 5 (serves both API and built frontend)
- **AI:** Google Gemini 2.5 Flash (free tier)
- **Data Source:** Wikipedia API (ensures verifiable, factual input)
- **Rate Limiting:** Automatic cooldown with countdown timer and auto-retry on Gemini 429 errors

## Configuration

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key ([get one free](https://aistudio.google.com/apikey)) |
| `PORT` | Server port (default: `3001`) |

## Security Notes

- **API keys are never committed.** The `.env` file is in `.gitignore`. Only `.env.example` (with placeholder values) is tracked.
- **User input is restricted** to Wikipedia entity search — users cannot inject free-form prompts into the AI.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

In short: you are free to use, modify, and distribute this project, but any derivative works must also be released under GPL v3 with source code available.
