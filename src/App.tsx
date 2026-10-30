import { useState, useEffect, useCallback } from 'react';
import type {
  ActiveTool,
  ChatMessage,
  DualityRollResult,
  DrawingPath,
  FogOfWarData,
  MapData,
  PingMarker,
  Player,
  Token,
  UserRole,
  VTTUser,
  ProgressClock,
} from './types/vtt';
import { DEFAULT_MAPS } from './data/defaultMaps';
import { DEFAULT_TOKENS } from './data/defaultTokens';
import {
  subscribeToAuth,
  subscribeToRoom,
  updateRoomState,
  subscribeToMessages,
  sendChatMessage,
  subscribeToPlayers,
  setPlayerPresence,
} from './services/firebase';
import { Navbar } from './components/Navbar';
import { TabletopCanvas } from './components/Tabletop/TabletopCanvas';
import { Toolbar } from './components/Tabletop/Toolbar';
import { ProgressClocks } from './components/Tabletop/ProgressClocks';
import { ChatPanel } from './components/Panels/ChatPanel';
import { DiceTrayPanel } from './components/Panels/DiceTrayPanel';
import { InitiativeTracker } from './components/Panels/InitiativeTracker';
import { CharacterSheetPanel } from './components/Panels/CharacterSheetPanel';
import { StarshipPanel } from './components/Panels/StarshipPanel';
import { RulesCompendiumModal } from './components/Panels/RulesCompendiumModal';
import { MapSelectorModal } from './components/Tabletop/MapSelectorModal';
import { TokenModal } from './components/Tabletop/TokenModal';
import { SettingsModal } from './components/Panels/SettingsModal';

