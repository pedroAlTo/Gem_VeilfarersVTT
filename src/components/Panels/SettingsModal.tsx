import React, { useState } from 'react';
import {
  getFirebaseConfig,
  isFirebaseConfigured,
  saveFirebaseConfig,
} from '../../services/firebase';
import { sounds } from '../../services/audio';
import { X, Flame, Volume2, VolumeX, ShieldCheck, AlertTriangle, Key, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  roomId?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, roomId }) => {
  const currentConfig = getFirebaseConfig();
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');

  const [muted, setMuted] = useState(sounds.isMuted());
  const isConfigured = isFirebaseConfigured();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveFirebaseConfig({
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    });
  };

  const handleClear = () => {
    localStorage.removeItem('VEILFARERS_FIREBASE_CONFIG');
    window.location.reload();
  };

  const toggleSound = () => {
    const next = !muted;
    sounds.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
            <Flame className="w-5 h-5 text-indigo-400" />
            <span>VTT Settings & Cloud Integration</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status Badge */}
          <div
            className={`p-3.5 rounded-xl border flex items-center space-x-3 ${
              isConfigured
                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
            }`}
          >
            {isConfigured ? (
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            )}
            <div>
              <div className="font-semibold text-slate-200">
                {isConfigured ? 'Firebase & Google Auth Active' : 'Running in Offline / Demo Mode'}
                {roomId && <span className="ml-2 font-mono text-[10px] text-indigo-400">({roomId})</span>}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {isConfigured
                  ? 'All room data, tokens, and messages sync through Firebase Cloud Firestore.'
                  : 'You can test everything in your browser. To enable live multiplayer sync & Google sign-in across different computers, provide your Firebase keys below or in your Netlify site variables.'}
              </div>
            </div>
          </div>

          {/* Sound Preferences */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {muted ? (
                <VolumeX className="w-5 h-5 text-slate-500" />
              ) : (
                <Volume2 className="w-5 h-5 text-indigo-400" />
              )}
              <div>
                <span className="font-semibold text-slate-200 block">Sound Effects</span>
                <span className="text-[11px] text-slate-400">
                  Synthesized dice rolling, natural 20 fanfares, and radar pings
                </span>
              </div>
            </div>
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                muted
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
              }`}
            >
              {muted ? 'Muted' : 'Enabled'}
            </button>
          </div>

          {/* Firebase Configuration Form */}
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Firebase Project Credentials</span>
              </label>
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 text-[11px]"
              >
                <span>Firebase Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">API Key</label>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Project ID</label>
                <input
                  type="text"
                  placeholder="veilfarers-vtt"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Auth Domain</label>
                <input
                  type="text"
                  placeholder="project.firebaseapp.com"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Storage Bucket</label>
                <input
                  type="text"
                  placeholder="project.appspot.com"
                  value={storageBucket}
                  onChange={(e) => setStorageBucket(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Messaging Sender ID</label>
                <input
                  type="text"
                  placeholder="1234567890"
                  value={messagingSenderId}
                  onChange={(e) => setMessagingSenderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">App ID</label>
                <input
                  type="text"
                  placeholder="1:1234567890:web:abcdef"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-400 hover:text-rose-300 transition"
              >
                Reset to Demo Mode
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-sm shadow-indigo-600/30 transition"
              >
                Save & Connect Firebase
              </button>
            </div>
          </form>

          {/* Netlify Deployment Guide info */}
          <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Netlify Hosting Configuration</div>
            <p>
              When hosting on Netlify, add the Firebase variables from <code>.env.example</code> to:
            </p>
            <p className="font-mono text-indigo-300">
              Netlify Dashboard &rarr; Site configuration &rarr; Environment variables
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
