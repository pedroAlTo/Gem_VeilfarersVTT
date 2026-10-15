import React from 'react';
import type { Token, UserRole } from '../../types/vtt';
import { Swords, ChevronRight, RotateCcw, Heart, Dices } from 'lucide-react';
import { rollDice } from '../../services/dice';

interface InitiativeTrackerProps {
  tokens: Record<string, Token>;
  activeTokenId?: string;
  round: number;
  userRole: UserRole;
  onUpdateTokens: (tokens: Record<string, Token>) => void;
  onNextTurn: () => void;
  onResetInitiative: () => void;
  onSelectToken: (token: Token) => void;
}

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  tokens,
  activeTokenId,
  round,
  userRole,
  onUpdateTokens,
  onNextTurn,
  onResetInitiative,
  onSelectToken,
}) => {
  const isGM = userRole === 'gm';

  // Sort tokens by initiative descending
  const sortedTokens = Object.values(tokens)
    .filter((t) => !t.isHidden || isGM)
    .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));

  const handleQuickHp = (tokenId: string, delta: number) => {
    const token = tokens[tokenId];
    if (!token) return;
    const newHp = Math.max(0, Math.min(token.maxHp, token.hp + delta));
    onUpdateTokens({
      ...tokens,
      [tokenId]: { ...token, hp: newHp },
    });
  };

  const handleRollAllInitiative = () => {
    const updated = { ...tokens };
    Object.keys(updated).forEach((id) => {
      const res = rollDice('1d20');
      updated[id] = {
        ...updated[id],
        initiative: res.total,
      };
    });
    onUpdateTokens(updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 select-none text-xs">
      {/* Top Banner: Round & Controls */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-rose-950/60 text-rose-400 rounded-lg border border-rose-800/40">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-100 flex items-center space-x-1.5">
              <span>Combat Encounter</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 font-mono text-[10px]">
                Round {round}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {sortedTokens.length} combatants active
            </div>
          </div>
        </div>

        {isGM && (
          <div className="flex items-center space-x-1">
            <button
              onClick={handleRollAllInitiative}
              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
              title="Roll Initiative for All"
            >
              <Dices className="w-4 h-4" />
            </button>
            <button
              onClick={onResetInitiative}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="Reset Round & Initiative"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onNextTurn}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-1"
              title="Next Combatant Turn"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Combatant List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedTokens.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No combatants on the field yet.
          </div>
        )}

        {sortedTokens.map((t) => {
          const isActive = t.id === activeTokenId;
          const hpPct = Math.max(0, Math.min(1, t.hp / (t.maxHp || 1)));

          return (
            <div
              key={t.id}
              onClick={() => onSelectToken(t)}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                isActive
                  ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                  : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block border border-white/40 flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="font-semibold text-slate-100 truncate max-w-[120px]">
                    {t.name}
                  </span>
                  {t.isHidden && (
                    <span className="px-1 py-0.2 bg-red-950 text-red-400 text-[9px] rounded">
                      Hidden
                    </span>
                  )}
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold tracking-wide uppercase">
                      Turn
                    </span>
                  )}
                </div>

                {/* Initiative score */}
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] text-slate-400 font-medium">Init:</span>
                  <input
                    type="number"
                    value={t.initiative ?? 0}
                    disabled={!isGM}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      onUpdateTokens({
                        ...tokens,
                        [t.id]: { ...t, initiative: val },
                      });
                    }}
                    className="w-10 bg-slate-900 border border-slate-700 rounded px-1 text-center font-mono text-slate-200"
                  />
                </div>
              </div>

              {/* HP Bar & Quick Modifiers */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5 font-mono">
                    <span className="flex items-center space-x-1">
                      <Heart className="w-3 h-3 text-emerald-400 inline" />
                      <span>
                        {t.hp} / {t.maxHp}
                      </span>
                    </span>
                    <span>{Math.round(hpPct * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${hpPct * 100}%` }}
                    />
                  </div>
                </div>

                {/* Quick - / + buttons */}
                <div
                  className="flex items-center space-x-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleQuickHp(t.id, -1)}
                    className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-300 flex items-center justify-center font-bold"
                    title="-1 HP"
                  >
                    -
                  </button>
                  <button
                    onClick={() => handleQuickHp(t.id, 1)}
                    className="w-5 h-5 rounded bg-slate-800 hover:bg-emerald-900/60 hover:text-emerald-300 text-slate-300 flex items-center justify-center font-bold"
                    title="+1 HP"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Conditions tag pills */}
              {t.conditions && t.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {t.conditions.map((c) => (
                    <span
                      key={c}
                      className="px-1.5 py-0.2 rounded bg-slate-800/80 text-purple-300 text-[9px] border border-purple-800/40"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
