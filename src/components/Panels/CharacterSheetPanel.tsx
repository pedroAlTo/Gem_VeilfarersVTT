import React, { useState } from 'react';
import type { CharacterSheet, DualityRollResult, TraitName } from '../../types/vtt';
import { rollDuality } from '../../services/dice';
import { Shield, Sparkles, Heart, Dices, Award, Anchor, Zap } from 'lucide-react';

interface CharacterSheetPanelProps {
  onRoll: (result: DualityRollResult) => void;
  characterName: string;
}

export const CharacterSheetPanel: React.FC<CharacterSheetPanelProps> = ({
  onRoll,
  characterName,
}) => {
  const [sheet, setSheet] = useState<CharacterSheet>({
    id: 'char-maren',
    ownerUid: 'user-default',
    name: characterName || 'Maren Solas',
    path: 'awakened',
    ancestry: 'Celestiari',
    community: 'Free Fleet',
    affiliation: 'The Free Fleet',
    affiliationStanding: 1, // Good Standing (+1)
    reputationPoints: { 'The Free Fleet': 3 },
    class: 'Pilot',
    subclass: 'Void Runner',
    level: 1,
    proficiency: 1,
    hp: 6,
    maxHp: 6,
    majorThreshold: 5,
    severeThreshold: 11,
    armorSlots: 3,
    maxArmorSlots: 3,
    evasion: 11,
    stress: 0,
    maxStress: 6,
    hope: 2,
    maxHope: 6,
    loadout: ['Zero-G Drift', 'System Jackknife'],
    vault: ['Vector Calculus', 'Temporal Muffle'],
    effort: 2,
    maxEffort: 6,
    effortTrack: 0,
    resolve: 2,
    maxResolve: 2,
    honedEdge: 0,
    recoveryAnchor: 'Worn flight jacket & photo of the lost crew',
    traits: {
      agility: 0,
      strength: 0,
      finesse: 1,
      knowledge: 1,
      instinct: 2,
      presence: -1,
    },
    experiences: [
      { id: 'exp-1', name: 'First to chart the Crimson Veil Storm, and I lost Iruvi doing it', bonus: 2 },
      { id: 'exp-2', name: 'Free Fleet Lifer, twenty years on one hull', bonus: 2 },
    ],
    weapons: ['Slug Pistol (1d8+1 phys, Close, Reliable)'],
    armor: 'Pilot\'s Jacket (5/11 Thresholds, 3 Slots, Life Support)',
    equipment: ['Frayed Star Chart', 'Veil-Energy Control Crystal', 'Personal Comm'],
    wealthTier: 1, // Established
    notes: 'Flies the Vagrant Star. Wary of Great House politics.',
  });

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
    // If Awakened, check Hope
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

  const handleBearDown = () => {
    if (sheet.resolve <= 0) {
      alert('No Resolve remaining to Bear Down!');
      return;
    }
    const spent = 1;
    const rolled = Math.floor(Math.random() * 4) + 1;
    setSheet((s) => ({ ...s, resolve: s.resolve - spent }));

    const res = rollDuality({
      characterName: sheet.name,
      path: 'sleeping',
      traitName: 'BEAR DOWN (RESOLVE MOVE)',
      traitModifier: rolled,
      dc: 15,
      label: `${sheet.name} Bears Down (spends 1d4 Resolve: rolled +${rolled})`,
    });

    onRoll(res);
  };

  const isOverwhelmed = sheet.stress >= sheet.maxStress;

  return (
    <div className="flex flex-col h-full bg-slate-900/60 overflow-y-auto p-3.5 space-y-4 text-xs select-none">
      {/* Path Toggle: Awakened vs Sleeping */}
      <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1.5">
          Path of Being:
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
            Level {sheet.level} • Prof {sheet.proficiency}
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
        /* Awakened Hope Engine */
        <div className="bg-slate-950/90 p-3 rounded-xl border border-purple-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-purple-300 font-bold flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Hope Pool (Agency Budget)</span>
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
            Start session with 2. Cap 6. Spends on Domain Powers and Experience invocations.
          </div>
        </div>
      ) : (
        /* Sleeping Effort & Resolve Engine */
        <div className="bg-slate-950/90 p-3 rounded-xl border border-indigo-800/40 space-y-2.5">
          {/* Effort Track & Pool */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-indigo-300 font-bold block">Effort Pool & Track</span>
              <span className="text-[9px] text-slate-400">
                2 segments per Effort. Starts with 2 Effort (max 6).
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {/* 2-segment track visual */}
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
                    sheet.effortTrack >= 1
                      ? 'bg-indigo-500 border-indigo-300'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                  title="Effort Track Segment 1"
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
                    sheet.effortTrack >= 2
                      ? 'bg-indigo-500 border-indigo-300'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                  title="Effort Track Segment 2"
                />
              </div>
              <span className="font-mono font-bold text-sm text-indigo-200">
                {sheet.effort}/6 Effort
              </span>
            </div>
          </div>

          {/* Resolve d4 Pool & Signature Move */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              <span className="text-amber-300 font-bold block">Resolve Pool (d4s)</span>
              <span className="text-[9px] text-slate-400">
                {sheet.resolve}/{sheet.maxResolve} d4s remaining (Refills on Prepare move)
              </span>
            </div>
            <button
              onClick={handleBearDown}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-[10px] shadow flex items-center space-x-1"
            >
              <Zap className="w-3 h-3" />
              <span>Bear Down (1d4)</span>
            </button>
          </div>

          {/* Recovery Anchor */}
          <div className="pt-1.5 border-t border-slate-800 flex items-center space-x-2 text-[10px]">
            <Anchor className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-slate-400 truncate">Anchor: {sheet.recoveryAnchor}</span>
          </div>
        </div>
      )}

      {/* Defenses: HP, Thresholds, Armor Slots, Stress */}
      <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px]">
        {/* HP and Thresholds */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-emerald-400 font-bold flex items-center space-x-1">
              <Heart className="w-3.5 h-3.5 text-emerald-400" />
              <span>HP: {sheet.hp} / {sheet.maxHp}</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
            <div>Major Thresh: <span className="text-slate-200 font-bold">{sheet.majorThreshold}</span> (2 HP)</div>
            <div>Severe Thresh: <span className="text-slate-200 font-bold">{sheet.severeThreshold}</span> (3 HP)</div>
            <div className="text-[9px] text-slate-500">Overkill: +1 HP per 10 over Severe</div>
          </div>
        </div>

        {/* Armor Slots and Stress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-cyan-400 font-bold flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Armor Slots: {sheet.armorSlots}/{sheet.maxArmorSlots}</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
            <div>Evasion DC: <span className="text-slate-200 font-bold">{sheet.evasion}</span></div>
            <div className={isOverwhelmed ? 'text-rose-400 font-bold' : ''}>
              Stress: <span className="text-slate-200 font-bold">{sheet.stress}/{sheet.maxStress}</span> {isOverwhelmed && '(!)'}
            </div>
            <div className="text-[9px] text-slate-500">Wealth Tier: {sheet.wealthTier} (Established)</div>
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

        {/* Canonical Subtraits shortcuts */}
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

      {/* Loadout & Equipment Summary */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
          Current Readied Arsenal & Gear
        </span>
        <div className="space-y-1 text-[11px] text-slate-400">
          <div><strong className="text-slate-300">Armor:</strong> {sheet.armor}</div>
          <div><strong className="text-slate-300">Weapon:</strong> {sheet.weapons.join(', ')}</div>
          <div><strong className="text-slate-300">Gear:</strong> {sheet.equipment.join(' • ')}</div>
          {sheet.path === 'awakened' && (
            <div>
              <strong className="text-purple-300">Loadout (Prepared Powers):</strong> {sheet.loadout.join(' • ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
