import React, { useState } from 'react';
import type { Token } from '../../types/vtt';
import { X, Trash2, Copy, Shield, Sparkles, EyeOff } from 'lucide-react';

interface TokenModalProps {
  token: Partial<Token>;
  isNew?: boolean;
  onSave: (token: Token) => void;
  onDelete?: (tokenId: string) => void;
  onDuplicate?: (token: Token) => void;
  onClose: () => void;
}

const AVAILABLE_CONDITIONS = [
  'Veil-Touched',
  'Stunned',
  'Blinded',
  'Prone',
  'Invisible',
  'Charmed',
  'Frightened',
  'Exhausted',
  'Shielded',
];

export const TokenModal: React.FC<TokenModalProps> = ({
  token,
  isNew = false,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}) => {
  const [name, setName] = useState(token.name || 'New Veilfarer');
  const [color, setColor] = useState(token.color || '#6366f1');
  const [size, setSize] = useState<number>(token.size || 1);
  const [hp, setHp] = useState<number>(token.hp ?? 20);
  const [maxHp, setMaxHp] = useState<number>(token.maxHp ?? 20);
  const [aether, setAether] = useState<number>(token.aether ?? 10);
  const [maxAether, setMaxAether] = useState<number>(token.maxAether ?? 10);
  const [rotation, setRotation] = useState<number>(token.rotation || 0);
  const [isHidden, setIsHidden] = useState<boolean>(token.isHidden || false);
  const [conditions, setConditions] = useState<string[]>(token.conditions || []);

  const toggleCondition = (cond: string) => {
    if (conditions.includes(cond)) {
      setConditions(conditions.filter((c) => c !== cond));
    } else {
      setConditions([...conditions, cond]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalToken: Token = {
      id: token.id || 'token-' + Date.now(),
      name,
      x: token.x ?? 300,
      y: token.y ?? 300,
      size,
      rotation,
      color,
      hp,
      maxHp,
      aether,
      maxAether,
      conditions,
      isHidden,
      ownerId: token.ownerId,
      elevation: token.elevation || 0,
      initiative: token.initiative,
    };
    onSave(finalToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Name & Color */}
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-3">
              <label className="text-slate-400 block mb-1 font-medium">Token Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
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
                <option value={1}>1x1 (Medium / Normal)</option>
                <option value={2}>2x2 (Large)</option>
                <option value={3}>3x3 (Huge)</option>
                <option value={4}>4x4 (Gargantuan)</option>
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

          {/* HP and Aether */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <div>
              <div className="flex items-center space-x-1 text-emerald-400 font-medium mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Health (HP)</span>
              </div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  value={hp}
                  onChange={(e) => setHp(parseInt(e.target.value, 10) || 0)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-slate-200"
                />
                <span className="text-slate-500">/</span>
                <input
                  type="number"
                  value={maxHp}
                  onChange={(e) => setMaxHp(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-slate-200"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-1 text-cyan-400 font-medium mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Aether / Mana</span>
              </div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  value={aether}
                  onChange={(e) => setAether(parseInt(e.target.value, 10) || 0)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-slate-200"
                />
                <span className="text-slate-500">/</span>
                <input
                  type="number"
                  value={maxAether}
                  onChange={(e) => setMaxAether(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="text-slate-400 block mb-1.5 font-medium">Conditions & Status</label>
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
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
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
                <div className="text-[10px] text-slate-400">Only visible to the Game Master</div>
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
