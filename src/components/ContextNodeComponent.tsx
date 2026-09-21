import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ContextNode } from '../types';
import { kindStyle } from '../types';

type ContextNodeData = ContextNode & { color: string };

export default function ContextNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as ContextNodeData;
  const kind = kindStyle(d.kind);
  const isSubject = d.kind === 'subject';

  const glow = selected ? `0 0 0 3px ${d.color}, 0 0 28px ${d.color}88`
    : isSubject ? `0 0 24px ${d.color}66`
    : `0 0 14px ${d.color}33`;

  return (
    <div
      className={`rounded-xl px-4 py-3 w-[260px] cursor-pointer transition-transform hover:scale-[1.03] ${
        isSubject ? 'border-[3px]' : 'border-2'
      }`}
      style={{
        background: '#1e293b',
        borderColor: d.color,
        boxShadow: glow,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />
      {(kind || d.year) && (
        <div className="flex items-center justify-between gap-2 mb-1">
          {kind ? (
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: d.color }}
            >
              {kind.label}
            </span>
          ) : <span />}
          {d.year && <span className="text-[10px] text-slate-400 text-right">{d.year}</span>}
        </div>
      )}
      <p className="text-[15px] font-semibold text-slate-100 leading-snug m-0">
        {d.label}
      </p>
      {d.hook && (
        <p className="text-xs text-slate-400 leading-snug mt-1.5 mb-0 line-clamp-3">
          {d.hook}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </div>
  );
}
