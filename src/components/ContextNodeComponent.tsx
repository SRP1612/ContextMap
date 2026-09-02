import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ContextNode } from '../types';
import { formatYear } from '../types';

type ContextNodeData = ContextNode & { color: string };

export default function ContextNodeComponent({ data }: NodeProps) {
  const d = data as unknown as ContextNodeData;
  const undated = d.year === undefined;

  return (
    <div
      className="rounded-xl border-2 shadow-lg px-4 py-3 max-w-[220px] cursor-pointer transition-transform hover:scale-105"
      style={{
        background: '#1e293b',
        borderColor: d.color,
        boxShadow: `0 0 16px ${d.color}44`,
        // Undated nodes sit at an inferred position, so they read as less certain.
        opacity: undated ? 0.65 : 1,
        borderStyle: undated ? 'dashed' : 'solid',
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />
      <span
        className="text-[10px] font-bold uppercase tracking-wider block mb-1"
        style={{ color: d.color }}
      >
        {formatYear(d.year)}
      </span>
      <p className="text-sm font-semibold text-slate-100 leading-tight m-0">{d.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </div>
  );
}
