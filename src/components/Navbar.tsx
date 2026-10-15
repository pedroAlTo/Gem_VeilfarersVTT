import React, { useState } from 'react';
import type { Player, UserRole, VTTUser } from '../types/vtt';
import { loginWithGoogle, logoutUser, loginAsGuest } from '../services/firebase';
import {
  Flame,
  Copy,
  Check,
  Settings,
  MessageSquare,
  Dices,
  Swords,
  User,
  Shield,
  LogOut,
  LogIn,
} from 'lucide-react';

interface NavbarProps {
  roomId: string;
  user: VTTUser | null;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeTab: 'chat' | 'dice' | 'initiative' | 'sheet';
  onChangeTab: (tab: 'chat' | 'dice' | 'initiative' | 'sheet') => void;
  onOpenSettings: () => void;
  players: Player[];
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  user,
  userRole,
  onChangeRole,
  activeTab,
  onChangeTab,
  onOpenSettings,
  players,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);

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
      await loginAsGuest('Veil Explorer');
      setShowAuthMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-14 bg-slate-950/95 border-b border-slate-800/80 px-4 flex items-center justify-between z-30 select-none backdrop-blur-md">
      {/* Brand & Room Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Flame className="w-5 h-5 text-white animate-pulse-subtle" />
          </div>
          <span className="font-extrabold tracking-tight text-slate-100 text-sm hidden sm:inline">
            VEILFARERS <span className="text-indigo-400 font-light">VTT</span>
          </span>
        </div>

        {/* Room Code & Copy Link */}
        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-slate-400">Room:</span>
          <span className="font-mono font-bold text-slate-200">{roomId}</span>
          <button
            onClick={copyInvite}
            className="p-1 hover:text-indigo-400 text-slate-400 transition"
            title="Copy Invite Link"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Role Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => onChangeRole('gm')}
            className={`px-2 py-0.5 rounded font-medium flex items-center space-x-1 transition ${
              userRole === 'gm'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>GM</span>
          </button>
          <button
            onClick={() => onChangeRole('player')}
            className={`px-2 py-0.5 rounded font-medium transition ${
              userRole === 'player'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Player
          </button>
        </div>
      </div>

      {/* Center: Connected Players Roster */}
      <div className="hidden md:flex items-center space-x-1.5 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-800">
        <span className="text-[10px] text-slate-400 font-medium">Party:</span>
        <div className="flex -space-x-1.5">
          {players.map((p) => (
            <div
              key={p.id}
              className="w-6 h-6 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: p.color }}
              title={`${p.name} (${p.role.toUpperCase()})`}
            >
              {p.name.substring(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Right Controls: Panel Tabs, Settings, User Login */}
      <div className="flex items-center space-x-2">
        {/* Panel Tab Selectors */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onChangeTab('chat')}
            className={`p-1.5 rounded transition ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Party Chat & Roll Log"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChangeTab('dice')}
            className={`p-1.5 rounded transition ${
              activeTab === 'dice'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Dice Tray"
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChangeTab('initiative')}
            className={`p-1.5 rounded transition ${
              activeTab === 'initiative'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Combat Tracker"
          >
            <Swords className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChangeTab('sheet')}
            className={`p-1.5 rounded transition ${
              activeTab === 'sheet'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Veilfarer Character Sheet"
          >
            <User className="w-4 h-4" />
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          title="VTT & Firebase Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Auth Profile / Login */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setShowAuthMenu(!showAuthMenu)}
              className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 pr-2 hover:border-slate-700 transition"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {user.displayName.substring(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-slate-200 font-medium max-w-[100px] truncate hidden sm:inline">
                {user.displayName}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthMenu(!showAuthMenu)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}

          {/* Auth Dropdown */}
          {showAuthMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
              {user ? (
                <>
                  <div className="p-2 border-b border-slate-800">
                    <div className="font-semibold text-slate-100 truncate">{user.displayName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user.email || 'Guest Explorer'}</div>
                  </div>
                  <button
                    onClick={() => {
                      logoutUser();
                      setShowAuthMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 text-rose-400 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="p-2 text-slate-400 text-[11px] border-b border-slate-800">
                    Sign in with Google to sync sessions and tokens across devices:
                  </div>
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 text-slate-200 rounded-lg transition font-medium"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google Sign In</span>
                  </button>
                  <button
                    onClick={handleGuestLogin}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
                  >
                    <span>Play as Guest</span>
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
