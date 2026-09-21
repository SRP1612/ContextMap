import { useState, useCallback, useRef, useEffect } from 'react';
import YarnMap from './components/YarnMap';
import DetailPanel from './components/DetailPanel';
import SearchPanel from './components/SearchPanel';
import { chillanExample, chillanExampleArticle } from './data/chillanExample';
import { getWikipediaExtract } from './services/wikipedia';
import { generateGraph, RateLimitError } from './services/api';
import type { ContextGraph, ContextNode, ContextScale, WikiSearchResult } from './types';
import { SCALE_OPTIONS } from './types';

function App() {
  const [graph, setGraph] = useState<ContextGraph>(chillanExample);
  const [selectedNode, setSelectedNode] = useState<ContextNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<ContextScale>('generational');
  const [cooldown, setCooldown] = useState(0);
  const lastResultRef = useRef<WikiSearchResult | null>(chillanExampleArticle);
  const prevScaleRef = useRef<ContextScale>(scale);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown > 0]); // only restart when transitioning to/from cooldown

  // Auto-retry when cooldown expires
  useEffect(() => {
    if (cooldown === 0 && lastResultRef.current && (error?.includes('Rate limit') || error?.includes('temporarily unavailable'))) {
      setError(null);
      handleSearch(lastResultRef.current);
    }
  }, [cooldown]);

  const handleSearch = useCallback(async (result: WikiSearchResult) => {
    // Remember the request first: during a cooldown it isn't fired now, but the
    // auto-retry that runs when the cooldown expires will pick it up.
    lastResultRef.current = result;
    if (cooldown > 0) return;
    setIsLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      const extract = await getWikipediaExtract(result.title);
      if (!extract) throw new Error('No Wikipedia content found for this article.');
      const newGraph = await generateGraph(result.title, extract, scale);
      setGraph(newGraph);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setCooldown(err.retryAfter);
        setError('Rate limit reached or service temporarily unavailable — auto-retrying when cooldown expires.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  }, [scale, cooldown]);

  // Regenerate the current article when the scale changes
  useEffect(() => {
    if (scale !== prevScaleRef.current) {
      prevScaleRef.current = scale;
      if (lastResultRef.current) handleSearch(lastResultRef.current);
    }
  }, [scale, handleSearch]);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight whitespace-nowrap">
          <span className="text-blue-400">Context</span>Map
        </h1>
        <SearchPanel onSelect={handleSearch} isLoading={isLoading} />

        {/* Scale selector */}
        <div className="relative group shrink-0">
          <select
            value={scale}
            onChange={(e) => setScale(e.target.value as ContextScale)}
            disabled={isLoading}
            className="appearance-none px-3 py-2.5 pr-8 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className="absolute top-full right-0 mt-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded shadow-lg
                          whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {SCALE_OPTIONS.find(o => o.value === scale)?.description}
          </div>
        </div>
      </header>

      {error && (
        <div className={`px-6 py-2 border-b text-sm flex items-center gap-3 ${
          cooldown > 0
            ? 'bg-amber-950 border-amber-800 text-amber-300'
            : 'bg-red-950 border-red-800 text-red-300'
        }`}>
          <span className="flex-1">{error}</span>
          {cooldown > 0 && (
            <span className="flex items-center gap-2 shrink-0 font-medium">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {cooldown}s
            </span>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Yarn Map */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/70 z-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-300">Generating context map…</span>
              </div>
            </div>
          )}
          <YarnMap
            graph={graph}
            selectedId={selectedNode?.id ?? null}
            onNodeClick={(node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
          />
        </div>

        {/* Detail sidebar */}
        <aside className="w-80 bg-slate-900 border-l border-slate-700 overflow-y-auto shrink-0">
          <DetailPanel
            graph={graph}
            node={selectedNode}
            onSelect={(id) => setSelectedNode(graph.nodes.find((n) => n.id === id) ?? null)}
            onClose={() => setSelectedNode(null)}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
