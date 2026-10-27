import React, { useState } from 'react';
import type { DualityRollResult, CharacterPath, TraitName } from '../../types/vtt';
import { rollDuality } from '../../services/dice';
import { Dices, Sparkles, Swords } from 'lucide-react';

interface DiceTrayPanelProps {
  onRoll: (result: DualityRollResult) => void;
  characterName: string;
  path: CharacterPath;
  traitModifiers?: Record<TraitName, number>;
}

const DC_LADDER = [
  { val: 5, label: '5 Routine' },
  { val: 10, label: '10 Easy' },
  { val: 15, label: '15 Challenging' },
  { val: 20, label: '20 Difficult' },
  { val: 25, label: '25 Extreme' },
  { val: 30, label: '30 Nearly Impossible' },
];

const TRAIT_OPTIONS: Array<{ key: TraitName; label: string; subtrait?: string }> = [
  { key: 'agility', label: 'Agility' },
  { key: 'strength', label: 'Strength' },
  { key: 'finesse', label: 'Finesse' },
  { key: 'finesse', label: 'Finesse (Pilot/Navigate)', subtrait: 'Pilot/Navigate' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'knowledge', label: 'Knowledge (Tech)', subtrait: 'Tech' },
  { key: 'knowledge', label: 'Knowledge (Medicine)', subtrait: 'Medicine' },
  { key: 'instinct', label: 'Instinct' },
  { key: 'presence', label: 'Presence' },
];

const WEAPON_PRESETS = [
  { name: 'Slug Pistol', dice: '1d8+1', type: 'Physical' as const },
  { name: 'Plasma Pistol', dice: '1d8', type: 'Energy' as const },
  { name: 'Combat Knife', dice: '1d6', type: 'Physical' as const },
  { name: 'Tactical Assault Rifle', dice: '1d10+2', type: 'Physical' as const },
  { name: 'Phase Blade', dice: '1d8+6', type: 'Void' as const },
  { name: 'Neural Disruptor', dice: '1d8+4', type: 'Neural' as const },
];

