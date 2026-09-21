import { useState, useEffect, useRef } from 'react';
import { searchWikipedia } from '../services/wikipedia';
import type { WikiSearchResult } from '../types';

interface SearchPanelProps {
  onSelect: (result: WikiSearchResult) => void;
  isLoading: boolean;
}

export default function SearchPanel({ onSelect, isLoading }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced Wikipedia search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchWikipedia(query);
        setResults(r);
        setShowDropdown(r.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as HTMLElement)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search any event, person, idea or place…"
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={isLoading}
          />
          {(searching || isLoading) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map((r) => (
            <li key={r.pageId}>
              <button
                onClick={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  setResults([]);
                  setShowDropdown(false);
                  setQuery(r.title);
                  onSelect(r);
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors cursor-pointer border-b border-slate-700 last:border-b-0"
              >
                <span className="text-sm font-medium text-slate-100 block">{r.title}</span>
                <span className="text-xs text-slate-400 line-clamp-2">{r.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
