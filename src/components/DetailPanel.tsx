import type { ContextNode } from '../types';

interface DetailPanelProps {
  node: ContextNode | null;
  overallSummary: string;
  onClose: () => void;
}

export default function DetailPanel({ node, overallSummary, onClose }: DetailPanelProps) {
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

      {node.year && (
        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">
          {node.year}
        </span>
      )}
      <h2 className="text-lg font-bold text-slate-100 mb-3">{node.label}</h2>
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
    </div>
  );
}
