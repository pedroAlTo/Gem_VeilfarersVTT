import React, { useState } from 'react';
import type { CharacterSheet, DualityRollResult, TraitName } from '../../types/vtt';
import { rollDuality } from '../../services/dice';
import { DOMAIN_POWERS } from '../../data/powers';
import { SLEEPING_MOVES } from '../../data/sleepingMoves';
import { PREFORGED_ARCHETYPES } from '../../data/archetypes';
import { Shield, Sparkles, Heart, Dices, Award, Zap, Users, Plus, Layers, User } from 'lucide-react';

interface CharacterSheetPanelProps {
  onRoll: (result: DualityRollResult) => void;
  characterName: string;
}

export const CharacterSheetPanel: React.FC<CharacterSheetPanelProps> = ({
  onRoll,
  characterName,
}) => {
  const [sheet, setSheet] = useState<CharacterSheet>(() => {
    const defaultMaren = PREFORGED_ARCHETYPES[0];
    return { ...defaultMaren, name: characterName || defaultMaren.name };
  });

  const [activeSubTab, setActiveSubTab] = useState<'sheet' | 'powers' | 'archetypes'>('sheet');

  const handleRollTrait = (traitKey: TraitName, subtrait?: string) => {
    const val = sheet.traits[traitKey];
    const traitLabel = subtrait ? `${traitKey.toUpperCase()} (${subtrait})` : traitKey.toUpperCase();

    const res = rollDuality({
      characterName: sheet.name,
      path: sheet.path,
      traitName: traitLabel,
      traitModifier: val,
      dc: 15,
      label: `${sheet.name} rolls ${traitLabel} Check`,
    });

    onRoll(res);
  };

  const handleRollExperience = (expName: string, bonus: number) => {
    if (sheet.path === 'awakened' && sheet.hope < 1) {
      alert('You need at least 1 Hope to invoke an Experience as Awakened!');
      return;
    }

    if (sheet.path === 'awakened') {
      setSheet((s) => ({ ...s, hope: Math.max(0, s.hope - 1) }));
    }

    const res = rollDuality({
      characterName: sheet.name,
      path: sheet.path,
      traitName: 'EXPERIENCE',
      traitModifier: 0,
      experienceName: expName,
      experienceBonus: bonus,
      dc: 15,
      label: `${sheet.name} invokes Experience: "${expName}" (+${bonus})`,
    });

    onRoll(res);
  };

  const handleCastPower = (powerId: string) => {
    const power = DOMAIN_POWERS.find((p) => p.id === powerId);
    if (!power) return;

    if (sheet.path === 'awakened') {
      if (sheet.hope < power.hopeCost) {
        alert(`Need ${power.hopeCost} Hope to cast ${power.name}! Current Hope: ${sheet.hope}`);
        return;
      }
      setSheet((s) => ({
        ...s,
        hope: Math.max(0, s.hope - power.hopeCost),
        stress: Math.min(s.maxStress, s.stress + power.stressCost),
      }));
    }

    const res = rollDuality({
      characterName: sheet.name,
      path: sheet.path,
      traitName: power.trait?.toUpperCase() || 'SPELLCAST',
      traitModifier: power.trait ? (sheet.traits[power.trait.toLowerCase() as TraitName] ?? 0) : 0,
      dc: power.dc || 15,
      label: `${sheet.name} casts ${power.name} (${power.domain} Level ${power.level} ${power.type})`,
    });

    onRoll(res);
  };

  const handleTriggerSleepingMove = (moveId: string) => {
    const move = SLEEPING_MOVES.find((m) => m.id === moveId);
    if (!move) return;

    if (move.effortCost && sheet.effort < move.effortCost) {
      alert(`Need ${move.effortCost} Effort to use ${move.name}! Current Effort: ${sheet.effort}`);
      return;
    }

    if (move.resolveCostDice && sheet.resolve < move.resolveCostDice) {
      alert(`Need ${move.resolveCostDice} Resolve Die to use ${move.name}! Current Resolve: ${sheet.resolve}`);
      return;
    }

    let rolledBonus = 0;
    if (move.isRoll && move.resolveCostDice) {
      for (let i = 0; i < move.resolveCostDice; i++) {
        rolledBonus += Math.floor(Math.random() * 4) + 1; // 1d4 per resolve
      }
    }

    setSheet((s) => ({
      ...s,
      effort: Math.max(0, s.effort - (move.effortCost || 0)),
      resolve: Math.max(0, s.resolve - (move.resolveCostDice || 0)),
    }));

    const res = rollDuality({
      characterName: sheet.name,
      path: 'sleeping',
      traitName: move.name.toUpperCase(),
      traitModifier: rolledBonus,
      dc: 15,
      label: `${sheet.name} executes Move: ${move.name}${rolledBonus > 0 ? ` (rolled +${rolledBonus})` : ''}`,
    });

    onRoll(res);
  };

  const handleSelectArchetype = (arch: CharacterSheet) => {
    setSheet(arch);
    setActiveSubTab('sheet');
  };

  const isOverwhelmed = sheet.stress >= sheet.maxStress;
  const loadoutLimit = sheet.level >= 8 ? 7 : sheet.level >= 5 ? 6 : 5;

  return (
    <div className="flex flex-col h-full bg-[#080a10] border border-[#1b2333] overflow-y-auto p-2.5 space-y-2.5 text-xs select-none font-mono relative">
      {/* Corner Brackets */}
      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500 z-10" />

      {/* Subtab Navigation */}
      <div className="flex bg-[#0b0e14] p-0.5 rounded-xs border border-[#1d273a] text-[10px]">
        <button
          onClick={() => setActiveSubTab('sheet')}
          className={`flex-1 py-1 rounded-xs font-bold transition flex items-center justify-center space-x-1 ${
            activeSubTab === 'sheet'
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3 h-3" />
          <span>HERO</span>
        </button>
        <button
          onClick={() => setActiveSubTab('powers')}
          className={`flex-1 py-1 rounded-xs font-bold transition flex items-center justify-center space-x-1 ${
            activeSubTab === 'powers'
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>{sheet.path === 'awakened' ? 'POWERS' : 'MOVES'}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('archetypes')}
          className={`flex-1 py-1 rounded-xs font-bold transition flex items-center justify-center space-x-1 ${
            activeSubTab === 'archetypes'
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>PREFORGED</span>
        </button>
      </div>

      {/* SUBTAB 1: CHARACTER SHEET */}
      {activeSubTab === 'sheet' && (
        <>
          {/* Path Toggle: Awakened vs Sleeping */}
          <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1.5">
              Path:
            </span>
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setSheet({ ...sheet, path: 'awakened' })}
                className={`px-3 py-1 rounded font-bold text-[11px] transition ${
                  sheet.path === 'awakened'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Awakened (Hope)
              </button>
              <button
                onClick={() => setSheet({ ...sheet, path: 'sleeping' })}
                className={`px-3 py-1 rounded font-bold text-[11px] transition ${
                  sheet.path === 'sleeping'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sleeping (Effort & Resolve)
              </button>
            </div>
          </div>

          {/* Identity Banner */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={sheet.name}
                onChange={(e) => setSheet({ ...sheet, name: e.target.value })}
                className="bg-transparent font-black text-sm text-slate-100 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none"
              />
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/50 text-[10px]">
                Lvl {sheet.level} • Prof {sheet.proficiency}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
              <span className="text-cyan-300 font-semibold">{sheet.ancestry}</span>
              <span>•</span>
              <span className="text-amber-300 font-semibold">{sheet.class} ({sheet.subclass})</span>
              <span>•</span>
              <span className="text-emerald-300">{sheet.community}</span>
              <span>•</span>
              <span className="text-indigo-300">{sheet.affiliation} (Standing +{sheet.affiliationStanding})</span>
            </div>
          </div>

          {/* Path Resource Engines */}
          {sheet.path === 'awakened' ? (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-purple-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-purple-300 font-bold flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Hope Pool (0 to 6)</span>
                </span>
                <div className="flex items-center space-x-1 font-mono">
                  <button
                    onClick={() => setSheet((s) => ({ ...s, hope: Math.max(0, s.hope - 1) }))}
                    className="w-5 h-5 rounded bg-slate-900 border border-slate-700 text-purple-300 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-purple-200">
                    {sheet.hope} / 6
                  </span>
                  <button
                    onClick={() => setSheet((s) => ({ ...s, hope: Math.min(6, s.hope + 1) }))}
                    className="w-5 h-5 rounded bg-slate-900 border border-slate-700 text-purple-300 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-purple-300/70">
                Spends on Domain Powers and Experience invocations.
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-indigo-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-indigo-300 font-bold block">Effort Pool & Track</span>
                  <span className="text-[9px] text-slate-400">2 segments per Effort.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <button
                      onClick={() =>
                        setSheet((s) => {
                          const nextTrack = (s.effortTrack + 1) % 3;
                          const nextEffort = nextTrack === 0 ? Math.min(6, s.effort + 1) : s.effort;
                          return { ...s, effortTrack: nextTrack, effort: nextEffort };
                        })
                      }
                      className={`w-4 h-4 rounded border ${
                        sheet.effortTrack >= 1 ? 'bg-indigo-500 border-indigo-300' : 'bg-slate-900 border-slate-700'
                      }`}
                    />
                    <button
                      onClick={() =>
                        setSheet((s) => {
                          const nextTrack = (s.effortTrack + 1) % 3;
                          const nextEffort = nextTrack === 0 ? Math.min(6, s.effort + 1) : s.effort;
                          return { ...s, effortTrack: nextTrack, effort: nextEffort };
                        })
                      }
                      className={`w-4 h-4 rounded border ${
                        sheet.effortTrack >= 2 ? 'bg-indigo-500 border-indigo-300' : 'bg-slate-900 border-slate-700'
                      }`}
                    />
                  </div>
                  <span className="font-mono font-bold text-sm text-indigo-200">{sheet.effort}/6</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-amber-300 font-bold">Resolve (d4s): {sheet.resolve}/{sheet.maxResolve}</span>
                <span className="text-slate-400 text-[10px]">Honed Edge: +{sheet.honedEdge} dmg</span>
              </div>
              <div className="pt-1 text-[10px] text-slate-400">Anchor: {sheet.recoveryAnchor}</div>
            </div>
          )}

          {/* Defenses: HP, Thresholds, Armor Slots, Stress */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px]">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <Heart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HP: {sheet.hp} / {sheet.maxHp}</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>Major: <span className="text-slate-200 font-bold">{sheet.majorThreshold}</span> (2 HP)</div>
                <div>Severe: <span className="text-slate-200 font-bold">{sheet.severeThreshold}</span> (3 HP)</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-cyan-400 font-bold flex items-center space-x-1">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Armor: {sheet.armorSlots}/{sheet.maxArmorSlots}</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>Evasion DC: <span className="text-slate-200 font-bold">{sheet.evasion}</span></div>
                <div className={isOverwhelmed ? 'text-rose-400 font-bold' : ''}>
                  Stress: <span className="text-slate-200 font-bold">{sheet.stress}/{sheet.maxStress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Six Canonical Traits (+2, +1, +1, +0, +0, -1) */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center space-x-1">
              <Dices className="w-3.5 h-3.5 text-indigo-400" />
              <span>Six Core Traits (Click to Roll)</span>
            </label>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(Object.keys(sheet.traits) as TraitName[]).map((tKey) => {
                const val = sheet.traits[tKey];
                return (
                  <button
                    key={tKey}
                    onClick={() => handleRollTrait(tKey)}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/30 rounded-xl transition flex flex-col items-center group"
                    title={`Roll ${tKey.toUpperCase()} (2d12${val >= 0 ? '+' : ''}${val})`}
                  >
                    <span className="text-[10px] text-slate-400 uppercase font-semibold group-hover:text-indigo-300">
                      {tKey}
                    </span>
                    <span className="text-sm font-bold font-mono text-slate-100 group-hover:text-indigo-400">
                      {val >= 0 ? `+${val}` : val}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1.5 mt-1.5">
              <button
                onClick={() => handleRollTrait('finesse', 'Pilot/Navigate')}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-cyan-500 text-[10px] text-cyan-300 transition"
              >
                Finesse (Pilot/Navigate)
              </button>
              <button
                onClick={() => handleRollTrait('knowledge', 'Tech')}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-emerald-500 text-[10px] text-emerald-300 transition"
              >
                Knowledge (Tech)
              </button>
              <button
                onClick={() => handleRollTrait('knowledge', 'Medicine')}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-emerald-500 text-[10px] text-emerald-300 transition"
              >
                Knowledge (Medicine)
              </button>
            </div>
          </div>

          {/* Formative Experiences */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center space-x-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Formative Experiences (Click to Invoke)</span>
            </label>
            <div className="space-y-1.5">
              {sheet.experiences.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => handleRollExperience(exp.name, exp.bonus)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/30 text-left transition"
                >
                  <span className="font-medium text-slate-200 text-[11px] pr-2">
                    &ldquo;{exp.name}&rdquo;
                  </span>
                  <span className="font-mono text-indigo-400 font-bold flex-shrink-0">
                    +{exp.bonus}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* SUBTAB 2: DOMAIN POWERS & SLEEPING MOVES */}
      {activeSubTab === 'powers' && (
        <div className="space-y-3">
          {sheet.path === 'awakened' ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-purple-300 text-xs block">Active Loadout Cards</span>
                  <span className="text-[10px] text-slate-400">
                    {sheet.loadout.length} / {loadoutLimit} prepared
                  </span>
                </div>
              </div>

              {/* Loadout Cards List */}
              <div className="space-y-2">
                {sheet.loadout.map((powerId) => {
                  const power = DOMAIN_POWERS.find((p) => p.id === powerId);
                  if (!power) return null;

                  return (
                    <div
                      key={power.id}
                      className="p-3 bg-slate-950 border border-purple-900/50 rounded-xl space-y-2 shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                            <span className="text-purple-300">{power.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-bold text-[9px] border border-purple-800/40">
                              {power.domain} Lvl {power.level} {power.type}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Cost: {power.hopeCost > 0 ? `${power.hopeCost} Hope` : 'Free'}
                            {power.stressCost > 0 ? ` • ${power.stressCost} Stress` : ''}
                            {power.dc ? ` • DC ${power.dc} (${power.trait})` : ''}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCastPower(power.id)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow flex items-center space-x-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Cast</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-normal">{power.effect}</p>
                    </div>
                  );
                })}
              </div>

              {/* Browse Vault */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">
                  Vault (Known Powers)
                </span>
                <div className="space-y-1.5">
                  {DOMAIN_POWERS.filter((p) => !sheet.loadout.includes(p.id) && p.level <= sheet.level + 1).slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-medium text-slate-200">{p.name}</span>
                        <span className="text-slate-500 text-[10px] ml-1.5">({p.domain} {p.level})</span>
                      </div>
                      <button
                        onClick={() => {
                          if (sheet.loadout.length >= loadoutLimit) {
                            alert(`Loadout limit reached (${loadoutLimit} cards)!`);
                            return;
                          }
                          setSheet((s) => ({ ...s, loadout: [...s.loadout, p.id] }));
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-purple-900 text-slate-300 hover:text-white"
                        title="Equip to Loadout"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Sleeping Moves & Common Efforts */
            <div className="space-y-3">
              <div>
                <span className="font-bold text-indigo-300 text-xs block">Common Efforts (Cost Effort)</span>
                <span className="text-[10px] text-slate-400">
                  Current Effort: {sheet.effort} / 6
                </span>
              </div>

              <div className="space-y-1.5">
                {SLEEPING_MOVES.filter((m) => m.category === 'Common Effort').map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between space-x-2"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                        <span>{m.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-bold text-[9px]">
                          {m.effortCost} Effort
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{m.description}</p>
                    </div>

                    <button
                      onClick={() => handleTriggerSleepingMove(m.id)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] shadow flex items-center space-x-1 flex-shrink-0"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Use</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="font-bold text-amber-300 text-xs block mb-1">
                  Resolve Moves (Cost d4s)
                </span>
                <div className="space-y-1.5">
                  {SLEEPING_MOVES.filter((m) => m.category !== 'Common Effort').map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between space-x-2"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                          <span>{m.name}</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-bold text-[9px]">
                            {m.resolveCostDice} d4 Resolve
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{m.description}</p>
                      </div>

                      <button
                        onClick={() => handleTriggerSleepingMove(m.id)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-[10px] shadow flex items-center space-x-1 flex-shrink-0"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Spend</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: PRE-FORGED ARCHETYPES SELECTOR */}
      {activeSubTab === 'archetypes' && (
        <div className="space-y-2.5">
          <div>
            <span className="font-bold text-amber-300 text-xs block">Choose Pre-Forged Legend</span>
            <span className="text-[10px] text-slate-400">
              Instantly switch character sheet to canonical starter characters from Appendix A!
            </span>
          </div>

          <div className="space-y-2">
            {PREFORGED_ARCHETYPES.map((arch) => (
              <div
                key={arch.id}
                onClick={() => handleSelectArchetype(arch)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  sheet.id === arch.id
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-md ring-1 ring-indigo-500/50'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-100 text-sm">{arch.name}</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    arch.path === 'awakened' ? 'bg-purple-950 text-purple-300 border border-purple-800/40' : 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                  }`}>
                    {arch.path}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {arch.ancestry} • {arch.class} ({arch.subclass}) • {arch.community}
                </div>
                <div className="text-[10px] text-slate-500 italic mt-0.5">
                  &ldquo;{arch.experiences[0]?.name}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
