import React from 'react';
import type { Token, UserRole, ConditionType } from '../../types/vtt';
import { Flame, Shield, Heart, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-slate-900/60 select-none text-xs">
      {/* Top Banner: Keeper Fear & Crew Heat Tracker */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/90 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-100 flex items-center space-x-1.5">
              <span>Spotlight & Combat</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800/40">
                Round {round}
              </span>
            </span>
          </div>

          {isGM && (
            <div className="flex items-center space-x-1">
              <button
                onClick={onResetEncounter}
                className="p-1 text-slate-400 hover:text-rose-400 rounded transition"
                title="Reset Encounter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onNextRound}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-[11px] flex items-center space-x-1 shadow"
              >
                <span>End Round</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Global Resource Gauges: Keeper Fear (0-12) & Crew Heat (0-10) */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          {/* Keeper Fear */}
          <div className="bg-slate-900/90 p-2 rounded-lg border border-rose-900/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-rose-400 font-bold flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Keeper Fear:</span>
              </span>
              <span className="font-mono font-bold text-rose-300">
                {keeperFear} / 12
              </span>
            </div>
            {isGM && (
              <div className="flex items-center space-x-1 mt-1">
                <button
                  onClick={() => onUpdateKeeperFear(Math.max(0, keeperFear - 1))}
                  className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold"
                >
                  -
                </button>
                <button
                  onClick={() => onUpdateKeeperFear(Math.min(12, keeperFear + 1))}
                  className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Crew Criminal Heat */}
          <div className="bg-slate-900/90 p-2 rounded-lg border border-amber-900/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-amber-400 font-bold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Heat:</span>
              </span>
              <span className="font-mono font-bold text-amber-300">
                {crewHeat}/10
              </span>
            </div>
            <div className="text-[9px] text-slate-400 truncate">
              {getHeatLabel(crewHeat)}
            </div>
            {isGM && (
              <div className="flex items-center space-x-1 mt-1">
                <button
                  onClick={() => onUpdateCrewHeat(Math.max(0, crewHeat - 1))}
                  className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold"
                >
                  -
                </button>
                <button
                  onClick={() => onUpdateCrewHeat(Math.min(10, crewHeat + 1))}
                  className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Combatant / Spotlight Roster */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tokenList.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No combatants on the field.
          </div>
        )}

        {tokenList.map((t) => {
          const isHoldingSpotlight = t.id === activeTokenId;
          const hasActed = actedThisRound.includes(t.id);
          const hpPct = Math.max(0, Math.min(1, t.hp / (t.maxHp || 1)));
          const isOverwhelmed = t.stress >= t.maxStress;

          return (
            <div
              key={t.id}
              onClick={() => onSelectToken(t)}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                isHoldingSpotlight
                  ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/60'
                  : hasActed
                  ? 'border-slate-800/60 bg-slate-950/40 opacity-70'
                  : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
              }`}
            >
              {/* Header: Name, Spotlight button, Path & Badges */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block border border-white/40 flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="font-semibold text-slate-100 truncate max-w-[130px]">
                    {t.name}
                  </span>
                  {t.isHidden && (
                    <span className="px-1 py-0.2 bg-red-950 text-red-400 text-[9px] rounded">
                      Hidden
                    </span>
                  )}
                  {t.isNpc && (
                    <span className="px-1 py-0.2 bg-slate-800 text-slate-400 text-[9px] rounded">
                      NPC
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Ev: {t.evasion}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPassSpotlight(t.id);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                      isHoldingSpotlight
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : hasActed
                        ? 'bg-slate-800 text-slate-500 hover:text-slate-300'
                        : 'bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800/40'
                    }`}
                  >
                    {isHoldingSpotlight ? 'Spotlight' : hasActed ? 'Acted' : 'Give Spotlight'}
                  </button>
                </div>
              </div>

              {/* Defensive Statistics: HP, Armor Slots, Thresholds */}
              <div className="grid grid-cols-2 gap-2 text-[10px] mb-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/70">
                {/* HP & Thresholds */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-emerald-400 font-medium flex items-center space-x-1">
                      <Heart className="w-3 h-3 text-emerald-400" />
                      <span>HP: {t.hp}/{t.maxHp}</span>
                    </span>
                    <span className="text-slate-400 font-mono">
                      {t.majorThreshold}/{t.severeThreshold}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${hpPct * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-slate-500">Major / Severe</span>
                    <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleQuickHp(t.id, -1)}
                        className="w-4 h-4 bg-slate-800 hover:bg-rose-950 text-slate-300 rounded flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleQuickHp(t.id, 1)}
                        className="w-4 h-4 bg-slate-800 hover:bg-emerald-950 text-slate-300 rounded flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Armor Slots & Stress */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-cyan-400 font-medium flex items-center space-x-1">
                      <Shield className="w-3 h-3 text-cyan-400" />
                      <span>Armor: {t.armorSlots}/{t.maxArmorSlots}</span>
                    </span>
                    <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleQuickArmorSlot(t.id, -1)}
                        className="w-4 h-4 bg-slate-800 hover:bg-cyan-950 text-slate-300 rounded flex items-center justify-center font-bold"
                        title="Spend Armor Slot (blunt hit 1 tier)"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleQuickArmorSlot(t.id, 1)}
                        className="w-4 h-4 bg-slate-800 hover:bg-cyan-950 text-slate-300 rounded flex items-center justify-center font-bold"
                        title="Restore Armor Slot"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800">
                    <span className={`font-medium ${isOverwhelmed ? 'text-rose-400 font-bold' : 'text-purple-400'}`}>
                      Stress: {t.stress}/{t.maxStress} {isOverwhelmed && '(OVERWHELMED)'}
                    </span>
                    <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleQuickStress(t.id, -1)}
                        className="w-4 h-4 bg-slate-800 hover:bg-purple-950 text-slate-300 rounded flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleQuickStress(t.id, 1)}
                        className="w-4 h-4 bg-slate-800 hover:bg-purple-950 text-slate-300 rounded flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditions tag pills */}
              <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                {COMMON_CONDITIONS.map((cond) => {
                  const active = t.conditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      onClick={() => toggleCondition(t.id, cond)}
                      className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition ${
                        active
                          ? 'bg-rose-950/80 border border-rose-600 text-rose-300 font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
