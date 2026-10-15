import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, UserRole } from '../../types/vtt';
import { rollDice } from '../../services/dice';
import { Send, Sparkles, Shield, Flame } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  onSendMessage: (msg: Omit<ChatMessage, 'id'>) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  currentUserName,
  currentUserRole,
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

    // Check for /r or /roll command
    if (text.startsWith('/r ') || text.startsWith('/roll ')) {
      const formula = text.replace(/^\/(?:r|roll)\s+/, '');
      const result = rollDice(formula, {
        label: `${currentUserName} rolled ${formula}`,
      });

      onSendMessage({
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        timestamp: Date.now(),
        content: `rolled ${formula}`,
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

  return (
    <div className="flex flex-col h-full bg-slate-900/60 select-none">
      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 select-text">
        {messages.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40 text-indigo-400" />
            <p>The Veil is silent. Say something or roll dice!</p>
            <p className="text-[10px] text-slate-600 mt-1">Tip: Use &apos;/r 1d20+4&apos; to roll from chat</p>
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
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 shadow-md space-y-2"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1.5 font-medium">
                    {msg.senderRole === 'gm' && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold text-[9px] border border-indigo-800/60">
                        GM
                      </span>
                    )}
                    <span className="text-slate-200">{msg.senderName}</span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Roll Label */}
                {rd.label && (
                  <div className="text-xs font-semibold text-slate-300">{rd.label}</div>
                )}

                {/* Roll Result Hero */}
                <div className="flex items-center justify-between bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">{rd.formula}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {rd.dice.map((d, i) => (
                        <span
                          key={i}
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                            d.dropped
                              ? 'line-through opacity-40 bg-slate-800 border-slate-700 text-slate-500'
                              : d.value === d.sides
                              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold'
                              : d.value === 1
                              ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-200'
                          }`}
                        >
                          {d.value}
                        </span>
                      ))}
                      {rd.modifier !== 0 && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          {rd.modifier > 0 ? `+${rd.modifier}` : rd.modifier}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Big Total */}
                  <div className="text-right pl-3">
                    <span
                      className={`text-2xl font-black font-mono tracking-tight ${
                        rd.isCritSuccess
                          ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                          : rd.isCritFail
                          ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                          : 'text-indigo-300'
                      }`}
                    >
                      {rd.total}
                    </span>
                    {rd.isCritSuccess && (
                      <span className="block text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                        CRITICAL!
                      </span>
                    )}
                    {rd.isCritFail && (
                      <span className="block text-[9px] font-bold text-rose-400 uppercase tracking-widest">
                        FUMBLE!
                      </span>
                    )}
                  </div>
                </div>

                {/* Veil Strain Warning */}
                {Boolean(rd.veilStrain) && (
                  <div className="flex items-center space-x-1.5 text-[10px] text-purple-400 bg-purple-950/40 px-2 py-1 rounded border border-purple-800/40">
                    <Flame className="w-3 h-3 text-purple-400" />
                    <span>Veil Strain pushed! +1 Corruption gained.</span>
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
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            placeholder="Type message or /r 1d20+5..."
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
