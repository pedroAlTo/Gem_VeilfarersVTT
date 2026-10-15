import { useState, useEffect, useCallback } from 'react';
import type {
  ActiveTool,
  ChatMessage,
  DiceRollResult,
  DrawingPath,
  FogOfWarData,
  MapData,
  PingMarker,
  Player,
  Token,
  UserRole,
  VTTUser,
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
import { ChatPanel } from './components/Panels/ChatPanel';
import { DiceTrayPanel } from './components/Panels/DiceTrayPanel';
import { InitiativeTracker } from './components/Panels/InitiativeTracker';
import { CharacterSheetPanel } from './components/Panels/CharacterSheetPanel';
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
    const colors = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
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
  const [round, setRound] = useState<number>(1);
  const [activeInitiativeTokenId, setActiveInitiativeTokenId] = useState<string | undefined>();

  // 4. Chat & Players Synchronized State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePings, setActivePings] = useState<PingMarker[]>([]);

  // 5. Active Tools & UI Panels
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [activeTab, setActiveTab] = useState<'chat' | 'dice' | 'initiative' | 'sheet'>('chat');
  const [drawColor, setDrawColor] = useState<string>('#c084fc');
  const [brushSize, setBrushSize] = useState<number>(4);

  // 6. Modals
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
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
      if (remote.initiativeRound !== undefined) setRound(remote.initiativeRound);
      if (remote.activeInitiativeTokenId !== undefined)
        setActiveInitiativeTokenId(remote.activeInitiativeTokenId);
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
    const currentName = currentUser?.displayName || 'Veilfarer ' + roomId.slice(-3);
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

  // Dice roll from panel/sheet
  const handleDiceRoll = useCallback(
    (result: DiceRollResult) => {
      const senderName = currentUser?.displayName || 'Veilfarer';
      const senderId = currentUser?.uid || 'guest';

      handleSendMessage({
        senderId,
        senderName,
        senderRole: userRole,
        timestamp: Date.now(),
        content: `rolled ${result.formula}`,
        type: 'roll',
        rollDetails: result,
      });
    },
    [currentUser, userRole, handleSendMessage]
  );

  // Initiative Next Turn
  const handleNextTurn = useCallback(() => {
    const list = Object.values(tokens)
      .filter((t) => !t.isHidden || userRole === 'gm')
      .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));

    if (list.length === 0) return;

    const currentIndex = list.findIndex((t) => t.id === activeInitiativeTokenId);
    let nextIndex = currentIndex + 1;
    let nextRound = round;

    if (nextIndex >= list.length || currentIndex === -1) {
      nextIndex = 0;
      nextRound = round + 1;
      setRound(nextRound);
    }

    const nextActiveId = list[nextIndex].id;
    setActiveInitiativeTokenId(nextActiveId);
    updateRoomState(roomId, {
      initiativeRound: nextRound,
      activeInitiativeTokenId: nextActiveId,
    });
  }, [tokens, activeInitiativeTokenId, round, userRole, roomId]);

  const handleResetInitiative = useCallback(() => {
    setRound(1);
    setActiveInitiativeTokenId(undefined);
    updateRoomState(roomId, {
      initiativeRound: 1,
      activeInitiativeTokenId: undefined,
    });
  }, [roomId]);

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

  const currentDisplayName = currentUser?.displayName || 'Veil Explorer';

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        user={currentUser}
        userRole={userRole}
        onChangeRole={setUserRole}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        players={players}
      />

      {/* Main Tabletop Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Floating Toolbar on Canvas */}
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
                name: 'New Veilfarer',
                color: userColor,
                x: 400,
                y: 350,
                size: 1,
                hp: 30,
                maxHp: 30,
                aether: 10,
                maxAether: 10,
              },
              isNew: true,
            })
          }
          onOpenMapModal={() => setIsMapModalOpen(true)}
          onClearDrawings={handleClearDrawings}
          fogEnabled={fog.enabled}
          onToggleFog={handleToggleFog}
        />

        {/* The Interactive Canvas */}
        <div className="flex-1 h-full relative">
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
          />
        </div>

        {/* Right Sidebar Panels */}
        <aside className="w-80 md:w-96 h-full bg-slate-950/95 border-l border-slate-800/80 flex flex-col z-20 shadow-2xl backdrop-blur-md">
          {activeTab === 'chat' && (
            <ChatPanel
              messages={messages}
              currentUserId={currentUser?.uid || 'guest'}
              currentUserName={currentDisplayName}
              currentUserRole={userRole}
              onSendMessage={handleSendMessage}
            />
          )}

          {activeTab === 'dice' && (
            <DiceTrayPanel
              onRoll={handleDiceRoll}
              characterName={currentDisplayName}
            />
          )}

          {activeTab === 'initiative' && (
            <InitiativeTracker
              tokens={tokens}
              activeTokenId={activeInitiativeTokenId}
              round={round}
              userRole={userRole}
              onUpdateTokens={handleUpdateTokens}
              onNextTurn={handleNextTurn}
              onResetInitiative={handleResetInitiative}
              onSelectToken={(t) => setSelectedToken(t)}
            />
          )}

          {activeTab === 'sheet' && (
            <CharacterSheetPanel
              onRoll={handleDiceRoll}
              characterName={currentDisplayName}
            />
          )}
        </aside>
      </div>

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
