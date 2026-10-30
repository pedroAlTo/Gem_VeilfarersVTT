import React, { useState } from 'react';
import type { UserRole, CharacterPath } from '../../types/vtt';
import { Rocket, Shield, Flame, Compass, RefreshCw, Radio } from 'lucide-react';

interface StarshipPanelProps {
  userRole: UserRole;
  path: CharacterPath;
  characterName: string;
  onSendActionLog: (content: string) => void;
}

export interface ShipState {
  name: string;
  hullClass: string;
  tier: number;
  hull: number;
  maxHull: number;
  evasion: number;
  mountRating: number;
  heat: number;
  heatCap: number;
  rangeBand: 'Adjacent' | 'Engagement' | 'Standard' | 'Long' | 'Extreme';
  pearls: number; // Quantum Pearls
  driveMode: 'Cruise' | 'Combat' | 'Overdrive';
  shieldArcs: {
    fore: number;
    aft: number;
    port: number;
    starboard: number;
    maxPerArc: number;
  };
  systems: {
    primaryDrive: number;
    ftlDrive: number;
    sensors: number;
    comms: number;
    weapons: number;
  };
}

export const StarshipPanel: React.FC<StarshipPanelProps> = ({
  userRole,
  characterName,
  onSendActionLog,
}) => {
  const isGM = userRole === 'gm';

  const [ship, setShip] = useState<ShipState>({
    name: 'Vagrant Star',
    hullClass: 'Light Freighter (Tier 2)',
    tier: 2,
    hull: 14,
    maxHull: 14,
    evasion: 14, // Base 12 + Pilot Instinct (+2)
    mountRating: 2, // Tier 2 = MR ×2
    heat: 0,
    heatCap: 10,
    rangeBand: 'Engagement',
    pearls: 3,
    driveMode: 'Cruise',
    shieldArcs: {
      fore: 4,
      aft: 4,
      port: 4,
      starboard: 4,
      maxPerArc: 4,
    },
    systems: {
      primaryDrive: 3,
      ftlDrive: 3,
      sensors: 3,
      comms: 3,
      weapons: 3,
    },
  });

  const [targetArc, setTargetArc] = useState<'fore' | 'aft' | 'port' | 'starboard'>('fore');

  // Engineer Operations
  const handleCoolSystems = () => {
    const nextHeat = Math.max(0, ship.heat - 3);
    setShip({ ...ship, heat: nextHeat });
    onSendActionLog(`${characterName} [Engineer] Cools Systems: heat reduced by 3 (now ${nextHeat}/${ship.heatCap})`);
  };

  const handleVentHeat = () => {
    const nextHeat = Math.max(0, ship.heat - 5);
    setShip({ ...ship, heat: nextHeat });
    onSendActionLog(`${characterName} [Engineer] Vents Core: dumped 5 Heat (now ${nextHeat}). Ship is Visible (+2 to enemy attacks) for 1 round!`);
  };

  const handleReinforceArc = (arc: 'fore' | 'aft' | 'port' | 'starboard') => {
    const nextHeat = ship.heat + 2;
    const currentSlots = ship.shieldArcs[arc];
    setShip({
      ...ship,
      heat: nextHeat,
      shieldArcs: { ...ship.shieldArcs, [arc]: currentSlots + 2 },
    });
    onSendActionLog(`${characterName} [Engineer] Reinforces ${arc.toUpperCase()} Shield Arc (+2 Armor Slots, generated +2 Heat).`);
  };

  // End of Round (Regenerates 2 Armor Slots per arc)
  const handleEndOfRound = () => {
    const nextArcs = {
      fore: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.fore + 2),
      aft: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.aft + 2),
      port: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.port + 2),
      starboard: Math.min(ship.shieldArcs.maxPerArc, ship.shieldArcs.starboard + 2),
      maxPerArc: ship.shieldArcs.maxPerArc,
    };
    const nextHeat = Math.max(0, ship.heat - 1); // idle dissipation
    setShip({ ...ship, shieldArcs: nextArcs, heat: nextHeat });
    onSendActionLog(`End of Starship Round: Shield arcs regenerated 2 Armor Slots each. Heat cooled by 1.`);
  };

  // Pilot Maneuvers
  const handleManeuver = (name: string, dc: number, heatCost: number = 0) => {
    const roll = Math.floor(Math.random() * 12) + 1 + Math.floor(Math.random() * 12) + 1 + 2; // +2 Pilot Instinct
    const success = roll >= dc;
    const nextHeat = ship.heat + heatCost;
    setShip({ ...ship, heat: nextHeat });

    onSendActionLog(
      `${characterName} [Pilot] executes ${name} (Instinct roll ${roll} vs DC ${dc}): ${
        success ? 'SUCCESS' : 'FAILURE'
      }${heatCost > 0 ? ` (+${heatCost} Heat)` : ''}`
    );
  };

  // FTL Emergency Jump
  const handleJump = () => {
    if (ship.pearls <= 0) {
      alert('No Quantum Pearls remaining! Travel through the Veil is lethal without a Pearl.');
      return;
    }
    const nextPearls = ship.pearls - 1;
    setShip({ ...ship, pearls: nextPearls });
    onSendActionLog(
      `${characterName} initiates FTL Jump! One Quantum Pearl burned in the crossing. Stasis bubble wraps the ship in 90 seconds of stilled time.`
    );
  };

  // Class Actions in Ship Combat (Chapter 17)
  const handleClassAction = (actionName: string, detail: string) => {
    onSendActionLog(`${characterName} executes Class Ship Action: "${actionName}" - ${detail}`);
  };

  const isHeatCritical = ship.heat > ship.heatCap;

  return (
    <div className="flex flex-col h-full bg-[#080a10] border border-[#1b2333] overflow-y-auto p-2.5 space-y-2.5 text-xs select-none font-mono relative">
      {/* Corner Brackets */}
      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500 z-10" />

      {/* TOP HEADER: ▲ SHIP / TACTICAL STATION */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1b2332]">
        <div className="flex items-center space-x-2">
          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold tracking-wider text-[10px] flex items-center gap-1 rounded-sm">
            <span className="text-[8px]">▲</span> SHIP
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-bold tracking-wider text-[10px]">
            TACTICAL STATION
          </span>
        </div>
        <span className="text-[9px] text-cyan-400 font-bold">MR ×{ship.mountRating}</span>
      </div>

      {/* Ship Banner */}
      <div className="bg-[#0b0e14] p-2.5 rounded-xs border border-[#1d273a] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-xs bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Rocket className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-100">{ship.name}</span>
              <span className="text-[9px] text-slate-400 block">{ship.hullClass}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-cyan-300 font-bold text-[10px]">EVASION: {ship.evasion}</span>
            <span className="text-[8px] text-slate-400 block">RANGE: {ship.rangeBand}</span>
          </div>
        </div>

        {/* Hull & Heat Status Bars */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          {/* Hull Integrity */}
          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-emerald-400 font-bold">Hull: {ship.hull}/{ship.maxHull}</span>
              {ship.hull <= 2 && <span className="text-[9px] text-rose-400 font-bold animate-pulse">DYING</span>}
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(ship.hull / ship.maxHull) * 100}%` }}
              />
            </div>
            {isGM && (
              <div className="flex space-x-1 mt-1.5">
                <button
                  onClick={() => setShip({ ...ship, hull: Math.max(0, ship.hull - 1) })}
                  className="flex-1 py-0.5 bg-slate-800 hover:bg-rose-950 text-slate-200 rounded font-mono font-bold"
                >
                  -1
                </button>
                <button
                  onClick={() => setShip({ ...ship, hull: Math.min(ship.maxHull, ship.hull + 1) })}
                  className="flex-1 py-0.5 bg-slate-800 hover:bg-emerald-950 text-slate-200 rounded font-mono font-bold"
                >
                  +1
                </button>
              </div>
            )}
          </div>

          {/* Thermal Heat */}
          <div className={`bg-slate-900 p-2 rounded-lg border ${isHeatCritical ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className={`font-bold flex items-center space-x-1 ${isHeatCritical ? 'text-rose-400' : 'text-amber-400'}`}>
                <Flame className="w-3 h-3 text-amber-500" />
                <span>Heat: {ship.heat}/{ship.heatCap}</span>
              </span>
              {isHeatCritical && <span className="text-[9px] text-rose-400 font-bold animate-pulse">OVERHEAT!</span>}
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${isHeatCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (ship.heat / ship.heatCap) * 100)}%` }}
              />
            </div>
            {isGM && (
              <div className="flex space-x-1 mt-1.5">
                <button
                  onClick={() => setShip({ ...ship, heat: Math.max(0, ship.heat - 1) })}
                  className="flex-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-mono font-bold"
                >
                  -1
                </button>
                <button
                  onClick={() => setShip({ ...ship, heat: ship.heat + 1 })}
                  className="flex-1 py-0.5 bg-slate-800 hover:bg-amber-950 text-slate-200 rounded font-mono font-bold"
                >
                  +1
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Four Shield Arcs (Fore, Aft, Port, Starboard) */}
      <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-cyan-300 uppercase flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Shield Array (Armor Slots by Arc)</span>
          </span>
          <button
            onClick={handleEndOfRound}
            className="px-2 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/40 text-[10px] flex items-center space-x-1"
            title="End of Round: Regenerates 2 Slots per arc and cools 1 Heat"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Regen (+2 Arcs)</span>
          </button>
        </div>

        {/* 4 Arc Compass Layout */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <div />
          {/* Fore Arc */}
          <div
            onClick={() => setTargetArc('fore')}
            className={`p-1.5 rounded-lg border cursor-pointer transition ${
              targetArc === 'fore' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            <div className="font-bold">FORE</div>
            <div className="font-mono text-xs">{ship.shieldArcs.fore} / {ship.shieldArcs.maxPerArc}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReinforceArc('fore');
              }}
              className="text-[9px] text-cyan-400 hover:underline mt-0.5 block w-full"
            >
              +2 Boost
            </button>
          </div>
          <div />

          {/* Port Arc */}
          <div
            onClick={() => setTargetArc('port')}
            className={`p-1.5 rounded-lg border cursor-pointer transition ${
              targetArc === 'port' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            <div className="font-bold">PORT</div>
            <div className="font-mono text-xs">{ship.shieldArcs.port} / {ship.shieldArcs.maxPerArc}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReinforceArc('port');
              }}
              className="text-[9px] text-cyan-400 hover:underline mt-0.5 block w-full"
            >
              +2 Boost
            </button>
          </div>

          {/* Ship center icon & Quantum Pearls */}
          <div className="flex flex-col items-center justify-center p-1 bg-slate-950 rounded border border-slate-800">
            <Radio className="w-4 h-4 text-indigo-400 mb-0.5" />
            <span className="text-[9px] text-amber-300 font-bold">{ship.pearls} Pearls</span>
          </div>

          {/* Starboard Arc */}
          <div
            onClick={() => setTargetArc('starboard')}
            className={`p-1.5 rounded-lg border cursor-pointer transition ${
              targetArc === 'starboard' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            <div className="font-bold">STBD</div>
            <div className="font-mono text-xs">{ship.shieldArcs.starboard} / {ship.shieldArcs.maxPerArc}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReinforceArc('starboard');
              }}
              className="text-[9px] text-cyan-400 hover:underline mt-0.5 block w-full"
            >
              +2 Boost
            </button>
          </div>

          <div />
          {/* Aft Arc */}
          <div
            onClick={() => setTargetArc('aft')}
            className={`p-1.5 rounded-lg border cursor-pointer transition ${
              targetArc === 'aft' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            <div className="font-bold">AFT</div>
            <div className="font-mono text-xs">{ship.shieldArcs.aft} / {ship.shieldArcs.maxPerArc}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReinforceArc('aft');
              }}
              className="text-[9px] text-cyan-400 hover:underline mt-0.5 block w-full"
            >
              +2 Boost
            </button>
          </div>
          <div />
        </div>
      </div>

      {/* Engineer Heat Management */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
        <span className="text-[11px] font-bold text-slate-300 uppercase block">
          Engineer Console
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCoolSystems}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-200 text-left transition"
          >
            <div className="font-bold text-indigo-300">Cool Systems</div>
            <div className="text-[9px] text-slate-400">Dissipates 3 Heat</div>
          </button>
          <button
            onClick={handleVentHeat}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-200 text-left transition"
          >
            <div className="font-bold text-amber-300">Vent Core (-5 Heat)</div>
            <div className="text-[9px] text-slate-400">Dumps 5 Heat, ship Visible</div>
          </button>
        </div>
      </div>

      {/* Pilot Tactical Maneuvers */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
        <span className="text-[11px] font-bold text-slate-300 uppercase block">
          Pilot Maneuver Controls
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleManeuver('Close Range', 10)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 text-left text-[10px] text-slate-200"
          >
            <span className="font-bold text-cyan-300 block">Close Range</span>
            <span>Move 1 band inward (DC 10)</span>
          </button>
          <button
            onClick={() => handleManeuver('Evasive Pattern', 10)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 text-left text-[10px] text-slate-200"
          >
            <span className="font-bold text-cyan-300 block">Evasive Pattern</span>
            <span>+2 Evasion this round (DC 10)</span>
          </button>
          <button
            onClick={() => handleManeuver('Flanking Run', 15)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 text-left text-[10px] text-slate-200"
          >
            <span className="font-bold text-cyan-300 block">Flanking (DC 15)</span>
            <span>Advantage on target arc</span>
          </button>
          <button
            onClick={() => handleManeuver('Disengage', 10)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 text-left text-[10px] text-slate-200"
          >
            <span className="font-bold text-cyan-300 block">Disengage (DC 10)</span>
            <span>Open 1 range band</span>
          </button>
        </div>

        {/* FTL Emergency Jump Button */}
        <button
          onClick={handleJump}
          className="w-full mt-2 py-2 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white font-bold rounded-lg shadow flex items-center justify-center space-x-1.5 transition text-xs"
        >
          <Compass className="w-4 h-4 text-amber-300" />
          <span>Burn Quantum Pearl & Emergency Jump</span>
        </button>
      </div>

      {/* Class Actions in Ship Combat (Chapter 17) */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
        <span className="text-[11px] font-bold text-indigo-300 uppercase block">
          Class Actions in Naval Combat (Chapter 17)
        </span>
        <div className="space-y-1.5 text-[10px]">
          <button
            onClick={() => handleClassAction('Fire Discipline', 'Enemy arc counts as 2 Slots lower, and first Hull hit adds character Proficiency!')}
            className="w-full p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-slate-200 flex justify-between"
          >
            <span className="font-bold text-rose-300">Soldier: Fire Discipline</span>
            <span className="text-slate-400">1 Stress</span>
          </button>
          <button
            onClick={() => handleClassAction('Thread the Needle', 'Cancels enemy advantage or moves to any arc ignoring shield regen')}
            className="w-full p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-slate-200 flex justify-between"
          >
            <span className="font-bold text-cyan-300">Pilot: Thread the Needle</span>
            <span className="text-slate-400">1 Stress</span>
          </button>
          <button
            onClick={() => handleClassAction('Overclock a System', 'Weapons fire twice / Drives move 2 bands / Shields half damage')}
            className="w-full p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-slate-200 flex justify-between"
          >
            <span className="font-bold text-emerald-300">Engineer: Overclock</span>
            <span className="text-slate-400">1 Stress + 2 Heat</span>
          </button>
          <button
            onClick={() => handleClassAction('Read the Enemy', 'Reveals lowest arc / Heat state / weak point. Crew gains Advantage')}
            className="w-full p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-slate-200 flex justify-between"
          >
            <span className="font-bold text-amber-300">Scholar: Read the Enemy</span>
            <span className="text-slate-400">1 Stress</span>
          </button>
          <button
            onClick={() => handleClassAction('Veil-Sight', 'Foresee enemy move, deal 2d8 Neural directly, or restore 1 system Integrity')}
            className="w-full p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-slate-200 flex justify-between"
          >
            <span className="font-bold text-purple-300">Mystic: Veil-Sight</span>
            <span className="text-slate-400">1 Stress + 1 Hope</span>
          </button>
        </div>
      </div>
    </div>
  );
};
