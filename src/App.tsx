import { useState, useCallback, useRef, useEffect } from 'react';
import YarnMap from './components/YarnMap';
import DetailPanel from './components/DetailPanel';
import SearchPanel from './components/SearchPanel';
import { chillanExample } from './data/chillanExample';
import { getWikipediaExtract } from './services/wikipedia';
import { generateGraph } from './services/api';
import type { ContextGraph, ContextNode, ContextDepth, WikiSearchResult } from './types';
import { DEPTH_OPTIONS } from './types';

function App() {
  const [graph, setGraph] = useState<ContextGraph>(chillanExample);
  const [selectedNode, setSelectedNode] = useState<ContextNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState<ContextDepth>('standard');
  const lastResultRef = useRef<WikiSearchResult | null>(null);
  const prevDepthRef = useRef<ContextDepth>(depth);

  const handleSearch = useCallback(async (result: WikiSearchResult) => {
    lastResultRef.current = result;
    setIsLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      const extract = await getWikipediaExtract(result.title);
      if (!extract) throw new Error('No Wikipedia content found for this article.');
      const newGraph = await generateGraph(result.title, extract, depth);
      setGraph(newGraph);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [depth]);

  // Auto-regenerate when depth changes and there's a previous search
  useEffect(() => {
    if (depth !== prevDepthRef.current && lastResultRef.current) {
      prevDepthRef.current = depth;
      handleSearch(lastResultRef.current);
    } else {
      prevDepthRef.current = depth;
    }
  }, [depth, handleSearch]);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight whitespace-nowrap">
          <span className="text-blue-400">Context</span>Map
        </h1>
        <SearchPanel onSelect={handleSearch} isLoading={isLoading} />

        {/* Depth selector */}
        <div className="relative group shrink-0">
          <select
            value={depth}
            onChange={(e) => setDepth(e.target.value as ContextDepth)}
            disabled={isLoading}
            className="appearance-none px-3 py-2.5 pr-8 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {DEPTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className="absolute top-full right-0 mt-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded shadow-lg
                          whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {DEPTH_OPTIONS.find(o => o.value === depth)?.description}
          </div>
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 bg-red-950 border-b border-red-800 text-red-300 text-sm">
          {error}
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
            onNodeClick={(node) => setSelectedNode(node)}
          />
        </div>

        {/* Detail sidebar */}
        <aside className="w-80 bg-slate-900 border-l border-slate-700 overflow-y-auto shrink-0">
          <DetailPanel
            node={selectedNode}
            overallSummary={graph.summary}
            onClose={() => setSelectedNode(null)}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
