import React from 'react';
import type { Token, UserRole, ConditionType, ProgressClock } from '../../types/vtt';
import { Flame, Shield, Heart, RotateCcw, AlertTriangle, ChevronRight, Clock } from 'lucide-react';

interface InitiativeTrackerProps {
  tokens: Record<string, Token>;
  activeTokenId?: string;
  round: number;
  actedThisRound: string[];
  userRole: UserRole;
  keeperFear: number;
  crewHeat: number;
  onUpdateTokens: (tokens: Record<string, Token>) => void;
  onPassSpotlight: (tokenId: string) => void;
  onNextRound: () => void;
  onResetEncounter: () => void;
  onUpdateKeeperFear: (val: number) => void;
  onUpdateCrewHeat: (val: number) => void;
  onSelectToken: (token: Token) => void;
  clocks?: ProgressClock[];
  onUpdateClocks?: (clocks: ProgressClock[]) => void;
}

const COMMON_CONDITIONS: ConditionType[] = [
  'Dazed',
  'Vulnerable',
  'Stunned',
  'Bleeding',
  'On Fire',
  'Restrained',
  'Prone',
  'Hidden',
];

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  tokens,
  activeTokenId,
  round,
  actedThisRound,
  userRole,
  keeperFear,
  crewHeat,
  onUpdateTokens,
  onPassSpotlight,
  onNextRound,
  onResetEncounter,
  onUpdateKeeperFear,
  onUpdateCrewHeat,
  onSelectToken,
  clocks = [],
  onUpdateClocks,
}) => {
  const isGM = userRole === 'gm';
  const tokenList = Object.values(tokens).filter((t) => !t.isHidden || isGM);

  const handleQuickHp = (tokenId: string, delta: number) => {
    const token = tokens[tokenId];
    if (!token) return;
    const newHp = Math.max(0, Math.min(token.maxHp, token.hp + delta));
    onUpdateTokens({
      ...tokens,
      [tokenId]: { ...token, hp: newHp },
    });
  };

  const handleQuickArmorSlot = (tokenId: string, delta: number) => {
    const token = tokens[tokenId];
    if (!token) return;
    const newSlots = Math.max(0, Math.min(token.maxArmorSlots, token.armorSlots + delta));
    onUpdateTokens({
      ...tokens,
      [tokenId]: { ...token, armorSlots: newSlots },
    });
  };

  const handleQuickStress = (tokenId: string, delta: number) => {
    const token = tokens[tokenId];
    if (!token) return;
    const newStress = Math.max(0, Math.min(token.maxStress, token.stress + delta));
    onUpdateTokens({
      ...tokens,
      [tokenId]: { ...token, stress: newStress },
    });
  };

  const toggleCondition = (tokenId: string, cond: ConditionType) => {
    const token = tokens[tokenId];
    if (!token) return;
    const exists = token.conditions.includes(cond);
    const next = exists
      ? token.conditions.filter((c) => c !== cond)
      : [...token.conditions, cond];
    onUpdateTokens({
      ...tokens,
      [tokenId]: { ...token, conditions: next },
    });
  };

  const getHeatLabel = (heat: number) => {
    if (heat <= 2) return 'Cold (0-2)';
    if (heat <= 4) return 'Warm (3-4)';
    if (heat <= 6) return 'Hot (5-6)';
    if (heat <= 8) return 'Burning (7-8)';
    if (heat === 9) return 'Inferno (9)';
    return 'Burned (10)';
  };

  return (
    <div className="flex flex-col h-full bg-[#080a10] border border-[#1b2333] select-none text-xs font-mono relative">
      {/* Corner Brackets */}
      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500 z-10" />

      {/* TOP HEADER: ▲ FNC / COMBAT TELEMETRY */}
      <div className="p-2.5 border-b border-[#1b2333] bg-[#0c1018] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold tracking-wider text-[10px] flex items-center gap-1 rounded-sm">
            <span className="text-[8px]">▲</span> FNC
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-bold tracking-wider text-[10px]">
            SPOTLIGHT TELEMETRY
          </span>
          <span className="px-1.5 py-0.2 bg-[#141b27] text-amber-400 font-mono text-[9px] rounded border border-[#222d3e]">
            R-{round.toString().padStart(2, '0')}
          </span>
        </div>

        {isGM && (
          <div className="flex items-center space-x-1">
            <button
              onClick={onResetEncounter}
              className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
              title="Reset Encounter Round"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onNextRound}
              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-sm text-[9px] flex items-center space-x-1 transition shadow-[0_0_8px_rgba(245,158,11,0.4)]"
            >
              <span>NEXT ROUND</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* CLOCKS & DANGER TRACKERS */}
      {clocks.length > 0 && (
        <div className="px-2.5 py-1.5 bg-[#090c13] border-b border-[#1b2332] space-y-1">
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>ACTIVE CLOCKS & TENSION</span>
            </span>
            <span className="text-slate-500">{clocks.length} TRACKERS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {clocks.map((c) => (
              <div
                key={c.id}
                className="bg-[#0f141f] border border-[#222c3d] p-1.5 rounded-sm flex items-center justify-between"
              >
                <div className="min-w-0 pr-1">
                  <div className="text-[10px] font-bold text-slate-200 truncate">{c.name}</div>
                  <div className="flex items-center space-x-0.5 mt-0.5">
                    {Array.from({ length: c.segments }).map((_, i) => (
                      <span
                        key={i}
                        className="w-2.5 h-1.5 rounded-xs"
                        style={{
                          backgroundColor: i < c.progress ? c.color : 'rgba(51, 65, 85, 0.5)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <span className="text-[9px] font-mono font-bold text-slate-400">
                    {c.progress}/{c.segments}
                  </span>
                  {isGM && onUpdateClocks && (
                    <div className="flex space-x-0.5">
                      <button
                        onClick={() => {
                          const updated = clocks.map((clk) =>
                            clk.id === c.id
                              ? { ...clk, progress: Math.max(0, clk.progress - 1) }
                              : clk
                          );
                          onUpdateClocks(updated);
                        }}
                        disabled={c.progress <= 0}
                        className="w-3.5 h-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-xs flex items-center justify-center text-[9px]"
                      >
                        -
                      </button>
                      <button
                        onClick={() => {
                          const updated = clocks.map((clk) =>
                            clk.id === c.id
                              ? { ...clk, progress: Math.min(clk.segments, clk.progress + 1) }
                              : clk
                          );
                          onUpdateClocks(updated);
                        }}
                        disabled={c.progress >= c.segments}
                        className="w-3.5 h-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-xs flex items-center justify-center text-[9px]"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMBATANTS TABLE / ROSTER (Styled after reference image ▲ FNC table) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[8px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#1a2230]">
          <span className="col-span-2">ID</span>
          <span className="col-span-5">COMBATANT</span>
          <span className="col-span-3 text-center">HP / ARM</span>
          <span className="col-span-2 text-right">ACTION</span>
        </div>

        {tokenList.length === 0 && (
          <div className="text-center py-6 text-slate-600 text-[10px]">
            [ NO ACTIVE TARGETS DETECTED ON GRID ]
          </div>
        )}

        {tokenList.map((t, idx) => {
          const trackId = `TRK-${String(idx + 1).padStart(2, '0')}`;
          const isHoldingSpotlight = t.id === activeTokenId;
          const hasActed = actedThisRound.includes(t.id);
          const isOverwhelmed = t.stress >= t.maxStress;

          return (
            <div
              key={t.id}
              onClick={() => onSelectToken(t)}
              className={`rounded-sm border transition cursor-pointer overflow-hidden ${
                isHoldingSpotlight
                  ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500'
                  : hasActed
                  ? 'border-[#1b2332] bg-[#090c12] opacity-60'
                  : 'border-[#1e2738] bg-[#0c1017] hover:border-[#2d3a54]'
              }`}
            >
              {/* Main Tabular Row (Matching reference screenshot highlight like TRK-02) */}
              <div
                className={`grid grid-cols-12 gap-1 items-center px-2 py-1.5 transition ${
                  isHoldingSpotlight
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-300'
                }`}
              >
                {/* ID Column */}
                <div className="col-span-2 flex items-center space-x-1">
                  <span
                    className={`text-[9px] font-black ${
                      isHoldingSpotlight ? 'text-slate-950' : 'text-amber-500'
                    }`}
                  >
                    {trackId}
                  </span>
                </div>

                {/* Actor Name & Path */}
                <div className="col-span-5 truncate flex items-center space-x-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block border border-black/30 flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-[10px] font-bold truncate">{t.name}</span>
                </div>

                {/* HP / Armor summary */}
                <div className="col-span-3 text-center text-[9px] font-mono">
                  <span className={isHoldingSpotlight ? 'text-slate-950 font-bold' : 'text-emerald-400'}>
                    {t.hp}/{t.maxHp}
                  </span>
                  <span className="mx-0.5 opacity-50">|</span>
                  <span className={isHoldingSpotlight ? 'text-slate-950 font-bold' : 'text-cyan-400'}>
                    {t.armorSlots}A
                  </span>
                </div>

                {/* Spotlight Passing Button */}
                <div className="col-span-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPassSpotlight(t.id);
                    }}
                    className={`px-1.5 py-0.5 rounded-xs text-[8px] font-black uppercase transition ${
                      isHoldingSpotlight
                        ? 'bg-slate-950 text-amber-400 border border-slate-900'
                        : hasActed
                        ? 'bg-[#121722] text-slate-500'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                    }`}
                  >
                    {isHoldingSpotlight ? 'ACTING' : hasActed ? 'DONE' : 'TAKE'}
                  </button>
                </div>
              </div>

              {/* Expanded Combatant Technical Readout Controls */}
              <div className="p-2 bg-[#090c13] border-t border-[#1a2230] text-[9px] space-y-1.5">
                {/* Stats Grid: HP, Armor, Thresholds */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* HP & Threshold Controls */}
                  <div className="bg-[#0e131d] p-1.5 rounded-xs border border-[#1d2636]">
                    <div className="flex justify-between items-center text-slate-400 mb-1">
                      <span className="flex items-center space-x-1 text-emerald-400 font-bold">
                        <Heart className="w-2.5 h-2.5" />
                        <span>HP: {t.hp}/{t.maxHp}</span>
                      </span>
                      <span className="text-[8px] text-amber-400">
                        MAJ:{t.majorThreshold} SEV:{t.severeThreshold}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-slate-500">EVASION: {t.evasion}</span>
                      <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleQuickHp(t.id, -1)}
                          className="w-4 h-4 bg-[#141b27] hover:bg-rose-950 text-slate-300 rounded-xs flex items-center justify-center font-bold"
                          title="Inflict 1 Damage"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleQuickHp(t.id, 1)}
                          className="w-4 h-4 bg-[#141b27] hover:bg-emerald-950 text-slate-300 rounded-xs flex items-center justify-center font-bold"
                          title="Restore 1 HP"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Armor Slots & Stress Controls */}
                  <div className="bg-[#0e131d] p-1.5 rounded-xs border border-[#1d2636]">
                    <div className="flex justify-between items-center text-slate-400 mb-1">
                      <span className="flex items-center space-x-1 text-cyan-400 font-bold">
                        <Shield className="w-2.5 h-2.5" />
                        <span>ARMOR: {t.armorSlots}/{t.maxArmorSlots}</span>
                      </span>
                      <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleQuickArmorSlot(t.id, -1)}
                          className="w-3.5 h-3.5 bg-[#141b27] hover:bg-cyan-950 text-slate-300 rounded-xs flex items-center justify-center font-bold text-[8px]"
                          title="Spend Armor Slot (reduce hit 1 tier)"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleQuickArmorSlot(t.id, 1)}
                          className="w-3.5 h-3.5 bg-[#141b27] hover:bg-cyan-950 text-slate-300 rounded-xs flex items-center justify-center font-bold text-[8px]"
                          title="Restore Armor Slot"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-0.5 border-t border-[#18202e]">
                      <span className={`text-[8px] font-bold ${isOverwhelmed ? 'text-rose-400' : 'text-purple-400'}`}>
                        STRESS: {t.stress}/{t.maxStress} {isOverwhelmed && '!'}
                      </span>
                      <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleQuickStress(t.id, -1)}
                          className="w-3.5 h-3.5 bg-[#141b27] hover:bg-purple-950 text-slate-300 rounded-xs flex items-center justify-center font-bold text-[8px]"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleQuickStress(t.id, 1)}
                          className="w-3.5 h-3.5 bg-[#141b27] hover:bg-purple-950 text-slate-300 rounded-xs flex items-center justify-center font-bold text-[8px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conditions Tags */}
                <div className="flex flex-wrap gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  {COMMON_CONDITIONS.map((cond) => {
                    const active = t.conditions.includes(cond);
                    return (
                      <button
                        key={cond}
                        onClick={() => toggleCondition(t.id, cond)}
                        className={`px-1 py-0.2 rounded-xs text-[8px] font-bold transition ${
                          active
                            ? 'bg-rose-950 border border-rose-500 text-rose-300 shadow-[0_0_4px_rgba(244,63,94,0.4)]'
                            : 'bg-[#101520] border border-[#1b2332] text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {cond}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTTOM TELEMETRY BAR: KEEPER FEAR (0-12) & CREW HEAT (0-10) */}
      <div className="p-2 border-t border-[#1b2333] bg-[#0a0d14] space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
          {/* Keeper Fear */}
          <div className="bg-[#0e121a] p-1.5 rounded-xs border border-rose-900/40">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-rose-400 font-bold flex items-center space-x-1">
                <Flame className="w-2.5 h-2.5 text-rose-500" />
                <span>KEEPER FEAR:</span>
              </span>
              <span className="font-mono font-bold text-rose-300">{keeperFear} / 12</span>
            </div>
            {/* Fear Pips */}
            <div className="flex space-x-0.5 mt-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-xs transition ${
                    i < keeperFear ? 'bg-rose-500 shadow-[0_0_4px_#f43f5e]' : 'bg-[#1a2230]'
                  }`}
                />
              ))}
            </div>
            {isGM && (
              <div className="flex items-center space-x-1 mt-1">
                <button
                  onClick={() => onUpdateKeeperFear(Math.max(0, keeperFear - 1))}
                  className="flex-1 py-0.2 rounded-xs bg-[#141a24] hover:bg-slate-700 text-rose-300 font-bold"
                >
                  -
                </button>
                <button
                  onClick={() => onUpdateKeeperFear(Math.min(12, keeperFear + 1))}
                  className="flex-1 py-0.2 rounded-xs bg-[#141a24] hover:bg-slate-700 text-rose-300 font-bold"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Crew Criminal Heat */}
          <div className="bg-[#0e121a] p-1.5 rounded-xs border border-amber-900/40">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-amber-400 font-bold flex items-center space-x-1">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                <span>CREW HEAT:</span>
              </span>
              <span className="font-mono font-bold text-amber-300">{crewHeat} / 10</span>
            </div>
            {/* Heat Pips */}
            <div className="flex space-x-0.5 mt-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-xs transition ${
                    i < crewHeat ? 'bg-amber-500 shadow-[0_0_4px_#f59e0b]' : 'bg-[#1a2230]'
                  }`}
                />
              ))}
            </div>
            <div className="text-[7px] text-slate-500 truncate mt-0.5">
              {getHeatLabel(crewHeat)}
            </div>
            {isGM && (
              <div className="flex items-center space-x-1 mt-0.5">
                <button
                  onClick={() => onUpdateCrewHeat(Math.max(0, crewHeat - 1))}
                  className="flex-1 py-0.2 rounded-xs bg-[#141a24] hover:bg-slate-700 text-amber-300 font-bold"
                >
                  -
                </button>
                <button
                  onClick={() => onUpdateCrewHeat(Math.min(10, crewHeat + 1))}
                  className="flex-1 py-0.2 rounded-xs bg-[#141a24] hover:bg-slate-700 text-amber-300 font-bold"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