export const DiceTrayPanel: React.FC<DiceTrayPanelProps> = ({
  onRoll,
  characterName,
  path,
  traitModifiers = { agility: 0, strength: 0, finesse: 1, knowledge: 1, instinct: 2, presence: -1 },
}) => {
  const [selectedTrait, setSelectedTrait] = useState<string>('instinct');
  const [selectedSubtrait, setSelectedSubtrait] = useState<string | undefined>();
  const [selectedDc, setSelectedDc] = useState<number>(15);
  const [advantage, setAdvantage] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [invokeExperience, setInvokeExperience] = useState<boolean>(false);
  const [customMod] = useState<number>(0);

  // Weapon Attack mode
  const [isAttackMode, setIsAttackMode] = useState<boolean>(false);
  const [selectedWeaponIdx, setSelectedWeaponIdx] = useState<number>(0);
  const [proficiency, setProficiency] = useState<number>(1);
  const [targetMajor, setTargetMajor] = useState<number>(7);
  const [targetSevere, setTargetSevere] = useState<number>(14);

  const handleRollDuality = () => {
    const traitKey = selectedTrait as TraitName;
    const baseMod = (traitModifiers[traitKey] ?? 0) + customMod;
    const expBonus = invokeExperience ? 2 : 0;
    const traitLabel = selectedSubtrait
      ? `${selectedTrait.toUpperCase()} (${selectedSubtrait})`
      : selectedTrait.toUpperCase();

    const weaponOption = isAttackMode
      ? {
          name: WEAPON_PRESETS[selectedWeaponIdx].name,
          damageDice: WEAPON_PRESETS[selectedWeaponIdx].dice,
          damageType: WEAPON_PRESETS[selectedWeaponIdx].type,
          proficiency,
          targetMajorThreshold: targetMajor,
          targetSevereThreshold: targetSevere,
        }
      : undefined;

    const result = rollDuality({
      characterName,
      path,
      traitName: traitLabel,
      traitModifier: baseMod,
      experienceName: invokeExperience ? 'Invoked Experience' : undefined,
      experienceBonus: expBonus,
      advantageType: advantage === 'normal' ? 'none' : advantage,
      dc: selectedDc,
      label: isAttackMode
        ? `${characterName} attacks with ${WEAPON_PRESETS[selectedWeaponIdx].name}`
        : `${characterName} makes a ${traitLabel} Roll (DC ${selectedDc})`,
      weapon: weaponOption,
    });

    onRoll(result);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 overflow-y-auto p-3.5 space-y-4 text-xs select-none">
      {/* Mode Switch: Standard Duality Roll vs Weapon Attack */}
      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setIsAttackMode(false)}
          className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center space-x-1.5 ${
            !isAttackMode
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dices className="w-3.5 h-3.5" />
          <span>Duality Trait Roll</span>
        </button>
        <button
          onClick={() => setIsAttackMode(true)}
          className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center space-x-1.5 ${
            isAttackMode
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Attack & Damage</span>
        </button>
      </div>

      {/* Duality Dice Visual Indicators */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-around text-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 flex items-center justify-center text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20">
            d12
          </div>
          <span className="text-[10px] font-bold text-amber-300 mt-1 uppercase tracking-wider">
            Hope Die
          </span>
        </div>
        <div className="text-slate-600 font-bold text-sm">+</div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-700 to-slate-950 border border-rose-500/80 flex items-center justify-center text-rose-100 font-black text-sm shadow-lg shadow-rose-950/40">
            d12
          </div>
          <span className="text-[10px] font-bold text-rose-400 mt-1 uppercase tracking-wider">
            Fear Die
          </span>
        </div>
      </div>

      {/* Trait Selection */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Choose Trait to Test
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRAIT_OPTIONS.map((t, idx) => {
            const isSelected = selectedTrait === t.key && selectedSubtrait === t.subtrait;
            const traitVal = traitModifiers[t.key] ?? 0;
            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedTrait(t.key);
                  setSelectedSubtrait(t.subtrait);
                }}
                className={`p-2 rounded-lg border text-left transition ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200 shadow-sm font-bold'
                    : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] truncate">{t.label}</div>
                <div className="font-mono text-xs text-slate-200">
                  {traitVal >= 0 ? `+${traitVal}` : traitVal}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DC Ladder Selection */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Difficulty Class (DC Ladder)
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {DC_LADDER.map((d) => (
            <button
              key={d.val}
              onClick={() => setSelectedDc(d.val)}
              className={`py-1.5 px-2 rounded-lg border text-xs font-mono transition text-center ${
                selectedDc === d.val
                  ? 'border-indigo-500 bg-indigo-600 text-white font-bold'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advantage / Disadvantage Mode (Boon / Bane d6) */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Modifier Conditions
        </label>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            onClick={() => setAdvantage('advantage')}
            className={`flex-1 py-1 rounded-lg font-medium transition ${
              advantage === 'advantage'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Advantage (+d6)
          </button>
          <button
            onClick={() => setAdvantage('normal')}
            className={`flex-1 py-1 rounded-lg font-medium transition ${
              advantage === 'normal'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setAdvantage('disadvantage')}
            className={`flex-1 py-1 rounded-lg font-medium transition ${
              advantage === 'disadvantage'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Disadvantage (-d6)
          </button>
        </div>
      </div>

      {/* Experience Invocation (+2 flat bonus) */}
      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <div>
            <span className="font-semibold text-slate-200 block">Invoke Experience (+2)</span>
            <span className="text-[10px] text-slate-400">
              {path === 'awakened' ? 'Costs 1 Hope' : 'Free invocation (Sleeping)'}
            </span>
          </div>
        </div>
        <input
          type="checkbox"
          checked={invokeExperience}
          onChange={(e) => setInvokeExperience(e.target.checked)}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
        />
      </div>

      {/* Weapon Attack Configuration */}
      {isAttackMode && (
        <div className="p-3 bg-slate-950/90 rounded-xl border border-rose-900/40 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-rose-300 uppercase block mb-1">
              Select Weapon
            </label>
            <select
              value={selectedWeaponIdx}
              onChange={(e) => setSelectedWeaponIdx(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none"
            >
              {WEAPON_PRESETS.map((w, idx) => (
                <option key={idx} value={idx}>
                  {w.name} ({w.dice} {w.type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Proficiency</label>
              <input
                type="number"
                min="1"
                max="6"
                value={proficiency}
                onChange={(e) => setProficiency(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Major Thresh</label>
              <input
                type="number"
                value={targetMajor}
                onChange={(e) => setTargetMajor(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Severe Thresh</label>
              <input
                type="number"
                value={targetSevere}
                onChange={(e) => setTargetSevere(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Roll Action Button */}
      <button
        onClick={handleRollDuality}
        className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition active:scale-[0.98]"
      >
        <Dices className="w-5 h-5 text-amber-300" />
        <span>Roll Duality Dice (2d12)</span>
      </button>
    </div>
  );
};
