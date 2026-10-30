import React, { useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { ActiveTool, UserRole } from '../../types/vtt';

interface TacticalRadarWidgetProps {
  activeTool: ActiveTool;
  onChangeTool: (tool: ActiveTool) => void;
  userRole: UserRole;
  fogEnabled: boolean;
  onToggleFog: () => void;
  onOpenNewTokenModal: () => void;
  onOpenMapModal: () => void;
}

export const TacticalRadarWidget: React.FC<TacticalRadarWidgetProps> = ({
  activeTool,
  onChangeTool,
  userRole,
  fogEnabled,
  onToggleFog,
  onOpenNewTokenModal,
  onOpenMapModal,
}) => {
  const [radarAngle, setRadarAngle] = useState(45);
  const isGM = userRole === 'gm';

  return (
    <div className="flex flex-col space-y-2 select-none w-36">
      {/* 1. TOP KEYPAD MATRIX (Matches the 3x3 / 4x4 keypad in the screenshot) */}
      <div className="bg-[#0b0e14] border border-[#202736] p-1.5 rounded relative">
        {/* Corner brackets */}
        <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500" />
        <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500" />
        
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[9px] font-bold text-amber-500 tracking-wider">▲ MATRIX</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        {/* Tactical Matrix Buttons */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => onChangeTool('select')}
            className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
              activeTool === 'select'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-[#121620] text-slate-400 hover:text-slate-200 border border-[#222a3a]'
            }`}
            title="Select & Move (V)"
          >
            SEL
          </button>

          <button
            onClick={() => onChangeTool('pan')}
            className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
              activeTool === 'pan'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-[#121620] text-slate-400 hover:text-slate-200 border border-[#222a3a]'
            }`}
            title="Pan Viewport"
          >
            PAN
          </button>

          <button
            onClick={() => onChangeTool('measure')}
            className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
              activeTool === 'measure'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-[#121620] text-slate-400 hover:text-slate-200 border border-[#222a3a]'
            }`}
            title="Range Ruler"
          >
            RNG
          </button>

          <button
            onClick={() => onChangeTool('ping')}
            className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
              activeTool === 'ping'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-[#121620] text-amber-400/80 hover:text-amber-300 border border-[#222a3a]'
            }`}
            title="Sonar Ping"
          >
            PNG
          </button>

          <button
            onClick={() => onChangeTool('draw')}
            className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
              activeTool === 'draw'
                ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                : 'bg-[#121620] text-purple-400/80 hover:text-purple-300 border border-[#222a3a]'
            }`}
            title="Vector Pen"
          >
            PEN
          </button>

          <button
            onClick={onOpenMapModal}
            className="p-1.5 rounded-sm flex items-center justify-center bg-[#121620] text-cyan-400 hover:text-cyan-300 border border-[#222a3a] text-[10px] font-bold"
            title="Sector Map"
          >
            MAP
          </button>

          {isGM && (
            <>
              <button
                onClick={onToggleFog}
                className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
                  fogEnabled
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-[#121620] text-slate-500 border border-[#222a3a]'
                }`}
                title="Toggle Fog"
              >
                FOG
              </button>

              <button
                onClick={() => onChangeTool(activeTool === 'fog_reveal' ? 'select' : 'fog_reveal')}
                className={`p-1.5 rounded-sm flex items-center justify-center transition text-[10px] font-bold ${
                  activeTool === 'fog_reveal'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#121620] text-emerald-400 border border-[#222a3a]'
                }`}
                title="Reveal Fog"
              >
                REV
              </button>

              <button
                onClick={onOpenNewTokenModal}
                className="p-1.5 rounded-sm flex items-center justify-center bg-[#121620] text-amber-400 hover:text-amber-300 border border-[#222a3a] text-[10px] font-bold"
                title="Spawn Unit"
              >
                +TKN
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. CIRCULAR RADAR & POWER DIAL (▲ PWR - Exactly as in screenshot) */}
      <div className="bg-[#0b0e14] border border-[#202736] p-2 rounded relative">
        <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-amber-500" />
        <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-amber-500" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold text-amber-500 tracking-wider flex items-center gap-1">
            <span className="text-[8px]">▲</span> PWR
          </span>
          <span className="text-[9px] text-slate-500 font-mono">CORE-01</span>
        </div>

        {/* Circular Dial Graphic */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          {/* Outer circle with ticks */}
          <div className="absolute inset-0 rounded-full border border-amber-500/30 flex items-center justify-center">
            <div className="absolute inset-1 rounded-full border border-dashed border-amber-500/20" />
          </div>

          {/* Glowing amber arc segment */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="46"
              fill="transparent"
              stroke="rgba(245, 158, 11, 0.15)"
              strokeWidth="4"
            />
            <circle
              cx="56"
              cy="56"
              r="46"
              fill="transparent"
              stroke="#f59e0b"
              strokeWidth="4"
              strokeDasharray="289"
              strokeDashoffset="120"
              className="transition-all duration-300"
            />
          </svg>

          {/* Inner rotating sensor ring */}
          <div
            className="w-16 h-16 rounded-full border border-amber-500/40 bg-[#090b10] flex items-center justify-center shadow-[inset_0_0_12px_rgba(245,158,11,0.2)] cursor-pointer"
            onClick={() => setRadarAngle((a) => (a + 45) % 360)}
            title="Click to calibrate azimuth"
          >
            {/* Center crosshair */}
            <Crosshair className="w-6 h-6 text-amber-400 opacity-90" />
            <div
              className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"
              style={{
                transform: `rotate(${radarAngle}deg) translate(22px) rotate(-${radarAngle}deg)`,
              }}
            />
          </div>
        </div>

        {/* Telemetry bottom readouts */}
        <div className="mt-2 pt-1 border-t border-[#1a212d] flex justify-between text-[8px] text-slate-500 font-mono">
          <span>FREQ: 142.9</span>
          <span className="text-amber-400 font-bold">AZ: {radarAngle}°</span>
        </div>
      </div>
    </div>
  );
};
