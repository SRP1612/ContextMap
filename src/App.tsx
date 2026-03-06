import { useState, useCallback } from 'react';
import YarnMap from './components/YarnMap';
import DetailPanel from './components/DetailPanel';
import SearchPanel from './components/SearchPanel';
import { chillanExample } from './data/chillanExample';
import { getWikipediaExtract } from './services/wikipedia';
import { generateGraph } from './services/api';
import type { ContextGraph, ContextNode, WikiSearchResult } from './types';

function App() {
  const [graph, setGraph] = useState<ContextGraph>(chillanExample);
  const [selectedNode, setSelectedNode] = useState<ContextNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (result: WikiSearchResult) => {
    setIsLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      const extract = await getWikipediaExtract(result.title);
      if (!extract) throw new Error('No Wikipedia content found for this article.');
      const newGraph = await generateGraph(result.title, extract);
      setGraph(newGraph);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight whitespace-nowrap">
          <span className="text-blue-400">Context</span>Map
        </h1>
        <SearchPanel onSelect={handleSearch} isLoading={isLoading} />
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
