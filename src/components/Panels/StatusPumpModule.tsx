import React, { useState } from 'react';
import { Sparkles, Zap, Activity, Shield } from 'lucide-react';
import { sounds } from '../../services/audio';

interface StatusPumpModuleProps {
  characterName: string;
  onSendActionLog?: (log: string) => void;
}

export const StatusPumpModule: React.FC<StatusPumpModuleProps> = ({
  characterName,
  onSendActionLog,
}) => {
  // Canonical 12.06 Effort Track (0-6)
  const [effort, setEffort] = useState(2);
  // Canonical 12.06 Hope (0-5)
  const [hope, setHope] = useState(3);
  // Armor Slots (0-3)
  const [armorSlots, setArmorSlots] = useState(3);
  // Resolve dice (d4s)
  const [resolveDice, setResolveDice] = useState(2);

  const handleSpendEffort = (delta: number) => {
    const next = Math.max(0, Math.min(6, effort + delta));
    setEffort(next);
    sounds.tokenMove();
    if (delta > 0) {
      onSendActionLog?.(`${characterName} spends 1 Effort (${next}/6)`);
    }
  };

  const handleSpendHope = (delta: number) => {
    const next = Math.max(0, Math.min(5, hope + delta));
    setHope(next);
    sounds.hopeChime();
    if (delta > 0) {
      onSendActionLog?.(`${characterName} gains 1 Hope (${next}/5)`);
    } else {
      onSendActionLog?.(`${characterName} spends 1 Hope (${next}/5)`);
    }
  };

  const handleSpendArmorSlot = (delta: number) => {
    const next = Math.max(0, Math.min(3, armorSlots + delta));
    setArmorSlots(next);
    sounds.tokenMove();
    if (delta < 0) {
      onSendActionLog?.(`${characterName} marks 1 Armor Slot to blunt a hit (${next}/3 remaining)`);
    } else {
      onSendActionLog?.(`${characterName} recovers 1 Armor Slot (${next}/3)`);
    }
  };

  const handleBearDown = () => {
    if (resolveDice <= 0) return;
    const next = resolveDice - 1;
    setResolveDice(next);
    sounds.fanfare();
    onSendActionLog?.(`${characterName} executes [BEAR DOWN] move (Universal Resolve): Rolls d4 for surge!`);
  };

  return (
    <div className="bg-[#080b11] border border-[#1b2333] p-2.5 rounded-sm select-none font-mono relative text-xs">
      {/* Corner Brackets */}
      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500 z-10" />
      <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-amber-500 z-10" />

      {/* TOP HEADER: ▲ PUMP STP | R-02 ACTIVE (Directly matches reference screenshot) */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#1b2332]">
        <div className="flex items-center space-x-2">
          <span className="text-amber-500 font-bold tracking-widest text-[10px] flex items-center gap-1">
            <span className="text-[8px]">▲</span> PUMP STP
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-bold text-[9px] uppercase">
            READINESS CORE
          </span>
        </div>

        {/* Illuminated R-02 indicator pill (Vibrant green from screenshot) */}
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-500 text-slate-950 font-black text-[9px] tracking-wider rounded-xs shadow-[0_0_8px_rgba(16,185,129,0.7)]">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
          <span>R-02 ACTIVE</span>
        </div>
      </div>

      {/* CANONICAL 12.06 EFFORT TRACK (0-6) */}
      <div className="bg-[#0e131d] p-2 rounded-xs border border-[#1b2434] mb-2 space-y-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-300 font-bold flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>EFFORT TRACK:</span>
          </span>
          <span className="font-mono font-bold text-cyan-400">{effort} / 6 USED</span>
        </div>

        {/* 6 Effort Boxes */}
        <div className="grid grid-cols-6 gap-1 pt-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <button
              key={i}
              onClick={() => handleSpendEffort(i < effort ? -1 : 1)}
              className={`h-4 rounded-xs border transition flex items-center justify-center font-bold text-[8px] ${
                i < effort
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.5)]'
                  : 'bg-[#121722] text-slate-600 border-[#1c2436] hover:border-slate-500'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="text-[8px] text-slate-500 flex justify-between">
          <span>0 (FRESH)</span>
          <span>6 (EXHAUSTED)</span>
        </div>
      </div>

      {/* HOPE POOL, ARMOR SLOTS & RESOLVE DICE */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {/* Hope Pool (0-5) */}
        <div className="bg-[#0e131d] p-1.5 rounded-xs border border-[#1b2434]">
          <div className="flex justify-between items-center text-[8px] mb-1">
            <span className="text-amber-400 font-bold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              <span>HOPE:</span>
            </span>
            <span className="font-mono font-bold text-amber-300">{hope}/5</span>
          </div>
          <div className="flex space-x-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleSpendHope(i < hope ? -1 : 1)}
                className={`h-3 flex-1 rounded-xs transition ${
                  i < hope
                    ? 'bg-amber-500 shadow-[0_0_4px_#f59e0b]'
                    : 'bg-[#151c28] border border-[#212c3e]'
                }`}
                title={`Hope charge ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Armor Slots (0-3) */}
        <div className="bg-[#0e131d] p-1.5 rounded-xs border border-[#1b2434]">
          <div className="flex justify-between items-center text-[8px] mb-1">
            <span className="text-cyan-400 font-bold flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5 text-cyan-400" />
              <span>ARMOR:</span>
            </span>
            <span className="font-mono font-bold text-cyan-300">{armorSlots}/3</span>
          </div>
          <div className="flex space-x-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleSpendArmorSlot(i < armorSlots ? -1 : 1)}
                className={`h-3 flex-1 rounded-xs transition ${
                  i < armorSlots
                    ? 'bg-cyan-500 shadow-[0_0_4px_#06b6d4]'
                    : 'bg-[#151c28] border border-[#212c3e]'
                }`}
                title={`Armor slot ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Universal Resolve Moves */}
        <div className="bg-[#0e131d] p-1.5 rounded-xs border border-[#1b2434] flex flex-col justify-between">
          <div className="flex justify-between items-center text-[8px]">
            <span className="text-indigo-400 font-bold flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />
              <span>RESOLVE:</span>
            </span>
            <span className="font-bold text-indigo-300">{resolveDice}d4</span>
          </div>

          <button
            onClick={handleBearDown}
            disabled={resolveDice <= 0}
            className={`mt-1 py-0.5 rounded-xs text-[7px] font-black uppercase transition ${
              resolveDice > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_6px_rgba(99,102,241,0.5)]'
                : 'bg-[#141a24] text-slate-600 cursor-not-allowed'
            }`}
            title="Spend 1d4 Resolve to ignore 1 hit or add d4 bonus"
          >
            BEAR DOWN
          </button>
        </div>
      </div>

      {/* BOTTOM TELEMETRY STATUS CHIP */}
      <div className="pt-1 border-t border-[#1a2230] flex items-center justify-between text-[8px] text-slate-500">
        <span>VALVE 01: NOMINAL</span>
        <span className="text-emerald-400 font-bold">100% READINESS</span>
      </div>
    </div>
  );
};
