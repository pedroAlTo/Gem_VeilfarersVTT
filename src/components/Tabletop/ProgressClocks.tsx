import React, { useState } from 'react';
import type { ProgressClock, UserRole } from '../../types/vtt';
import { Plus, Trash2, X, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface ProgressClocksProps {
  clocks: ProgressClock[];
  onUpdateClocks: (clocks: ProgressClock[]) => void;
  userRole: UserRole;
  onClose?: () => void;
}

const PRESET_COLORS = [
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Crimson', hex: '#ef4444' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Purple', hex: '#a855f7' },
];

export const ProgressClocks: React.FC<ProgressClocksProps> = ({
  clocks,
  onUpdateClocks,
  userRole,
  onClose,
}) => {
  const isGM = userRole === 'gm';
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSegments, setNewSegments] = useState<number>(4);
  const [newColor, setNewColor] = useState<string>('#f59e0b');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSegmentClick = (clockId: string, segmentIndex: number) => {
    if (!isGM) return;
    const updated = clocks.map((c) => {
      if (c.id !== clockId) return c;
      // If clicking current progress, decrement by 1; otherwise set to segmentIndex + 1
      const newProgress = c.progress === segmentIndex + 1 ? segmentIndex : segmentIndex + 1;
      return { ...c, progress: Math.max(0, Math.min(c.segments, newProgress)) };
    });
    onUpdateClocks(updated);
  };

  const handleDelta = (clockId: string, delta: number) => {
    if (!isGM) return;
    const updated = clocks.map((c) => {
      if (c.id !== clockId) return c;
      const newProgress = Math.max(0, Math.min(c.segments, c.progress + delta));
      return { ...c, progress: newProgress };
    });
    onUpdateClocks(updated);
  };

  const handleDeleteClock = (clockId: string) => {
    if (!isGM) return;
    onUpdateClocks(clocks.filter((c) => c.id !== clockId));
  };

  const handleAddClock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const newClock: ProgressClock = {
      id: 'clock-' + Date.now(),
      name: newLabel.trim(),
      segments: newSegments,
      progress: 0,
      color: newColor,
    };

    onUpdateClocks([...clocks, newClock]);
    setNewLabel('');
    setIsAdding(false);
  };

  // Helper to build SVG wedge path
  const getSlicePath = (index: number, total: number, radius: number = 32) => {
    const center = 36;
    const startAngle = (2 * Math.PI * index) / total - Math.PI / 2;
    const endAngle = (2 * Math.PI * (index + 1)) / total - Math.PI / 2;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const largeArcFlag = 0; // Each slice is < 180 deg when total >= 3

    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-3.5 select-none text-xs w-72 md:w-80">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
            Progress Clocks
          </span>
          <span className="px-1.5 py-0.2 bg-slate-800 rounded text-slate-400 font-mono text-[10px]">
            {clocks.length}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {isGM && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="p-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white transition"
              title="Add New Clock"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Add Clock Form */}
      {isAdding && isGM && !isCollapsed && (
        <form onSubmit={handleAddClock} className="my-2.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
          <input
            type="text"
            placeholder="Clock Name (e.g. Void Breach, Alert)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
            autoFocus
          />

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Segments:</span>
            <div className="flex space-x-1">
              {[4, 6, 8, 10, 12].map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setNewSegments(seg)}
                  className={`px-2 py-0.5 rounded font-mono font-bold transition ${
                    newSegments === seg
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Color:</span>
            <div className="flex space-x-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setNewColor(c.hex)}
                  className={`w-4 h-4 rounded-full border ${
                    newColor === c.hex ? 'border-white scale-125' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 text-[10px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px]"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Clocks List */}
      {!isCollapsed && (
        <div className="mt-2 space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {clocks.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-[11px]">
              No active progress clocks.
              {isGM && <div className="text-[10px] text-amber-500/80 mt-1">Click + above to create one.</div>}
            </div>
          ) : (
            clocks.map((c) => {
              const isFull = c.progress >= c.segments;
              return (
                <div
                  key={c.id}
                  className={`p-2 rounded-xl border transition flex items-center space-x-3 ${
                    isFull
                      ? 'bg-rose-950/30 border-rose-600/50 shadow-lg shadow-rose-950/30 animate-pulse-subtle'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* SVG Radial Clock Dial */}
                  <div className="relative shrink-0 w-[72px] h-[72px]">
                    <svg viewBox="0 0 72 72" className="w-full h-full cursor-pointer">
                      {/* Background Circle */}
                      <circle cx="36" cy="36" r="32" fill="#0f172a" stroke="#334155" strokeWidth="2" />

                      {/* Segments */}
                      {Array.from({ length: c.segments }).map((_, i) => {
                        const isFilled = i < c.progress;
                        return (
                          <path
                            key={i}
                            d={getSlicePath(i, c.segments, 30)}
                            fill={isFilled ? c.color : 'rgba(30, 41, 59, 0.4)'}
                            stroke="#0f172a"
                            strokeWidth="1.5"
                            className="transition-all hover:opacity-80"
                            onClick={() => handleSegmentClick(c.id, i)}
                          />
                        );
                      })}

                      {/* Center Hub */}
                      <circle cx="36" cy="36" r="6" fill="#090d16" stroke="#475569" strokeWidth="1.5" />
                    </svg>

                    {/* Progress overlay tag */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black text-white/90 drop-shadow">
                        {c.progress}/{c.segments}
                      </span>
                    </div>
                  </div>

                  {/* Info & Controls */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 truncate text-[11px] block" title={c.name}>
                        {c.name}
                      </span>
                      {isGM && (
                        <button
                          onClick={() => handleDeleteClock(c.id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition"
                          title="Delete Clock"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isFull ? (
                        <span className="text-rose-400 font-bold uppercase tracking-wider">Triggered!</span>
                      ) : (
                        <span>{c.segments - c.progress} ticks remaining</span>
                      )}
                    </div>

                    {/* +/- Quick Buttons for GM */}
                    {isGM && (
                      <div className="flex items-center space-x-1 mt-1.5">
                        <button
                          onClick={() => handleDelta(c.id, -1)}
                          disabled={c.progress <= 0}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 font-bold flex items-center justify-center text-xs"
                          title="Subtract 1 tick"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleDelta(c.id, 1)}
                          disabled={c.progress >= c.segments}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 font-bold flex items-center justify-center text-xs"
                          title="Add 1 tick"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

