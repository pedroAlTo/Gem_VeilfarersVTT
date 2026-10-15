import React, { useState } from 'react';
import type { CharacterSheet, DiceRollResult, VeilfarerAttributes } from '../../types/vtt';
import { rollDice } from '../../services/dice';
import { Shield, Sparkles, Flame, Dices, BookOpen, Sword } from 'lucide-react';

interface CharacterSheetPanelProps {
  onRoll: (result: DiceRollResult) => void;
  characterName: string;
}

export const CharacterSheetPanel: React.FC<CharacterSheetPanelProps> = ({
  onRoll,
  characterName,
}) => {
  const [sheet, setSheet] = useState<CharacterSheet>({
    id: 'char-default',
    ownerUid: 'user-default',
    name: characterName || 'Aeryn Sunstrider',
    archetype: 'Veilblade',
    level: 3,
    hp: 38,
    maxHp: 38,
    aether: 12,
    maxAether: 15,
    strain: 2,
    maxStrain: 10,
    attributes: {
      might: 3,
      agility: 2,
      wits: 1,
      willpower: 2,
      resonance: 4,
    },
    skills: [
      { name: 'Aether Strike', attr: 'resonance', bonus: 4 },
      { name: 'Veil Step', attr: 'agility', bonus: 2 },
      { name: 'Rift Lore', attr: 'wits', bonus: 3 },
      { name: 'Athletics', attr: 'might', bonus: 3 },
      { name: 'Iron Will', attr: 'willpower', bonus: 2 },
    ],
    equipment: [
      'Resonant Greatsword (+1 Aether)',
      'Veil-Forged Mail',
      'Explorer Pack',
      '3x Healing Draughts',
    ],
    relics: ['Tears of the First Rift (Allows 1x free Veil Step per rest)'],
    notes: 'Born during the Eclipse of the Second Veil. Speaks Ancient Astral runes.',
  });

  const handleRollAttribute = (attr: keyof VeilfarerAttributes, val: number) => {
    const formula = val >= 0 ? `1d20+${val}` : `1d20${val}`;
    const res = rollDice(formula, {
      label: `${sheet.name} rolled ${attr.toUpperCase()} check`,
      archetype: sheet.archetype,
    });
    onRoll(res);
  };

  const handleRollSkill = (skillName: string, bonus: number) => {
    const formula = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
    const res = rollDice(formula, {
      label: `${sheet.name} rolled ${skillName}`,
      archetype: sheet.archetype,
    });
    onRoll(res);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Identity Card */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={sheet.name}
            onChange={(e) => setSheet({ ...sheet, name: e.target.value })}
            className="bg-transparent font-bold text-sm text-slate-100 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none"
          />
          <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/50 text-[10px]">
            Lvl {sheet.level}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
          <span className="text-purple-300 font-medium">{sheet.archetype}</span>
          <span>•</span>
          <span>Veil Explorer</span>
        </div>
      </div>

      {/* Resource Meters: HP, Aether, Strain */}
      <div className="grid grid-cols-3 gap-2">
        {/* Health */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-emerald-400 font-semibold mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Health</span>
          </div>
          <div className="flex items-center space-x-1 font-mono text-sm">
            <input
              type="number"
              value={sheet.hp}
              onChange={(e) => setSheet({ ...sheet, hp: parseInt(e.target.value, 10) || 0 })}
              className="w-10 bg-slate-900 border border-slate-700 rounded text-center text-slate-100"
            />
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{sheet.maxHp}</span>
          </div>
        </div>

        {/* Aether */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-cyan-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Aether</span>
          </div>
          <div className="flex items-center space-x-1 font-mono text-sm">
            <input
              type="number"
              value={sheet.aether}
              onChange={(e) => setSheet({ ...sheet, aether: parseInt(e.target.value, 10) || 0 })}
              className="w-10 bg-slate-900 border border-slate-700 rounded text-center text-slate-100"
            />
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{sheet.maxAether}</span>
          </div>
        </div>

        {/* Veil Strain */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-purple-400 font-semibold mb-1">
            <Flame className="w-3.5 h-3.5" />
            <span>Strain</span>
          </div>
          <div className="flex items-center space-x-1 font-mono text-sm">
            <input
              type="number"
              value={sheet.strain}
              onChange={(e) => setSheet({ ...sheet, strain: parseInt(e.target.value, 10) || 0 })}
              className="w-10 bg-slate-900 border border-slate-700 rounded text-center text-purple-300"
            />
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{sheet.maxStrain}</span>
          </div>
        </div>
      </div>

      {/* Core Attributes (Click to roll!) */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1">
          <Dices className="w-3.5 h-3.5 text-indigo-400" />
          <span>Attributes (Click to Roll)</span>
        </label>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {(Object.keys(sheet.attributes) as Array<keyof VeilfarerAttributes>).map((attr) => {
            const val = sheet.attributes[attr];
            return (
              <button
                key={attr}
                onClick={() => handleRollAttribute(attr, val)}
                className="p-2 bg-slate-950/90 border border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/30 rounded-xl transition group flex flex-col items-center"
                title={`Roll ${attr.toUpperCase()} (1d20${val >= 0 ? '+' : ''}${val})`}
              >
                <span className="text-[10px] text-slate-400 uppercase font-semibold group-hover:text-indigo-300">
                  {attr.slice(0, 3)}
                </span>
                <span className="text-sm font-bold font-mono text-slate-100 group-hover:text-indigo-400">
                  {val >= 0 ? `+${val}` : val}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills list (Click to roll!) */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1">
          <Sword className="w-3.5 h-3.5 text-purple-400" />
          <span>Skills & Disciplines</span>
        </label>
        <div className="space-y-1.5">
          {sheet.skills.map((s) => (
            <button
              key={s.name}
              onClick={() => handleRollSkill(s.name, s.bonus)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500 hover:bg-indigo-950/20 text-left transition"
            >
              <div>
                <span className="font-medium text-slate-200">{s.name}</span>
                <span className="text-[10px] text-slate-500 ml-1.5 uppercase">({s.attr})</span>
              </div>
              <span className="font-mono text-indigo-400 font-bold">
                {s.bonus >= 0 ? `+${s.bonus}` : s.bonus}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Equipment & Relics */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Relics & Equipment</span>
        </label>
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
          {sheet.relics.map((r, i) => (
            <div key={i} className="text-amber-300/90 text-[11px] flex items-center space-x-1.5">
              <span>✦</span>
              <span>{r}</span>
            </div>
          ))}
          {sheet.equipment.map((eq, i) => (
            <div key={i} className="text-slate-400 text-[11px] flex items-center space-x-1.5">
              <span>•</span>
              <span>{eq}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
