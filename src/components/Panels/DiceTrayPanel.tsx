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
  { val: 5, label: '5 ROUTINE' },
  { val: 10, label: '10 EASY' },
  { val: 15, label: '15 CHALLENGING' },
  { val: 20, label: '20 DIFFICULT' },
  { val: 25, label: '25 EXTREME' },
  { val: 30, label: '30 IMPOSSIBLE' },
];

const TRAIT_OPTIONS: Array<{ key: TraitName; label: string; subtrait?: string }> = [
  { key: 'agility', label: 'Agility' },
  { key: 'strength', label: 'Strength' },
  { key: 'finesse', label: 'Finesse' },
  { key: 'finesse', label: 'Finesse (Pilot)', subtrait: 'Pilot/Navigate' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'knowledge', label: 'Knowledge (Tech)', subtrait: 'Tech' },
  { key: 'knowledge', label: 'Knowledge (Med)', subtrait: 'Medicine' },
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
    <div className="flex flex-col h-full bg-[#080a10] border border-[#1b2333] overflow-y-auto p-3 space-y-3 text-xs select-none font-mono relative">
      {/* Corner Brackets */}
      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500 z-10" />

      {/* TOP HEADER: ▲ DICE / DUALITY PROBABILITY */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1b2332]">
        <div className="flex items-center space-x-2">
          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold tracking-wider text-[10px] flex items-center gap-1 rounded-sm">
            <span className="text-[8px]">▲</span> DICE
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-bold tracking-wider text-[10px]">
            DUALITY MATRIX
          </span>
        </div>
        <span className="text-[9px] text-amber-500 font-bold">2d12 SYSTEM</span>
      </div>

      {/* Mode Switch: Standard Duality Roll vs Weapon Attack */}
      <div className="flex bg-[#0b0e14] p-0.5 rounded-sm border border-[#1d273a]">
        <button
          onClick={() => setIsAttackMode(false)}
          className={`flex-1 py-1 rounded-xs font-bold transition flex items-center justify-center space-x-1 text-[10px] ${
            !isAttackMode
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dices className="w-3 h-3" />
          <span>TRAIT TEST</span>
        </button>
        <button
          onClick={() => setIsAttackMode(true)}
          className={`flex-1 py-1 rounded-xs font-bold transition flex items-center justify-center space-x-1 text-[10px] ${
            isAttackMode
              ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Swords className="w-3 h-3" />
          <span>ATTACK & SOAK</span>
        </button>
      </div>

      {/* Duality Dice Visual Display (Hope d12 + Fear d12) */}
      <div className="bg-[#0b0e15] p-2.5 rounded-sm border border-[#1b2434] flex items-center justify-around text-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xs bg-amber-500 border border-amber-300 flex items-center justify-center text-slate-950 font-black text-sm shadow-[0_0_8px_rgba(245,158,11,0.6)]">
            d12
          </div>
          <span className="text-[9px] font-bold text-amber-400 mt-1 uppercase tracking-wider">
            HOPE DIE
          </span>
        </div>
        <div className="text-slate-600 font-bold text-sm">+</div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xs bg-slate-950 border border-rose-500 flex items-center justify-center text-rose-400 font-black text-sm shadow-[0_0_8px_rgba(244,63,94,0.4)]">
            d12
          </div>
          <span className="text-[9px] font-bold text-rose-400 mt-1 uppercase tracking-wider">
            FEAR DIE
          </span>
        </div>
      </div>

      {/* Trait Selection */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          CHOOSE TRAIT TO TEST
        </label>
        <div className="grid grid-cols-3 gap-1">
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
                className={`p-1.5 rounded-xs border text-left transition ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold shadow-[0_0_6px_rgba(245,158,11,0.4)]'
                    : 'border-[#1b2332] bg-[#0c1017] text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-[9px] truncate">{t.label}</div>
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
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          DIFFICULTY CLASS (DC LADDER)
        </label>
        <div className="grid grid-cols-3 gap-1">
          {DC_LADDER.map((d) => (
            <button
              key={d.val}
              onClick={() => setSelectedDc(d.val)}
              className={`py-1 px-1.5 rounded-xs border text-[9px] font-mono transition text-center ${
                selectedDc === d.val
                  ? 'border-amber-400 bg-amber-500 text-slate-950 font-black shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                  : 'border-[#1b2332] bg-[#0c1017] text-slate-400 hover:border-slate-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advantage / Disadvantage Mode (Boon / Bane d6) */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          MODIFIER CONDITIONS
        </label>
        <div className="flex bg-[#0b0e14] p-0.5 rounded-xs border border-[#1b2434] text-[9px]">
          <button
            onClick={() => setAdvantage('advantage')}
            className={`flex-1 py-1 rounded-xs font-bold transition ${
              advantage === 'advantage'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ADV (+d6)
          </button>
          <button
            onClick={() => setAdvantage('normal')}
            className={`flex-1 py-1 rounded-xs font-bold transition ${
              advantage === 'normal'
                ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            NORMAL
          </button>
          <button
            onClick={() => setAdvantage('disadvantage')}
            className={`flex-1 py-1 rounded-xs font-bold transition ${
              advantage === 'disadvantage'
                ? 'bg-rose-500 text-slate-950 font-black shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DIS (-d6)
          </button>
        </div>
      </div>

      {/* Experience Invocation (+2 flat bonus) */}
      <div className="p-2 bg-[#0c1017] rounded-xs border border-[#1b2332] flex items-center justify-between text-[10px]">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <div>
            <span className="font-bold text-slate-200 block">INVOKE EXPERIENCE (+2)</span>
            <span className="text-[8px] text-slate-500">
              {path === 'awakened' ? 'Costs 1 Hope' : 'Free invocation (Sleeping)'}
            </span>
          </div>
        </div>
        <input
          type="checkbox"
          checked={invokeExperience}
          onChange={(e) => setInvokeExperience(e.target.checked)}
          className="w-4 h-4 accent-amber-500 cursor-pointer rounded-xs"
        />
      </div>

      {/* Weapon Attack Configuration */}
      {isAttackMode && (
        <div className="p-2 bg-[#0c1017] rounded-xs border border-rose-900/50 space-y-2 text-[10px]">
          <div>
            <label className="text-[9px] font-bold text-rose-400 uppercase block mb-1">
              SELECT ARMAMENT
            </label>
            <select
              value={selectedWeaponIdx}
              onChange={(e) => setSelectedWeaponIdx(parseInt(e.target.value, 10))}
              className="w-full bg-[#10141f] border border-[#222c3d] rounded-xs px-2 py-1 text-slate-200 text-[10px] focus:outline-none"
            >
              {WEAPON_PRESETS.map((w, idx) => (
                <option key={idx} value={idx}>
                  {w.name} ({w.dice} {w.type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-[8px] text-slate-400 block mb-0.5">PROFICIENCY</label>
              <input
                type="number"
                min="1"
                max="6"
                value={proficiency}
                onChange={(e) => setProficiency(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#10141f] border border-[#222c3d] rounded-xs px-1.5 py-0.5 text-center font-mono text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 block mb-0.5">MAJOR THRESH</label>
              <input
                type="number"
                value={targetMajor}
                onChange={(e) => setTargetMajor(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#10141f] border border-[#222c3d] rounded-xs px-1.5 py-0.5 text-center font-mono text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 block mb-0.5">SEVERE THRESH</label>
              <input
                type="number"
                value={targetSevere}
                onChange={(e) => setTargetSevere(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#10141f] border border-[#222c3d] rounded-xs px-1.5 py-0.5 text-center font-mono text-slate-200 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Roll Action Button */}
      <button
        onClick={handleRollDuality}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xs shadow-[0_0_12px_rgba(245,158,11,0.6)] flex items-center justify-center space-x-2 transition tracking-wider uppercase text-xs"
      >
        <Dices className="w-4 h-4 text-slate-950" />
        <span>ENGAGE DUALITY ROLL (2d12)</span>
      </button>
    </div>
  );
};