export function App() {
  // 1. Room ID Resolution
  const [roomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get('room');
    if (existing) return existing;
    const generated = 'veil-' + Math.random().toString(36).substring(2, 7);
    window.history.replaceState({}, '', `?room=${generated}`);
    return generated;
  });

  // 2. User & Auth State
  const [currentUser, setCurrentUser] = useState<VTTUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('gm');
  const [userColor] = useState<string>(() => {
    const colors = ['#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  // 3. Room Synchronized State
  const [activeMap, setActiveMap] = useState<MapData>(DEFAULT_MAPS[0]);
  const [tokens, setTokens] = useState<Record<string, Token>>(() => {
    const record: Record<string, Token> = {};
    DEFAULT_TOKENS.forEach((t) => (record[t.id] = t));
    return record;
  });
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [fog, setFog] = useState<FogOfWarData>({ enabled: false, reveals: [] });

  // Canonical Spotlight & Round Management
  const [round, setRound] = useState<number>(1);
  const [activeSpotlightTokenId, setActiveSpotlightTokenId] = useState<string | undefined>('token-maren');
  const [actedThisRound, setActedThisRound] = useState<string[]>([]);

  // Canonical Global Pools: Keeper Fear (0-12) & Crew Criminal Heat (0-10)
  const [keeperFear, setKeeperFear] = useState<number>(4);
  const [crewHeat, setCrewHeat] = useState<number>(0);

  // Progress Clocks (4, 6, 8, 10, 12 segment tension trackers)
  const [clocks, setClocks] = useState<ProgressClock[]>(() => {
    const saved = localStorage.getItem(`VEILFARERS_CLOCKS_${roomId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      { id: 'clock-alarm', name: 'Station Alarm', segments: 4, progress: 1, color: '#f59e0b' },
      { id: 'clock-breach', name: 'Void Fracture', segments: 6, progress: 2, color: '#a855f7' },
    ];
  });
  const [isClocksOpen, setIsClocksOpen] = useState<boolean>(true);

  // 4. Chat & Players Synchronized State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePings, setActivePings] = useState<PingMarker[]>([]);

  // 5. Active Tools & UI Panels
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [activeTab, setActiveTab] = useState<'initiative' | 'chat' | 'dice' | 'sheet' | 'ship'>('initiative');
  const [drawColor, setDrawColor] = useState<string>('#f59e0b');
  const [brushSize, setBrushSize] = useState<number>(4);

  // 6. Modals
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [isCompendiumOpen, setIsCompendiumOpen] = useState<boolean>(false);
  const [tokenModalData, setTokenModalData] = useState<{
    token: Partial<Token>;
    isNew: boolean;
  } | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [, setSelectedToken] = useState<Token | null>(null);

  // Listen to Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Room updates
  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomId, (remote) => {
      if (remote.activeMap) setActiveMap(remote.activeMap);
      if (remote.tokens) setTokens(remote.tokens);
      if (remote.drawings) setDrawings(remote.drawings);
      if (remote.fog) setFog(remote.fog);
      if (remote.clocks) setClocks(remote.clocks);
      if (remote.round !== undefined) setRound(remote.round);
      if (remote.activeSpotlightTokenId !== undefined)
        setActiveSpotlightTokenId(remote.activeSpotlightTokenId);
      if (remote.actedThisRound !== undefined)
        setActedThisRound(remote.actedThisRound);
      if (remote.keeperFear !== undefined)
        setKeeperFear(remote.keeperFear);
      if (remote.crewHeat !== undefined)
        setCrewHeat(remote.crewHeat);
    });
    return () => unsubscribe();
  }, [roomId]);

  // Listen to Chat Messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(roomId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [roomId]);

  // Listen to Players Presence
  useEffect(() => {
    const unsubscribe = subscribeToPlayers(roomId, (list) => {
      setPlayers(list);
    });
    return () => unsubscribe();
  }, [roomId]);

  // Broadcast current player presence
  useEffect(() => {
    const currentName = currentUser?.displayName || 'Voidwalker ' + roomId.slice(-3);
    const myUid = currentUser?.uid || 'guest-' + roomId;

    const myPlayer: Player = {
      id: myUid,
      name: currentName,
      role: userRole,
      color: userColor,
      isOnline: true,
    };

    setPlayerPresence(roomId, myPlayer);
  }, [roomId, currentUser, userRole, userColor]);

  // Clean expired pings
  useEffect(() => {
    if (activePings.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setActivePings((prev) => prev.filter((p) => now - p.timestamp < 3500));
    }, 1000);
    return () => clearInterval(interval);
  }, [activePings]);

  // Handlers for Updating Room Data
  const handleUpdateTokens = useCallback(
    (newTokens: Record<string, Token>) => {
      setTokens(newTokens);
      updateRoomState(roomId, { tokens: newTokens });
    },
    [roomId]
  );

  const handleAddDrawing = useCallback(
    (drawing: DrawingPath) => {
      setDrawings((prev) => {
        const next = [...prev, drawing];
        updateRoomState(roomId, { drawings: next });
        return next;
      });
    },
    [roomId]
  );

  const handleClearDrawings = useCallback(() => {
    setDrawings([]);
    updateRoomState(roomId, { drawings: [] });
  }, [roomId]);

  const handleUpdateFog = useCallback(
    (newFog: FogOfWarData) => {
      setFog(newFog);
      updateRoomState(roomId, { fog: newFog });
    },
    [roomId]
  );

  const handleToggleFog = useCallback(() => {
    setFog((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      updateRoomState(roomId, { fog: next });
      return next;
    });
  }, [roomId]);

  const handleSelectMap = useCallback(
    (newMap: MapData) => {
      setActiveMap(newMap);
      updateRoomState(roomId, { activeMap: newMap });
    },
    [roomId]
  );

  const handleUpdateClocks = useCallback(
    (newClocks: ProgressClock[]) => {
      setClocks(newClocks);
      localStorage.setItem(`VEILFARERS_CLOCKS_${roomId}`, JSON.stringify(newClocks));
      updateRoomState(roomId, { clocks: newClocks });
    },
    [roomId]
  );

  const handleDropImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          const testImg = new Image();
          testImg.onload = () => {
            const newMap: MapData = {
              id: 'custom-' + Date.now(),
              name: file.name.replace(/\.[^/.]+$/, ''),
              imageUrl: dataUrl,
              width: testImg.naturalWidth || 2400,
              height: testImg.naturalHeight || 1800,
              grid: activeMap.grid,
            };
            handleSelectMap(newMap);
          };
          testImg.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    },
    [activeMap.grid, handleSelectMap]
  );

  // Ping Trigger
  const handleTriggerPing = useCallback((ping: PingMarker) => {
    setActivePings((prev) => [...prev, ping]);
  }, []);

  // Chat message sender
  const handleSendMessage = useCallback(
    (msg: Omit<ChatMessage, 'id'>) => {
      sendChatMessage(roomId, msg);
    },
    [roomId]
  );

  // Duality Dice Roll from panel/sheet
  const handleDualityRoll = useCallback(
    (result: DualityRollResult) => {
      const senderName = currentUser?.displayName || 'Voidwalker';
      const senderId = currentUser?.uid || 'guest';

      // If Fear-dominant, increase Keeper Fear (max 12)
      if (result.outcome === 'success_fear' || result.outcome === 'failure_fear') {
        const nextFear = Math.min(12, keeperFear + 1);
        setKeeperFear(nextFear);
        updateRoomState(roomId, { keeperFear: nextFear });
      }

      handleSendMessage({
        senderId,
        senderName,
        senderRole: userRole,
        timestamp: Date.now(),
        content: `rolled Duality Dice: [${result.hopeDie} Hope | ${result.fearDie} Fear] = ${result.total}`,
        type: 'roll',
        rollDetails: result,
      });
    },
    [currentUser, userRole, keeperFear, roomId, handleSendMessage]
  );

  // Dynamic Spotlight Passing (Veilfarers 12.06)
  const handlePassSpotlight = useCallback(
    (tokenId: string) => {
      setActiveSpotlightTokenId(tokenId);
      const nextActed = actedThisRound.includes(tokenId) ? actedThisRound : [...actedThisRound, tokenId];
      setActedThisRound(nextActed);
      updateRoomState(roomId, {
        activeSpotlightTokenId: tokenId,
        actedThisRound: nextActed,
      });
    },
    [actedThisRound, roomId]
  );

  const handleNextRound = useCallback(() => {
    const nextRound = round + 1;
    setRound(nextRound);
    setActedThisRound([]);
    updateRoomState(roomId, {
      round: nextRound,
      actedThisRound: [],
    });
  }, [round, roomId]);

  const handleResetEncounter = useCallback(() => {
    setRound(1);
    setActedThisRound([]);
    setActiveSpotlightTokenId(undefined);
    updateRoomState(roomId, {
      round: 1,
      actedThisRound: [],
      activeSpotlightTokenId: undefined,
    });
  }, [roomId]);

  const handleUpdateKeeperFear = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(12, val));
      setKeeperFear(clamped);
      updateRoomState(roomId, { keeperFear: clamped });
    },
    [roomId]
  );

  const handleUpdateCrewHeat = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(10, val));
      setCrewHeat(clamped);
      updateRoomState(roomId, { crewHeat: clamped });
    },
    [roomId]
  );

  // Token Modal Save
  const handleSaveToken = useCallback(
    (token: Token) => {
      const updated = { ...tokens, [token.id]: token };
      handleUpdateTokens(updated);
    },
    [tokens, handleUpdateTokens]
  );

  const handleDeleteToken = useCallback(
    (tokenId: string) => {
      const updated = { ...tokens };
      delete updated[tokenId];
      handleUpdateTokens(updated);
    },
    [tokens, handleUpdateTokens]
  );

  const currentDisplayName = currentUser?.displayName || 'Voidwalker';

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#06080d] text-slate-100 font-mono select-none">
      {/* 1. TOP HUD CONSOLE RACK (▲ PWR-C, CH-1, Chronometer, Keeper Fear, Crew Heat) */}
      <Navbar
        roomId={roomId}
        user={currentUser}
        userRole={userRole}
        onChangeRole={setUserRole}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenCompendium={() => setIsCompendiumOpen(true)}
        players={players}
        keeperFear={keeperFear}
        crewHeat={crewHeat}
      />

      {/* 2. MAIN TABLETOP WORKSPACE */}
      <div className="flex-1 relative flex overflow-hidden bg-[#06080d]">
        {/* Center Tabletop Canvas Viewport */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#07090f]">
          {/* Floating Toolbar on Canvas (Top-Left) */}
          <Toolbar
            activeTool={activeTool}
            onChangeTool={setActiveTool}
            userRole={userRole}
            drawColor={drawColor}
            onChangeDrawColor={setDrawColor}
            brushSize={brushSize}
            onChangeBrushSize={setBrushSize}
            onOpenNewTokenModal={() =>
              setTokenModalData({
                token: {
                  name: 'New Voidwalker',
                  color: userColor,
                  x: 400,
                  y: 350,
                  size: 1,
                  hp: 6,
                  maxHp: 6,
                  majorThreshold: 5,
                  severeThreshold: 11,
                  armorSlots: 3,
                  maxArmorSlots: 3,
                  evasion: 11,
                  stress: 0,
                  maxStress: 6,
                  path: 'awakened',
                  hope: 2,
                },
                isNew: true,
              })
            }
            onOpenMapModal={() => setIsMapModalOpen(true)}
            onClearDrawings={handleClearDrawings}
            fogEnabled={fog.enabled}
            onToggleFog={handleToggleFog}
            onToggleClocks={() => setIsClocksOpen(!isClocksOpen)}
            clocksOpen={isClocksOpen}
          />

          <TabletopCanvas
            mapData={activeMap}
            tokens={tokens}
            drawings={drawings}
            fog={fog}
            userRole={userRole}
            userName={currentDisplayName}
            userColor={userColor}
            activeTool={activeTool}
            brushSize={brushSize}
            drawColor={drawColor}
            onUpdateTokens={handleUpdateTokens}
            onAddDrawing={handleAddDrawing}
            onUpdateFog={handleUpdateFog}
            onTriggerPing={handleTriggerPing}
            onSelectToken={setSelectedToken}
            onEditToken={(t) => setTokenModalData({ token: t, isNew: false })}
            activePings={activePings}
            onDropImage={handleDropImage}
          />

          {/* Floating Progress Clocks Widget (Top-Right) */}
          {isClocksOpen && (
            <div className="absolute top-4 right-4 z-20">
              <ProgressClocks
                clocks={clocks}
                onUpdateClocks={handleUpdateClocks}
                userRole={userRole}
                onClose={() => setIsClocksOpen(false)}
              />
            </div>
          )}
        </main>

        {/* RIGHT SIDECAR: TELEMETRY, COMBAT, DICE, HERO SHEET & STARSHIP */}
        <aside className="w-80 md:w-96 shrink-0 h-full border-l border-[#1c2434] bg-[#0a0d14] flex flex-col z-10 shadow-2xl overflow-hidden">
          {/* Main Upper Telemetry Viewport */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'initiative' && (
              <InitiativeTracker
                tokens={tokens}
                activeTokenId={activeSpotlightTokenId}
                round={round}
                actedThisRound={actedThisRound}
                userRole={userRole}
                keeperFear={keeperFear}
                crewHeat={crewHeat}
                onUpdateTokens={handleUpdateTokens}
                onPassSpotlight={handlePassSpotlight}
                onNextRound={handleNextRound}
                onResetEncounter={handleResetEncounter}
                onUpdateKeeperFear={handleUpdateKeeperFear}
                onUpdateCrewHeat={handleUpdateCrewHeat}
                onSelectToken={(t) => setSelectedToken(t)}
                clocks={clocks}
                onUpdateClocks={handleUpdateClocks}
              />
            )}

            {activeTab === 'chat' && (
              <ChatPanel
                messages={messages}
                currentUserId={currentUser?.uid || 'guest'}
                currentUserName={currentDisplayName}
                currentUserRole={userRole}
                currentPath="awakened"
                onSendMessage={handleSendMessage}
              />
            )}

            {activeTab === 'dice' && (
              <DiceTrayPanel
                onRoll={handleDualityRoll}
                characterName={currentDisplayName}
                path="awakened"
              />
            )}

            {activeTab === 'sheet' && (
              <CharacterSheetPanel
                onRoll={handleDualityRoll}
                characterName={currentDisplayName}
              />
            )}

            {activeTab === 'ship' && (
              <StarshipPanel
                userRole={userRole}
                characterName={currentDisplayName}
                path="awakened"
                onSendActionLog={(content) =>
                  handleSendMessage({
                    senderId: currentUser?.uid || 'guest',
                    senderName: currentDisplayName,
                    senderRole: userRole,
                    timestamp: Date.now(),
                    content,
                    type: 'chat',
                  })
                }
              />
            )}
          </div>
        </aside>
      </div>

      {/* 3. MODALS */}
      {/* Rules Compendium Modal */}
      {isCompendiumOpen && (
        <RulesCompendiumModal onClose={() => setIsCompendiumOpen(false)} />
      )}

      {/* Map Selector Modal */}
      {isMapModalOpen && (
        <MapSelectorModal
          currentMap={activeMap}
          onSelectMap={handleSelectMap}
          onClose={() => setIsMapModalOpen(false)}
        />
      )}

      {/* Token Creator / Editor Modal */}
      {tokenModalData && (
        <TokenModal
          token={tokenModalData.token}
          isNew={tokenModalData.isNew}
          onSave={handleSaveToken}
          onDelete={handleDeleteToken}
          onDuplicate={handleSaveToken}
          onClose={() => setTokenModalData(null)}
        />
      )}

      {/* Settings & Firebase Modal */}
      {isSettingsModalOpen && (
        <SettingsModal
          roomId={roomId}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
