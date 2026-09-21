import type { ContextGraph, ContextNode } from '../types';
import { kindStyle } from '../types';

interface DetailPanelProps {
  graph: ContextGraph;
  node: ContextNode | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const DEFAULT_COLOR = '#60a5fa';

/** Chronological order by numeric start year; nodes without one go last */
function byStartYear(a: ContextNode, b: ContextNode): number {
  const ay = a.startYear ?? Infinity;
  const by = b.startYear ?? Infinity;
  if (ay === by) return 0;
  return ay < by ? -1 : 1;
}

interface ConnectionRowProps {
  label: string;
  edgeLabel: string;
  onClick: () => void;
}

function ConnectionRow({ label, edgeLabel, onClick }: ConnectionRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
    >
      <span className="text-sm text-slate-100 block">{label}</span>
      {edgeLabel && <span className="text-xs text-slate-400 block mt-0.5">{edgeLabel}</span>}
    </button>
  );
}

export default function DetailPanel({ graph, node, onSelect, onClose }: DetailPanelProps) {
  if (!node) {
    const sorted = [...graph.nodes].sort(byStartYear);
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-3">Context Summary</h2>
        {graph.window?.label && (
          <span className="inline-block mb-3 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-600 text-xs text-slate-300">
            Window: {graph.window.label}
          </span>
        )}
        <p className="text-sm text-slate-300 leading-relaxed">{graph.summary}</p>
        <p className="text-xs text-slate-500 mt-4 italic">
          Click any node on the map to explore its details.
        </p>

        {sorted.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">All nodes</h3>
            <ul className="space-y-1 list-none p-0 m-0">
              {sorted.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onSelect(n.id)}
                    className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{ background: kindStyle(n.kind)?.color ?? DEFAULT_COLOR }}
                    />
                    <span className="text-sm text-slate-200 leading-snug">
                      {n.year && <span className="text-xs text-slate-400 mr-1.5">{n.year}</span>}
                      {n.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const kind = kindStyle(node.kind);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const ledToThis = graph.edges
    .filter((e) => e.target === node.id && nodeById.has(e.source))
    .map((e) => ({ other: nodeById.get(e.source)!, label: e.label }));
  const ledOnTo = graph.edges
    .filter((e) => e.source === node.id && nodeById.has(e.target))
    .map((e) => ({ other: nodeById.get(e.target)!, label: e.label }));

  return (
    <div className="p-6">
      <button
        onClick={onClose}
        className="text-xs text-slate-400 hover:text-slate-200 mb-3 cursor-pointer"
      >
        ← Back to summary
      </button>

      {(kind || node.year) && (
        <div className="flex items-center gap-2 mb-1 text-xs">
          {kind && (
            <span className="font-bold uppercase tracking-wider" style={{ color: kind.color }}>
              {kind.label}
            </span>
          )}
          {node.year && (
            <span className={kind ? 'text-slate-400' : 'font-bold text-blue-400 uppercase tracking-wider'}>
              {node.year}
            </span>
          )}
        </div>
      )}
      <h2 className="text-lg font-bold text-slate-100 mb-3">{node.label}</h2>
      {node.hook && <p className="text-sm text-slate-200 font-medium leading-relaxed mb-3">{node.hook}</p>}
      <p className="text-sm text-slate-300 leading-relaxed">{node.summary}</p>

      {node.wikipediaUrl && (
        <a
          href={node.wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 underline"
        >
          Read more on Wikipedia →
        </a>
      )}

      {(ledToThis.length > 0 || ledOnTo.length > 0) && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Connections</h3>
          {ledToThis.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1.5 mt-0">Led to this</p>
              <div className="space-y-1.5">
                {ledToThis.map((c) => (
                  <ConnectionRow key={`in-${c.other.id}-${c.label}`} label={c.other.label} edgeLabel={c.label} onClick={() => onSelect(c.other.id)} />
                ))}
              </div>
            </div>
          )}
          {ledOnTo.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 mt-0">Led on to</p>
              <div className="space-y-1.5">
                {ledOnTo.map((c) => (
                  <ConnectionRow key={`out-${c.other.id}-${c.label}`} label={c.other.label} edgeLabel={c.label} onClick={() => onSelect(c.other.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
