import type { GraphSettings, LayoutMode } from '../types';
import { DEPTH_RANGE, WIDTH_RANGE } from '../types';

interface ControlBarProps {
  settings: GraphSettings;
  onChange: (next: GraphSettings) => void;
  disabled: boolean;
  nodeCount?: number;
  requestCount?: number;
}

const DEPTH_HINT = ['direct links only', 'two hops out', 'three hops out'];

export default function ControlBar({
  settings,
  onChange,
  disabled,
  nodeCount,
  requestCount,
}: ControlBarProps) {
  const set = (patch: Partial<GraphSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-6 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg">
      <label className="flex items-center gap-3 text-sm">
        <span className="text-slate-300 w-14">Depth</span>
        <input
          type="range"
          min={DEPTH_RANGE.min}
          max={DEPTH_RANGE.max}
          step={1}
          value={settings.depth}
          disabled={disabled}
          onChange={(e) => set({ depth: Number(e.target.value) })}
          className="w-32 accent-sky-400 disabled:opacity-40"
        />
        <span className="text-slate-400 w-32 tabular-nums">
          {settings.depth} — {DEPTH_HINT[settings.depth - 1]}
        </span>
      </label>

      <label className="flex items-center gap-3 text-sm">
        <span className="text-slate-300 w-14">Width</span>
        <input
          type="range"
          min={WIDTH_RANGE.min}
          max={WIDTH_RANGE.max}
          step={1}
          value={settings.width}
          disabled={disabled}
          onChange={(e) => set({ width: Number(e.target.value) })}
          className="w-32 accent-violet-400 disabled:opacity-40"
        />
        <span className="text-slate-400 w-32 tabular-nums">
          {settings.width} branches / topic
        </span>
      </label>

      <div className="flex items-center gap-1 text-sm">
        {(['chronological', 'radial'] as LayoutMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => set({ layout: mode })}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md capitalize transition-colors disabled:opacity-40 ${
              settings.layout === mode
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 border border-transparent hover:bg-slate-700/60'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {nodeCount !== undefined && (
        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          {nodeCount} nodes · {requestCount} requests
        </span>
      )}
    </div>
  );
}
