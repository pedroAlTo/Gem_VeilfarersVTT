import React, { useState, useEffect } from 'react';
import type { Player, UserRole, VTTUser } from '../types/vtt';
import { loginWithGoogle, logoutUser, loginAsGuest } from '../services/firebase';
import {
  Copy,
  Check,
  Settings,
  MessageSquare,
  Dices,
  Swords,
  User,
  LogOut,
  LogIn,
  BookOpen,
  Rocket,
} from 'lucide-react';

interface NavbarProps {
  roomId: string;
  user: VTTUser | null;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeTab: 'chat' | 'dice' | 'initiative' | 'sheet' | 'ship';
  onChangeTab: (tab: 'chat' | 'dice' | 'initiative' | 'sheet' | 'ship') => void;
  onOpenSettings: () => void;
  onOpenCompendium: () => void;
  players: Player[];
  keeperFear: number;
  crewHeat: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  user,
  userRole,
  onChangeRole,
  activeTab,
  onChangeTab,
  onOpenSettings,
  onOpenCompendium,
  players,
  keeperFear,
  crewHeat,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [timestamp, setTimestamp] = useState('00:01:12:031');

  // Sci-fi microsecond ticking chronometer like the reference image
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
      setTimestamp(`00:${h}:${m}:${s}:${ms}`);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const copyInvite = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      setShowAuthMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await loginAsGuest('Voidwalker');
      setShowAuthMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-13 bg-[#0a0c10] border-b border-[#1c2330] px-3.5 flex items-center justify-between z-30 select-none font-mono text-xs">
      {/* LEFT CLUSTER: PWR-C Rack, Channel Button, Room ID */}
      <div className="flex items-center space-x-2.5">
        {/* PWR-C Label & Brand */}
        <div className="flex items-center space-x-2 bg-[#10141c] border border-[#222c3d] px-2.5 py-1 rounded">
          <span className="text-[10px] text-amber-500 font-bold tracking-widest flex items-center gap-1">
            <span className="text-[8px]">▲</span> PWR-C
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-extrabold text-slate-200 tracking-wider text-[11px]">
            VEILFARERS <span className="text-amber-500 text-[10px] font-normal">v12.06</span>
          </span>
        </div>

        {/* Lit Channel Amber Button (from screenshot 'CH-1') */}
        <div className="hidden sm:flex items-center bg-[#10141c] border border-[#232c3d] p-0.5 rounded">
          <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider rounded-sm shadow-[0_0_8px_rgba(245,158,11,0.4)]">
            CH-1
          </span>
          <span className="px-2 py-0.5 text-slate-400 text-[9px] tracking-wider font-semibold">
            REC
          </span>
          <span className="px-1.5 py-0.5 text-slate-500 text-[9px]">
            LVL
          </span>
        </div>

        {/* Room Code with Copy Link */}
        <div className="flex items-center space-x-1.5 bg-[#10141c] border border-[#222c3d] px-2 py-1 rounded text-[11px]">
          <span className="text-slate-500 text-[10px]">ROOM:</span>
          <span className="font-bold text-amber-400 tracking-wider">{roomId}</span>
          <button
            onClick={copyInvite}
            className="p-0.5 hover:text-amber-300 text-slate-400 transition ml-0.5"
            title="Copy Invite Link"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Role Switcher: Keeper vs Player */}
        <div className="hidden md:flex bg-[#10141c] border border-[#232c3d] p-0.5 rounded text-[10px]">
          <button
            onClick={() => onChangeRole('gm')}
            className={`px-2 py-0.5 rounded-sm font-bold tracking-wider transition ${
              userRole === 'gm'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ▲ KEEPER
          </button>
          <button
            onClick={() => onChangeRole('player')}
            className={`px-2 py-0.5 rounded-sm font-bold tracking-wider transition ${
              userRole === 'player'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PLAYER
          </button>
        </div>
      </div>

      {/* CENTER CLUSTER: Amber Chronometer & Telemetry Indicators */}
      <div className="hidden xl:flex items-center space-x-3 bg-[#0d1017] border border-[#1e2634] px-3.5 py-1 rounded">
        {/* Chrono Counter (from screenshot) */}
        <div className="flex items-center space-x-1.5 text-amber-400 font-bold tracking-widest text-[11px]">
          <span className="text-[8px] text-amber-500">▲</span>
          <span className="text-telemetry-amber font-mono">{timestamp}</span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Keeper Fear Pool */}
        <div className="flex items-center space-x-1 text-[11px]" title="Keeper Fear Pool (Cap 12)">
          <span className="text-rose-400 font-bold tracking-wider">▲ FEAR:</span>
          <span className="px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-800 text-rose-300 font-black">
            {String(keeperFear).padStart(2, '0')}/12
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Criminal Heat */}
        <div className="flex items-center space-x-1 text-[11px]" title="Crew Criminal Heat (0-10)">
          <span className="text-amber-400 font-bold tracking-wider">▲ HEAT:</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-700 text-amber-300 font-black">
            {String(crewHeat).padStart(2, '0')}/10
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Active Party */}
        <div className="flex items-center space-x-1.5 text-[10px]">
          <span className="text-slate-500">CREW:</span>
          <div className="flex -space-x-1">
            {players.map((p) => (
              <div
                key={p.id}
                className="w-5 h-5 rounded-sm border border-[#0d1017] flex items-center justify-center text-[9px] font-black text-slate-950 shadow"
                style={{ backgroundColor: p.color }}
                title={`${p.name} (${p.role.toUpperCase()})`}
              >
                {p.name.substring(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT CLUSTER: Tactical Function Buttons & User Profile */}
      <div className="flex items-center space-x-2">
        {/* Function Modules (CHAT, 2D12, SPTL, SHEET, NAV) */}
        <div className="flex bg-[#10141c] border border-[#222c3d] p-0.5 rounded">
          <button
            onClick={() => onChangeTab('chat')}
            className={`px-2 py-1 rounded-sm font-bold text-[10px] tracking-wider transition flex items-center space-x-1 ${
              activeTab === 'chat'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Party Log & Duality Rolls"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">LOG</span>
          </button>
          <button
            onClick={() => onChangeTab('dice')}
            className={`px-2 py-1 rounded-sm font-bold text-[10px] tracking-wider transition flex items-center space-x-1 ${
              activeTab === 'dice'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Duality Dice Launcher"
          >
            <Dices className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2D12</span>
          </button>
          <button
            onClick={() => onChangeTab('initiative')}
            className={`px-2 py-1 rounded-sm font-bold text-[10px] tracking-wider transition flex items-center space-x-1 ${
              activeTab === 'initiative'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Spotlight & Combat Tracker"
          >
            <Swords className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SPTL</span>
          </button>
          <button
            onClick={() => onChangeTab('sheet')}
            className={`px-2 py-1 rounded-sm font-bold text-[10px] tracking-wider transition flex items-center space-x-1 ${
              activeTab === 'sheet'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Character Dossier"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CHAR</span>
          </button>
          <button
            onClick={() => onChangeTab('ship')}
            className={`px-2 py-1 rounded-sm font-bold text-[10px] tracking-wider transition flex items-center space-x-1 ${
              activeTab === 'ship'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Starship Operations (Chapter 17)"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SHIP</span>
          </button>
        </div>

        {/* Compendium Rules Button */}
        <button
          onClick={onOpenCompendium}
          className="p-1.5 bg-[#10141c] border border-[#222c3d] text-slate-400 hover:text-amber-400 hover:border-amber-500/50 rounded transition"
          title="Veilfarers 12.06 Rules Compendium"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 bg-[#10141c] border border-[#222c3d] text-slate-400 hover:text-slate-200 hover:border-slate-600 rounded transition"
          title="Terminal Settings & Cloud Sync"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* User Auth Profile (Rightmost Green/Amber Pill) */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setShowAuthMenu(!showAuthMenu)}
              className="flex items-center space-x-1.5 bg-[#10141c] border border-[#222c3d] p-1 pr-2 hover:border-amber-500/60 rounded transition"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-5 h-5 rounded-sm object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-sm bg-amber-500 text-slate-950 flex items-center justify-center font-black text-[10px]">
                  {user.displayName.substring(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] text-slate-200 font-bold max-w-[90px] truncate hidden sm:inline">
                {user.displayName}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthMenu(!showAuthMenu)}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black tracking-wider rounded shadow-[0_0_8px_rgba(245,158,11,0.3)] flex items-center space-x-1 transition"
            >
              <LogIn className="w-3 h-3" />
              <span>AUTH</span>
            </button>
          )}

          {/* Auth Dropdown */}
          {showAuthMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-[#0e1219] border border-amber-500/40 rounded shadow-2xl p-2 z-50 text-xs space-y-1">
              {user ? (
                <>
                  <div className="p-2 border-b border-[#222c3d]">
                    <div className="font-bold text-amber-300 truncate">{user.displayName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user.email || 'Voidwalker'}</div>
                  </div>
                  <button
                    onClick={() => {
                      logoutUser();
                      setShowAuthMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-[#18202c] text-rose-400 rounded transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="p-2 text-slate-400 text-[10px] border-b border-[#222c3d]">
                    Authenticate with Google credentials:
                  </div>
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-[#18202c] text-slate-200 rounded transition font-bold"
                  >
                    <span>Google Sign In</span>
                  </button>
                  <button
                    onClick={handleGuestLogin}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-[#18202c] text-slate-400 hover:text-slate-200 rounded transition"
                  >
                    <span>Guest Mode</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
