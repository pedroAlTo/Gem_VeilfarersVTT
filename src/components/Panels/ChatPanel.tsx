import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, UserRole, CharacterPath, DualityRollResult } from '../../types/vtt';
import { rollDuality } from '../../services/dice';
import { Send, Sparkles, Shield, AlertTriangle, CheckCircle, Skull, Heart, Terminal } from 'lucide-react';

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
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-xs bg-amber-500 text-slate-950 font-black text-[9px] tracking-wider uppercase shadow-[0_0_8px_rgba(245,158,11,0.6)]">
            <Sparkles className="w-3 h-3 text-slate-950" />
            <span>CRITICAL SUCCESS (DOUBLES MATCH!)</span>
          </div>
        );
      case 'success_hope':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-xs bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold text-[9px] tracking-wider uppercase">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>SUCCESS WITH HOPE (+1 RESOURCE)</span>
          </div>
        );
      case 'success_fear':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-xs bg-amber-500/20 border border-amber-500 text-amber-300 font-bold text-[9px] tracking-wider uppercase">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>SUCCESS WITH FEAR (+1 KEEPER FEAR)</span>
          </div>
        );
      case 'failure_hope':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-xs bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-bold text-[9px] tracking-wider uppercase">
            <CheckCircle className="w-3 h-3 text-cyan-400" />
            <span>FAILURE WITH HOPE (OPENING REMAINS)</span>
          </div>
        );
      case 'failure_fear':
        return (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-xs bg-rose-500/20 border border-rose-500 text-rose-300 font-bold text-[9px] tracking-wider uppercase">
            <Skull className="w-3 h-3 text-rose-500" />
            <span>FAILURE WITH FEAR (+1 KEEPER FEAR)</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080a10] border border-[#1b2333] select-none font-mono relative">
      {/* Corner Brackets */}
      <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500 z-10" />
      <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500 z-10" />

      {/* TOP HEADER: ▲ TRML / TERMINAL & LINK-01 */}
      <div className="p-2.5 border-b border-[#1b2333] bg-[#0c1018] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold tracking-wider text-[10px] flex items-center gap-1 rounded-sm">
            <span className="text-[8px]">▲</span> TRML
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-bold tracking-wider text-[10px]">
            LINK-01 COMMS
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[9px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>CONNECTED</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-2.5 overflow-y-auto space-y-2 select-text text-xs">
        {messages.length === 0 && (
          <div className="text-center py-6 text-slate-600 text-[10px] space-y-1">
            <Terminal className="w-5 h-5 mx-auto opacity-30 text-emerald-400" />
            <p>[ TERMINAL READY // DUALITY PROTOCOL ACTIVE ]</p>
            <p className="text-[9px] text-slate-700">Type a message or &apos;/r instinct 15&apos; to roll</p>
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
                className="bg-[#0b0e15] border border-[#1d273a] rounded-sm p-2 shadow-md space-y-1.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    {msg.senderRole === 'gm' && (
                      <span className="px-1 py-0.2 rounded-xs bg-amber-500 text-slate-950 font-black text-[8px]">
                        KEEPER
                      </span>
                    )}
                    <span className="text-slate-200 font-bold">{msg.senderName}</span>
                    <span className="text-[9px] text-slate-500 uppercase">
                      ({rd.path})
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[9px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Roll Label */}
                {rd.label && (
                  <div className="text-[10px] font-bold text-amber-400">{rd.label}</div>
                )}

                {/* Duality Dice Cards (Hope & Fear) */}
                <div className="bg-[#0e131d] p-2 rounded-xs border border-[#1b2434] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Hope Die */}
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-xs bg-amber-500 border border-amber-300 flex items-center justify-center text-slate-950 font-black text-sm shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                        {rd.hopeDie}
                      </div>
                      <span className="text-[8px] font-bold text-amber-400 mt-0.5">HOPE</span>
                    </div>

                    <span className="text-slate-600 font-bold">+</span>

                    {/* Fear Die */}
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-xs bg-slate-950 border border-rose-500 flex items-center justify-center text-rose-400 font-black text-sm shadow-[0_0_6px_rgba(244,63,94,0.3)]">
                        {rd.fearDie}
                      </div>
                      <span className="text-[8px] font-bold text-rose-500 mt-0.5">FEAR</span>
                    </div>

                    {/* Modifiers breakdown */}
                    <div className="text-[9px] text-slate-400 font-mono pl-1">
                      {rd.traitModifier !== 0 && (
                        <div>Trait: {rd.traitModifier >= 0 ? `+${rd.traitModifier}` : rd.traitModifier}</div>
                      )}
                      {Boolean(rd.experienceBonus) && (
                        <div className="text-cyan-400">Exp: +{rd.experienceBonus}</div>
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
                    <div className="text-xl font-black font-mono tracking-tight text-slate-100">
                      {rd.total}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">DC {rd.dc}</div>
                  </div>
                </div>

                {/* Outcome Banner */}
                <div>{renderOutcomeBadge(rd.outcome)}</div>

                {/* Damage Dealt Banner */}
                {rd.damageDealt && (
                  <div className="p-1.5 rounded-xs bg-[#120a10] border border-rose-900/50 text-[10px] space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 font-bold flex items-center space-x-1">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>DAMAGE: {rd.damageDealt.rawTotal} ({rd.damageDealt.damageType})</span>
                      </span>
                      <span className="px-1 py-0.2 rounded-xs bg-rose-950 text-rose-300 font-bold text-[9px]">
                        {rd.damageDealt.severity.toUpperCase()} ({rd.damageDealt.hpLoss} HP)
                      </span>
                    </div>
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
              <div className="flex items-center space-x-1 text-[9px] text-slate-500 mb-0.5">
                {msg.senderRole === 'gm' && (
                  <Shield className="w-2.5 h-2.5 text-amber-500 inline" />
                )}
                <span className="font-bold text-slate-400">{msg.senderName}</span>
                <span>•</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={`px-2.5 py-1.5 rounded-sm max-w-[85%] text-[11px] leading-relaxed break-words font-mono ${
                  isMe
                    ? 'bg-amber-500/15 border border-amber-500/40 text-amber-100'
                    : 'bg-[#101520] border border-[#1d273a] text-slate-200'
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Command Line Prompt (Terminal style) */}
      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-[#1b2333] bg-[#0a0d14] flex items-center space-x-1.5"
      >
        <span className="text-emerald-400 text-xs font-bold pl-1">&gt;</span>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter command or message..."
          className="flex-1 bg-[#10141f] border border-[#1e273a] focus:border-amber-500 rounded-xs px-2.5 py-1 text-slate-100 placeholder-slate-600 text-xs font-mono outline-hidden transition"
        />
        <button
          type="submit"
          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xs text-xs transition flex items-center space-x-1"
        >
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};
