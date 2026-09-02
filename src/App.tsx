import { useState, useCallback, useRef, useEffect } from 'react';
import YarnMap from './components/YarnMap';
import DetailPanel from './components/DetailPanel';
import SearchPanel from './components/SearchPanel';
import ControlBar from './components/ControlBar';
import { buildGraph } from './graph/builder';
import type { ContextGraph, ContextNode, GraphSettings, WikiSearchResult } from './types';
import { DEFAULT_SETTINGS } from './types';

const REBUILD_DEBOUNCE_MS = 400;

function App() {
  const [graph, setGraph] = useState<ContextGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<ContextNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [seed, setSeed] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = useCallback(async (title: string, next: GraphSettings) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const result = await buildGraph(title, { ...next, signal: controller.signal });
      if (controller.signal.aborted) return;
      setGraph(result);
      setSelectedNode(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Could not build the map.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  const handleSelect = useCallback(
    (result: WikiSearchResult) => {
      setSeed(result.title);
      run(result.title, settings);
    },
    [run, settings],
  );

  // Slider changes are debounced so dragging does not fire a build per step.
  const handleSettingsChange = useCallback(
    (next: GraphSettings) => {
      setSettings(next);
      if (!seed) return;

      const rebuildNeeded = next.depth !== settings.depth || next.width !== settings.width;
      if (!rebuildNeeded) return;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => run(seed, next), REBUILD_DEBOUNCE_MS);
    },
    [run, seed, settings.depth, settings.width],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const recenter = useCallback(
    (node: ContextNode) => {
      setSeed(node.title);
      run(node.title, settings);
    },
    [run, settings],
  );

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950">
      <header className="flex items-center gap-4 px-6 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight whitespace-nowrap">
          <span className="text-sky-400">Context</span>Map
        </h1>
        <SearchPanel onSelect={handleSelect} isLoading={isLoading} />
      </header>

      <div className="px-6 py-3 shrink-0">
        <ControlBar
          settings={settings}
          onChange={handleSettingsChange}
          disabled={isLoading || !seed}
          nodeCount={graph?.nodes.length}
          requestCount={graph?.requestCount}
        />
      </div>

      {error && (
        <div className="px-6 py-2 border-b bg-red-950 border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {graph?.degraded && !error && (
        <div className="px-6 py-2 border-b bg-amber-950 border-amber-800 text-amber-300 text-sm">
          Wikidata was unreachable, so some links show as &ldquo;closely related&rdquo; instead
          of a named relationship. Adjust a slider to retry.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/70 z-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-300">Building context map…</span>
              </div>
            </div>
          )}

          {graph ? (
            <YarnMap graph={graph} layout={settings.layout} onNodeClick={setSelectedNode} />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-8">
              <div>
                <p className="text-slate-300 text-lg mb-2">Search for any Wikipedia topic.</p>
                <p className="text-slate-500 text-sm max-w-md">
                  ContextMap builds a map from Wikidata relationships and Wikipedia relevance.
                  No AI and no API keys, so the same topic always gives the same map.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="w-80 bg-slate-900 border-l border-slate-700 overflow-y-auto shrink-0">
          <DetailPanel
            node={selectedNode}
            overallSummary={graph?.summary ?? 'Search for a topic to begin.'}
            onClose={() => setSelectedNode(null)}
            onRecenter={recenter}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
