import React, { useState } from 'react';
import { X, BookOpen, Dices, Shield, Swords, Rocket, AlertTriangle, Sparkles } from 'lucide-react';

interface RulesCompendiumModalProps {
  onClose: () => void;
}

export const RulesCompendiumModal: React.FC<RulesCompendiumModalProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<'duality' | 'combat' | 'paths' | 'starship' | 'heat' | 'conditions'>('duality');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Veilfarers 12.06 Sacred System Rules Compendium</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex bg-slate-950 border-b border-slate-800 px-6 pt-2 space-x-1 overflow-x-auto text-[11px]">
          <button
            onClick={() => setActiveSection('duality')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center space-x-1.5 ${
              activeSection === 'duality'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Duality Dice & DCs</span>
          </button>
          <button
            onClick={() => setActiveSection('combat')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center space-x-1.5 ${
              activeSection === 'combat'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Combat & Damage</span>
          </button>
          <button
            onClick={() => setActiveSection('paths')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center space-x-1.5 ${
              activeSection === 'paths'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Two Paths of Being</span>
          </button>
          <button
            onClick={() => setActiveSection('starship')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center space-x-1.5 ${
              activeSection === 'starship'
                ? 'border-cyan-500 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Starship Warfare</span>
          </button>
          <button
            onClick={() => setActiveSection('heat')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center space-x-1.5 ${
              activeSection === 'heat'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Criminal Heat</span>
          </button>
          <button
            onClick={() => setActiveSection('conditions')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center space-x-1.5 ${
              activeSection === 'conditions'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Conditions</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-300 leading-relaxed text-xs">
          {activeSection === 'duality' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100">The Duality Roll: Hope & Fear (2d12)</h3>
              <p>
                When an action has meaningful stakes, roll two 12-sided dice simultaneously: the <strong>Hope die</strong> and the <strong>Fear die</strong>. Add the appropriate Trait modifier. Compare with the DC.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300">Matching Dice (Doubles): CRITICAL SUCCESS</div>
                  <p className="text-[11px] text-slate-400">
                    Always succeeds regardless of DC (even 1+1). Clear 1 Stress. Awakened gains 1 Hope. Sleeping completes Effort Track for 1 Effort + 1 point to Effort/Resolve.
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-300">Hope &gt; Fear (Hope-Dominant)</div>
                  <p className="text-[11px] text-slate-400">
                    <strong>Total &ge; DC:</strong> Success with Hope (+1 Path Resource).<br />
                    <strong>Total &lt; DC:</strong> Failure with Hope (+1 Path Resource, a narrative thread/opening remains).
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-rose-400">Fear &gt; Hope (Fear-Dominant)</div>
                  <p className="text-[11px] text-slate-400">
                    <strong>Total &ge; DC:</strong> Success with Fear (+1 Fear to Keeper, complication occurs).<br />
                    <strong>Total &lt; DC:</strong> Failure with Fear (+1 Fear to Keeper, situation worsens).
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-indigo-300">Difficulty Class (DC Ladder)</div>
                  <ul className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <li>5: Routine</li>
                    <li>10: Easy</li>
                    <li>15: Challenging (Standard)</li>
                    <li>20: Difficult</li>
                    <li>25: Extreme</li>
                    <li>30: Nearly Impossible</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'combat' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Personal Combat: Defenses & Damage</h3>
              <p>
                Attacks are Duality Rolls using Strength, Finesse, or Instinct against target <strong>Evasion</strong>. On hit, roll weapon damage with Proficiency scaling.
              </p>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-rose-300">Damage Thresholds & Severity</div>
                <ul className="text-[11px] space-y-1 text-slate-400">
                  <li><strong>Minor (below Major Threshold):</strong> marks <strong>1 HP</strong>.</li>
                  <li><strong>Major (at or above Major, below Severe):</strong> marks <strong>2 HP</strong>.</li>
                  <li><strong>Severe (at or above Severe Threshold):</strong> marks <strong>3 HP</strong>.</li>
                  <li><strong>Overkill:</strong> For every full 10 points above Severe, marks <strong>+1 additional HP</strong>.</li>
                </ul>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-cyan-300">Armor Slots (Soak) & Penetration</div>
                <p className="text-[11px] text-slate-400">
                  Spend 1 <strong>Armor Slot</strong> to drop hit severity by one step (Severe &rarr; Major &rarr; Minor &rarr; 0 HP). Restored via Short Rest &quot;Repair Armor&quot; or Long Rest &quot;Repair All Armor&quot;.
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div><strong>Physical:</strong> Penetration 0</div>
                  <div><strong>Energy:</strong> Penetration -2 to target thresholds (Reflective cancels)</div>
                  <div><strong>Void:</strong> Penetration -4 to target thresholds (Ward cancels)</div>
                  <div><strong>Neural:</strong> Penetration -4, +1 Stress to target</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="font-bold text-amber-300">Dying & Death Move (Blaze of Glory)</div>
                <p className="text-[11px] text-slate-400">
                  At 0 HP, become Dying. Roll 1d12 each Spotlight: 8+ marks Dying Progress; 2 marks &rarr; Final; 2 Final marks &rarr; Death. At any time, player can choose a voluntary <strong>Death Move (Blaze of Glory)</strong> to take one last heroic act.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'paths' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100">The Two Paths of Being: Awakened vs Sleeping</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-purple-800/50 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>The Awakened (1 in 40,000)</span>
                  </div>
                  <ul className="text-[11px] space-y-1 text-slate-400">
                    <li>• Perceives the Veil directly.</li>
                    <li>• Runs on <strong>Hope</strong> (start session with 2, cap 6).</li>
                    <li>• Spends 1 Hope to invoke an Experience for +flat bonus.</li>
                    <li>• Vault & Loadout of <strong>Domain Powers</strong> across 7 Domains (5 cards at Tier 1, 6 at Tier 2, 7 at Tier 3).</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-indigo-800/50 space-y-2">
                  <div className="font-bold text-indigo-300 flex items-center space-x-1.5">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>The Sleeping</span>
                  </div>
                  <ul className="text-[11px] space-y-1 text-slate-400">
                    <li>• Deaf to the Veil; runs on human grit and discipline.</li>
                    <li>• Runs on <strong>Effort</strong> (2-segment Track, holds 0-6 Effort).</li>
                    <li>• <strong>Resolve pool</strong> of d4s (base 2, max 6 at lvl 9) for signature Moves.</li>
                    <li>• <strong>Honed Edge:</strong> + (level - 1) flat weapon damage.</li>
                    <li>• Invokes Experiences <strong>for free</strong> (+1 extra Experience at creation).</li>
                    <li>• <strong>Recovery Anchor:</strong> named practice/item to clear Stress.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'starship' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Starship Combat (The Void Between Hulls)</h3>
              <p>
                The crew&apos;s ship is a shared scene where each player spends their own Spotlight at a station. Enemy ships act as single entities.
              </p>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-cyan-300 block">Mount Rating (MR)</span>
                  <p className="text-slate-400">
                    MR is a hull statistic: Tier 1 = &times;1, Tier 2-3 = &times;2, Tier 4-5 = &times;3. Roll printed damage, then multiply by MR.
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-amber-300 block">Shield Arcs & Heat Cap</span>
                  <p className="text-slate-400">
                    Damage hits the targeted arc (Fore, Aft, Port, Starboard). Arcs regenerate 2 Slots at end of round. When Heat exceeds Cap, all systems lose 1 Integrity!
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'heat' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100">The Heat System (0 to 10)</h3>
              <p>
                A single crew-wide resource tracking criminal attention across the galaxy.
              </p>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="font-bold text-emerald-300">0 - 2: Cold</span>
                  <span className="text-slate-400">Standard security, normal operations</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="font-bold text-amber-300">3 - 4: Warm</span>
                  <span className="text-slate-400">+50% port fees; Presence Disadvantage with law-abiding NPCs</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="font-bold text-amber-500">5 - 6: Hot</span>
                  <span className="text-slate-400">Active investigation; wanted notices circulated</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="font-bold text-rose-400">7 - 8: Burning</span>
                  <span className="text-slate-400">Bounty hunters actively pursue; covert docking requires Pilot Instinct DC 15</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="font-bold text-rose-600">9: Inferno</span>
                  <span className="text-slate-400">Dedicated military task force assigned; kill-on-sight in some sectors</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="font-bold text-red-600">10: Burned</span>
                  <span className="text-slate-400">No safe harbor anywhere in civilized space; total network collapse</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'conditions' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Canonical Conditions Registry</h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-amber-300 block">Dazed:</strong> Disadvantage on the character&apos;s next single action. Clears after resolving.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-rose-400 block">Vulnerable:</strong> Attacks against the target have Advantage until the condition ends.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-purple-400 block">Stunned:</strong> Cannot take any action until cleared after next round or roused.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-rose-500 block">Bleeding:</strong> Mark 1 Stress at the end of each round until First Aid or healing stops it.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-amber-500 block">On Fire:</strong> Take 1d4 Energy damage at end of round until extinguished.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-indigo-400 block">Restrained:</strong> Cannot move. Disadvantage on Agility and Strength rolls.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-slate-300 block">Prone:</strong> Disadvantage on attacks; ranged attackers have Advantage against you.
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <strong className="text-cyan-300 block">Hidden:</strong> Cannot be directly targeted; Advantage on next attack from cover.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
