import React, { useState } from 'react';
import type { Token, ConditionType, CharacterPath } from '../../types/vtt';
import { X, Trash2, Copy, Shield, Heart, EyeOff } from 'lucide-react';

interface TokenModalProps {
  token: Partial<Token>;
  isNew?: boolean;
  onSave: (token: Token) => void;
  onDelete?: (tokenId: string) => void;
  onDuplicate?: (token: Token) => void;
  onClose: () => void;
}

const AVAILABLE_CONDITIONS: ConditionType[] = [
  'Dazed',
  'Vulnerable',
  'Stunned',
  'Bleeding',
  'On Fire',
  'Restrained',
  'Prone',
  'Hidden',
  'Incapacitated',
  'Infected',
  'Confused',
  'Frightened',
  'Weakened',
  'Cornered',
  'Silenced',
];

export const TokenModal: React.FC<TokenModalProps> = ({
  token,
  isNew = false,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}) => {
  const [name, setName] = useState(token.name || 'New Voidwalker');
  const [color, setColor] = useState(token.color || '#6366f1');
  const [avatarUrl, setAvatarUrl] = useState<string>(token.avatarUrl || '');
  const [size, setSize] = useState<number>(token.size || 1);
  const [rotation, setRotation] = useState<number>(token.rotation || 0);
  const [path, setPath] = useState<CharacterPath>(token.path || 'awakened');

  // Defenses
  const [hp, setHp] = useState<number>(token.hp ?? 6);
  const [maxHp, setMaxHp] = useState<number>(token.maxHp ?? 6);
  const [majorThreshold, setMajorThreshold] = useState<number>(token.majorThreshold ?? 5);
  const [severeThreshold, setSevereThreshold] = useState<number>(token.severeThreshold ?? 11);
  const [armorSlots, setArmorSlots] = useState<number>(token.armorSlots ?? 3);
  const [maxArmorSlots, setMaxArmorSlots] = useState<number>(token.maxArmorSlots ?? 3);
  const [evasion, setEvasion] = useState<number>(token.evasion ?? 11);
  const [stress, setStress] = useState<number>(token.stress ?? 0);
  const [maxStress, setMaxStress] = useState<number>(token.maxStress ?? 6);

  const [isHidden, setIsHidden] = useState<boolean>(token.isHidden || false);
  const [conditions, setConditions] = useState<ConditionType[]>(token.conditions || []);

  const toggleCondition = (cond: ConditionType) => {
    if (conditions.includes(cond)) {
      setConditions(conditions.filter((c) => c !== cond));
    } else {
      setConditions([...conditions, cond]);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalToken: Token = {
      id: token.id || 'token-' + Date.now(),
      name,
      x: token.x ?? 400,
      y: token.y ?? 350,
      size,
      rotation,
      color,
      avatarUrl: avatarUrl.trim() || undefined,
      path,
      hp,
      maxHp,
      majorThreshold,
      severeThreshold,
      armorSlots,
      maxArmorSlots,
      evasion,
      stress,
      maxStress,
      hope: token.hope ?? 2,
      effort: token.effort ?? 2,
      effortTrack: token.effortTrack ?? 0,
      resolve: token.resolve ?? 2,
      maxResolve: token.maxResolve ?? 2,
      conditions,
      isHidden,
      ownerId: token.ownerId,
      elevation: token.elevation || 0,
      isNpc: token.isNpc ?? false,
    };
    onSave(finalToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block border border-white/50"
              style={{ backgroundColor: color }}
            />
            <span>{isNew ? 'Create New Token' : `Edit: ${name}`}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Name, Color & Path */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3">
              <label className="text-slate-400 block mb-1 font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Path</label>
              <select
                value={path}
                onChange={(e) => setPath(e.target.value as CharacterPath)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1.5 text-slate-200 text-[11px]"
              >
                <option value="awakened">Awakened</option>
                <option value="sleeping">Sleeping</option>
              </select>
            </div>
          </div>

          {/* Token Portrait / Avatar */}
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <label className="text-slate-300 font-medium block text-[11px]">
              Token Image / Portrait
            </label>
            <div className="flex items-center space-x-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar Preview"
                  className="w-9 h-9 rounded-full object-cover border-2 border-indigo-500 shrink-0 bg-slate-800"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shrink-0 border border-white/30"
                  style={{ backgroundColor: color }}
                >
                  {name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <input
                type="text"
                placeholder="Image URL or upload below..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
              <label className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer text-xs font-medium border border-slate-700 shrink-0">
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-slate-400 hover:text-rose-400 px-1"
                  title="Remove image"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Size & Rotation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">
                Size ({size}x{size} Grid)
              </label>
              <select
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>1x1 (Standard Person / Drone)</option>
                <option value={2}>2x2 (Large / Small Vehicle)</option>
                <option value={3}>3x3 (Huge)</option>
                <option value={4}>4x4 (Gargantuan / Warframe)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">
                Facing Rotation: {rotation}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="15"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                className="w-full h-1.5 accent-indigo-500 cursor-pointer bg-slate-800 rounded-lg mt-2"
              />
            </div>
          </div>

          {/* Canonical Defenses: HP & Damage Thresholds */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="font-semibold text-emerald-400 flex items-center space-x-1.5">
              <Heart className="w-3.5 h-3.5" />
              <span>Hit Points & Damage Thresholds</span>
            </span>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Current HP</label>
                <input
                  type="number"
                  value={hp}
                  onChange={(e) => setHp(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Max HP</label>
                <input
                  type="number"
                  value={maxHp}
                  onChange={(e) => setMaxHp(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Major Thresh</label>
                <input
                  type="number"
                  value={majorThreshold}
                  onChange={(e) => setMajorThreshold(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Severe Thresh</label>
                <input
                  type="number"
                  value={severeThreshold}
                  onChange={(e) => setSevereThreshold(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Armor Slots, Evasion & Stress */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="font-semibold text-cyan-400 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Armor Slots (Soak), Evasion & Stress</span>
            </span>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Armor Slots</label>
                <input
                  type="number"
                  value={armorSlots}
                  onChange={(e) => setArmorSlots(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Max Slots</label>
                <input
                  type="number"
                  value={maxArmorSlots}
                  onChange={(e) => setMaxArmorSlots(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Evasion DC</label>
                <input
                  type="number"
                  value={evasion}
                  onChange={(e) => setEvasion(parseInt(e.target.value, 10) || 10)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Stress / Max</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={stress}
                    onChange={(e) => setStress(parseInt(e.target.value, 10) || 0)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-slate-200 font-mono"
                  />
                  <span className="text-slate-500">/</span>
                  <input
                    type="number"
                    value={maxStress}
                    onChange={(e) => setMaxStress(parseInt(e.target.value, 10) || 1)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="text-slate-400 block mb-1.5 font-medium">
              Conditions & Tactical Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_CONDITIONS.map((cond) => {
                const active = conditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    className={`px-2 py-1 rounded-md text-xs font-medium border transition ${
                      active
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {cond}
                  </button>
                );
              })}
            </div>
          </div>

          {/* GM Stealth / Hidden Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              <EyeOff className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-medium text-slate-200">Hidden from Players</div>
                <div className="text-[10px] text-slate-400">Only visible to the Keeper</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isHidden}
              onChange={(e) => setIsHidden(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="flex space-x-2">
              {!isNew && token.id && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(token.id!);
                    onClose();
                  }}
                  className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition"
                  title="Delete Token"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {!isNew && token.id && onDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    const cloned: Token = {
                      ...(token as Token),
                      id: 'token-' + Date.now(),
                      x: (token.x || 300) + 50,
                      y: (token.y || 300) + 50,
                      name: `${name} (Copy)`,
                    };
                    onDuplicate(cloned);
                    onClose();
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                  title="Duplicate Token"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-md shadow-indigo-600/30 transition"
              >
                {isNew ? 'Create Token' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
