import React, { useState } from 'react';
import type { DiceRollResult } from '../../types/vtt';
import { rollDice } from '../../services/dice';
import { Dices, Sparkles, Flame } from 'lucide-react';

interface DiceTrayPanelProps {
  onRoll: (result: DiceRollResult) => void;
  characterName: string;
}

const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

export const DiceTrayPanel: React.FC<DiceTrayPanelProps> = ({ onRoll, characterName }) => {
  const [advantage, setAdvantage] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [modifier, setModifier] = useState<number>(0);
  const [customFormula, setCustomFormula] = useState<string>('');
  const [veilStrainActive, setVeilStrainActive] = useState<boolean>(false);

  const handleRollDie = (sides: number) => {
    let formula = `1d${sides}`;
    if (modifier > 0) formula += `+${modifier}`;
    if (modifier < 0) formula += `${modifier}`;

    const res = rollDice(formula, {
      label: `${characterName} rolled d${sides}`,
      advantage: sides === 20 ? advantage : 'normal',
      veilStrain: veilStrainActive ? 1 : 0,
    });
    onRoll(res);
  };

  const handleCustomRoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFormula.trim()) return;
    const res = rollDice(customFormula, {
      label: `${characterName} custom roll`,
      veilStrain: veilStrainActive ? 1 : 0,
    });
    onRoll(res);
    setCustomFormula('');
  };

  return (
    <div className="p-4 space-y-4 text-xs select-none">
      {/* Advantage / Disadvantage Mode Selector */}
      <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setAdvantage('advantage')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            advantage === 'advantage'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Advantage
        </button>
        <button
          onClick={() => setAdvantage('normal')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            advantage === 'normal'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Normal
        </button>
        <button
          onClick={() => setAdvantage('disadvantage')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            advantage === 'disadvantage'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Disadvantage
        </button>
      </div>

      {/* Primary Dice Buttons */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Polyhedral Dice
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DIE_TYPES.map((sides) => (
            <button
              key={sides}
              onClick={() => handleRollDie(sides)}
              className="py-3 px-2 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-indigo-500/70 hover:bg-indigo-950/30 text-slate-200 font-bold transition flex flex-col items-center justify-center space-y-1 group shadow-sm hover:scale-[1.03] active:scale-95"
            >
              <Dices className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
              <span>d{sides}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Veilfarers Special: Veil Strain / Fate Surge */}
      <div className="p-3 bg-gradient-to-r from-purple-950/50 to-indigo-950/40 rounded-xl border border-purple-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-4 h-4 text-purple-400" />
            <div>
              <span className="font-semibold text-purple-200 block">Veil Strain Push</span>
              <span className="text-[10px] text-purple-300/70">
                Risk corruption (+1 Strain) for fate bonus
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={veilStrainActive}
            onChange={(e) => setVeilStrainActive(e.target.checked)}
            className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Modifiers */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          Roll Modifier
        </label>
        <div className="flex items-center space-x-1.5">
          {[-2, -1, 0, 1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              onClick={() => setModifier(m)}
              className={`flex-1 py-1 rounded-lg border font-mono transition ${
                modifier === m
                  ? 'border-indigo-500 bg-indigo-600 text-white font-bold'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              {m >= 0 ? `+${m}` : m}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Formula input */}
      <form onSubmit={handleCustomRoll} className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Custom Formula (e.g. 4d6kh3 + 2)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. 2d8 + 1d6 + 3"
            value={customFormula}
            onChange={(e) => setCustomFormula(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-indigo-500 text-xs"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-md shadow-indigo-600/30 transition flex items-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Roll</span>
          </button>
        </div>
      </form>
    </div>
  );
};
