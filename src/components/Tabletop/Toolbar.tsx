import React from 'react';
import {
  MousePointer,
  Hand,
  Ruler,
  Radio,
  Pencil,
  Eye,
  EyeOff,
  UserPlus,
  Map as MapIcon,
  Eraser,
  Grid,
  Clock,
} from 'lucide-react';
import type { ActiveTool, UserRole } from '../../types/vtt';

interface ToolbarProps {
  activeTool: ActiveTool;
  onChangeTool: (tool: ActiveTool) => void;
  userRole: UserRole;
  drawColor: string;
  onChangeDrawColor: (c: string) => void;
  brushSize: number;
  onChangeBrushSize: (s: number) => void;
  onOpenNewTokenModal: () => void;
  onOpenMapModal: () => void;
  onClearDrawings: () => void;
  fogEnabled: boolean;
  onToggleFog: () => void;
  onToggleClocks?: () => void;
  clocksOpen?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onChangeTool,
  userRole,
  drawColor,
  onChangeDrawColor,
  brushSize,
  onChangeBrushSize,
  onOpenNewTokenModal,
  onOpenMapModal,
  onClearDrawings,
  fogEnabled,
  onToggleFog,
  onToggleClocks,
  clocksOpen,
}) => {
  const isGM = userRole === 'gm';

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col space-y-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-2 rounded-xl shadow-2xl">
      {/* Primary Selection & Pan */}
      <button
        onClick={() => onChangeTool('select')}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          activeTool === 'select'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Select & Move Tokens (V)"
      >
        <MousePointer className="w-5 h-5" />
      </button>

      <button
        onClick={() => onChangeTool('pan')}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          activeTool === 'pan'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Pan Canvas (Space / Hand)"
      >
        <Hand className="w-5 h-5" />
      </button>

      <button
        onClick={() => onChangeTool('measure')}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          activeTool === 'measure'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Measure Distance (M)"
      >
        <Ruler className="w-5 h-5" />
      </button>

      <button
        onClick={() => onChangeTool('ping')}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          activeTool === 'ping'
            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Ping Map to Alert Party (P)"
      >
        <Radio className="w-5 h-5" />
      </button>

      <div className="w-full h-px bg-slate-800 my-1" />

      {/* Freehand Drawing */}
      <button
        onClick={() => onChangeTool('draw')}
        className={`p-2 rounded-lg flex items-center justify-center transition ${
          activeTool === 'draw'
            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Freehand Draw / Annotate (D)"
      >
        <Pencil className="w-5 h-5" />
      </button>

      {activeTool === 'draw' && (
        <div className="flex flex-col items-center space-y-1.5 py-1 bg-slate-950/60 rounded-lg p-1">
          <input
            type="color"
            value={drawColor}
            onChange={(e) => onChangeDrawColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            title="Brush Color"
          />
          <input
            type="range"
            min="2"
            max="16"
            value={brushSize}
            onChange={(e) => onChangeBrushSize(parseInt(e.target.value, 10))}
            className="w-12 h-1 accent-purple-500 cursor-pointer"
            title="Brush Size"
          />
          <button
            onClick={onClearDrawings}
            className="p-1 hover:text-red-400 text-slate-400 rounded transition"
            title="Clear All Drawings"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GM-Only Tools: Fog of War, Tokens, Maps */}
      {isGM && (
        <>
          <div className="w-full h-px bg-slate-800 my-1" />

          <button
            onClick={onToggleFog}
            className={`p-2 rounded-lg flex items-center justify-center transition ${
              fogEnabled
                ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/40'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
            title={fogEnabled ? 'Fog of War Active (Click to toggle)' : 'Enable Fog of War'}
          >
            <Grid className="w-5 h-5" />
          </button>

          {fogEnabled && (
            <>
              <button
                onClick={() => onChangeTool('fog_reveal')}
                className={`p-2 rounded-lg flex items-center justify-center transition ${
                  activeTool === 'fog_reveal'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Reveal Fog Area"
              >
                <Eye className="w-5 h-5" />
              </button>

              <button
                onClick={() => onChangeTool('fog_hide')}
                className={`p-2 rounded-lg flex items-center justify-center transition ${
                  activeTool === 'fog_hide'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Shroud / Hide Area"
              >
                <EyeOff className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="w-full h-px bg-slate-800 my-1" />

          <button
            onClick={onOpenNewTokenModal}
            className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
            title="Create New Token"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenMapModal}
            className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
            title="Change Map or Upload Custom Map"
          >
            <MapIcon className="w-5 h-5" />
          </button>

          {onToggleClocks && (
            <button
              onClick={onToggleClocks}
              className={`p-2 rounded-lg flex items-center justify-center transition ${
                clocksOpen
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
              }`}
              title="Progress Clocks Tracker"
            >
              <Clock className="w-5 h-5" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
