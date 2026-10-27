import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, UserRole, CharacterPath, DualityRollResult } from '../../types/vtt';
import { rollDuality } from '../../services/dice';
import { Send, Sparkles, Shield, AlertTriangle, CheckCircle, Skull, Heart } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  currentPath?: CharacterPath;
  onSendMessage: (msg: Omit<ChatMessage, 'id'>) => void;
  onApplyPathResource?: (gain: 'hope' | 'fear') => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentPath = 'awakened',
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    // Check for roll command (e.g. /r instinct 15 or /roll)
    if (text.startsWith('/r') || text.startsWith('/roll')) {
      const parts = text.split(' ').slice(1);
      const traitName = parts[0] || 'instinct';
      const dc = parts[1] ? parseInt(parts[1], 10) : 15;

      const result = rollDuality({
        characterName: currentUserName,
        path: currentPath,
        traitName: traitName.toUpperCase(),
        traitModifier: 1,
        dc,
        label: `${currentUserName} rolls ${traitName.toUpperCase()} vs DC ${dc}`,
      });

      onSendMessage({
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        timestamp: Date.now(),
        content: `rolled Duality Dice for ${traitName}`,
        type: 'roll',
        rollDetails: result,
      });
      setInputText('');
      return;
    }

    // Standard chat message
    onSendMessage({
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      timestamp: Date.now(),
      content: text,
      type: 'chat',
    });
    setInputText('');
  };

  const renderOutcomeBadge = (outcome: DualityRollResult['outcome']) => {
    switch (outcome) {
      case 'critical_success':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>CRITICAL SUCCESS (DOUBLES MATCH!)</span>
          </div>
        );
      case 'success_hope':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-bold text-[10px] tracking-wider uppercase">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Success with Hope (+1 Path Resource)</span>
          </div>
        );
      case 'success_fear':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-600 text-amber-300 font-bold text-[10px] tracking-wider uppercase">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Success with Fear (+1 Keeper Fear)</span>
          </div>
        );
      case 'failure_hope':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500 text-sky-300 font-bold text-[10px] tracking-wider uppercase">
            <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Failure with Hope (Opening Remains)</span>
          </div>
        );
      case 'failure_fear':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-600 text-rose-300 font-bold text-[10px] tracking-wider uppercase">
            <Skull className="w-3.5 h-3.5 text-rose-500" />
            <span>Failure with Fear (+1 Keeper Fear)</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 select-none">
      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 select-text">
        {messages.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40 text-indigo-400" />
            <p>The Stellar Veil hums quietly. Roll Duality Dice or speak!</p>
            <p className="text-[10px] text-slate-600 mt-1">
              Tip: Use &apos;/r instinct 15&apos; to roll from chat
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          const isRoll = msg.type === 'roll' && msg.rollDetails;

          if (isRoll && msg.rollDetails) {
            const rd = msg.rollDetails;
            return (
              <div
                key={msg.id}
                className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-2.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1.5 font-medium">
                    {msg.senderRole === 'gm' && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-bold text-[9px] border border-indigo-800/60">
                        KEEPER
                      </span>
                    )}
                    <span className="text-slate-200">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      ({rd.path})
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Roll Label */}
                {rd.label && (
                  <div className="text-xs font-semibold text-slate-300">{rd.label}</div>
                )}

                {/* Duality Dice Cards (Hope & Fear Display) */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Hope Die */}
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 flex items-center justify-center text-slate-950 font-black text-sm shadow">
                        {rd.hopeDie}
                      </div>
                      <span className="text-[9px] font-bold text-amber-300 mt-0.5">HOPE</span>
                    </div>

                    <span className="text-slate-500 font-bold">+</span>

                    {/* Fear Die */}
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-700 to-slate-950 border border-rose-500 flex items-center justify-center text-rose-100 font-black text-sm shadow">
                        {rd.fearDie}
                      </div>
                      <span className="text-[9px] font-bold text-rose-400 mt-0.5">FEAR</span>
                    </div>

                    {/* Modifiers breakdown */}
                    <div className="text-[10px] text-slate-400 font-mono ml-1">
                      {rd.traitModifier !== 0 && (
                        <div>Trait: {rd.traitModifier >= 0 ? `+${rd.traitModifier}` : rd.traitModifier}</div>
                      )}
                      {Boolean(rd.experienceBonus) && (
                        <div className="text-indigo-400">Exp: +{rd.experienceBonus}</div>
                      )}
                      {Boolean(rd.advantageModifier) && (
                        <div className={rd.advantageModifier! > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {rd.advantageType}: {rd.advantageModifier! > 0 ? `+${rd.advantageModifier}` : rd.advantageModifier}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total vs DC */}
                  <div className="text-right">
                    <div className="text-2xl font-black font-mono tracking-tight text-slate-100">
                      {rd.total}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">vs DC {rd.dc}</div>
                  </div>
                </div>

                {/* Outcome Banner */}
                <div>{renderOutcomeBadge(rd.outcome)}</div>

                {/* Weapon Damage Box if Present */}
                {rd.damageDealt && (
                  <div className="p-2 rounded-lg bg-slate-950 border border-rose-900/40 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-300 font-bold flex items-center space-x-1">
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        <span>Damage: {rd.damageDealt.rawTotal} ({rd.damageDealt.damageType})</span>
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-bold text-[10px]">
                        Severity: {rd.damageDealt.severity} ({rd.damageDealt.hpLoss} HP marked)
                      </span>
                    </div>
                    {rd.damageDealt.penetration !== 0 && (
                      <div className="text-[10px] text-slate-400">
                        Penetration: {rd.damageDealt.penetration} to target thresholds
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Standard Chat Message
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1 text-[10px] text-slate-400 mb-0.5">
                {msg.senderRole === 'gm' && (
                  <Shield className="w-3 h-3 text-indigo-400 inline" />
                )}
                <span className="font-medium text-slate-300">{msg.senderName}</span>
                <span className="text-slate-500 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs break-words ${
                  isMe
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60'
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-950/90">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Type message or /r instinct 15..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30 transition flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
