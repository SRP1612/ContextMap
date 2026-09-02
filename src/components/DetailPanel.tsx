import type { ContextNode } from '../types';
import { formatYear } from '../types';

interface DetailPanelProps {
  node: ContextNode | null;
  overallSummary: string;
  onClose: () => void;
  onRecenter: (node: ContextNode) => void;
}

export default function DetailPanel({
  node,
  overallSummary,
  onClose,
  onRecenter,
}: DetailPanelProps) {
  if (!node) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-3">Context Summary</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{overallSummary}</p>
        <p className="text-xs text-slate-500 mt-4 italic">
          Click any node on the map to explore its details.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={onClose}
        className="text-xs text-slate-400 hover:text-slate-200 mb-3 cursor-pointer"
      >
        ← Back to summary
      </button>

      {node.thumbnail && (
        <img
          src={node.thumbnail}
          alt=""
          className="w-full h-32 object-cover rounded-lg mb-3 border border-slate-700"
        />
      )}

      <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-1">
        {formatYear(node.year)}
        {node.year === undefined && ' · no date in Wikidata'}
      </span>
      <h2 className="text-lg font-bold text-slate-100 mb-3">{node.label}</h2>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{node.summary}</p>

      <button
        onClick={() => onRecenter(node)}
        className="w-full mt-4 px-3 py-2 text-sm rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/40 hover:bg-sky-500/25 cursor-pointer"
      >
        Rebuild map around this topic
      </button>

      <div className="flex gap-4 mt-4 text-sm">
        <a
          href={node.wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline"
        >
          Wikipedia →
        </a>
        {node.qid && (
          <a
            href={`https://www.wikidata.org/wiki/${node.qid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-300 underline"
          >
            Wikidata {node.qid} →
          </a>
        )}
      </div>
    </div>
  );
}
