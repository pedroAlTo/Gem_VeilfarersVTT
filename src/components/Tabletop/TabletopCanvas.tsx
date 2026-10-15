import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  ActiveTool,
  DrawingPath,
  DrawingPoint,
  MapData,
  PingMarker,
  Token,
  UserRole,
  FogOfWarData,
} from '../../types/vtt';
import { drawProceduralMap } from './proceduralMaps';
import { sounds } from '../../services/audio';

interface TabletopCanvasProps {
  mapData: MapData;
  tokens: Record<string, Token>;
  drawings: DrawingPath[];
  fog: FogOfWarData;
  userRole: UserRole;
  userName: string;
  userColor: string;
  activeTool: ActiveTool;
  brushSize: number;
  drawColor: string;
  onUpdateTokens: (tokens: Record<string, Token>) => void;
  onAddDrawing: (drawing: DrawingPath) => void;
  onUpdateFog: (fog: FogOfWarData) => void;
  onTriggerPing: (ping: PingMarker) => void;
  onSelectToken: (token: Token | null) => void;
  onEditToken: (token: Token) => void;
  activePings: PingMarker[];
}

export const TabletopCanvas: React.FC<TabletopCanvasProps> = ({
  mapData,
  tokens,
  drawings,
  fog,
  userRole,
  userName,
  userColor,
  activeTool,
  brushSize,
  drawColor,
  onUpdateTokens,
  onAddDrawing,
  onUpdateFog,
  onTriggerPing,
  onSelectToken,
  onEditToken,
  activePings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport transformation: Pan & Zoom
  const [transform, setTransform] = useState({ x: 100, y: 80, scale: 0.9 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Selected Token & Dragging
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Measurement tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureCurrent, setMeasureCurrent] = useState<{ x: number; y: number } | null>(null);

  // Active Drawing state
  const [currentPath, setCurrentPath] = useState<DrawingPoint[] | null>(null);

  // Map Image loader
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (mapData.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = mapData.imageUrl;
      img.onload = () => setMapImage(img);
    } else {
      setMapImage(null);
    }
  }, [mapData.imageUrl]);

  // Screen to World coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - transform.x) / transform.scale,
        y: (screenY - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  // Find token at world position
  const getTokenAtPosition = useCallback(
    (worldX: number, worldY: number): Token | null => {
      const cellSize = mapData.grid.size;
      const tokenList = Object.values(tokens);

      // Check reverse order so top tokens are picked first
      for (let i = tokenList.length - 1; i >= 0; i--) {
        const token = tokenList[i];
        if (token.isHidden && userRole !== 'gm') continue;

        const radius = (token.size * cellSize) / 2;
        const dx = worldX - token.x;
        const dy = worldY - token.y;
        if (Math.sqrt(dx * dx + dy * dy) <= radius) {
          return token;
        }
      }
      return null;
    },
    [tokens, mapData.grid.size, userRole]
  );

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#080a11';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Apply Pan and Zoom
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // 1. Draw Map (Image or Procedural)
    if (mapImage && mapImage.complete) {
      ctx.drawImage(mapImage, 0, 0, mapData.width, mapData.height);
    } else {
      drawProceduralMap(ctx, mapData.proceduralType || 'sanctum', mapData.width, mapData.height);
    }

    // 2. Draw Grid
    if (mapData.grid.enabled) {
      ctx.save();
      ctx.strokeStyle = mapData.grid.color;
      ctx.globalAlpha = mapData.grid.opacity;
      ctx.lineWidth = 1;

      const sz = mapData.grid.size;
      if (mapData.grid.type === 'square') {
        for (let x = 0; x <= mapData.width; x += sz) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, mapData.height);
          ctx.stroke();
        }
        for (let y = 0; y <= mapData.height; y += sz) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(mapData.width, y);
          ctx.stroke();
        }
      } else {
        // Hexagonal Grid
        const hexRadius = sz / 2;
        const hexHeight = Math.sqrt(3) * hexRadius;
        const hexWidth = 2 * hexRadius;
        const side = (3 / 2) * hexRadius;

        for (let y = 0; y < mapData.height + hexHeight; y += hexHeight) {
          let rowIndex = 0;
          for (let x = 0; x < mapData.width + hexWidth; x += side) {
            const offsetY = (rowIndex % 2 === 1) ? hexHeight / 2 : 0;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const hx = x + hexRadius * Math.cos(angle);
              const hy = (y + offsetY) + hexRadius * Math.sin(angle);
              if (i === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
            rowIndex++;
          }
        }
      }
      ctx.restore();
    }

    // 3. Draw Completed Drawing Paths
    drawings.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 4. Draw Current in-progress Drawing Path
    if (currentPath && currentPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Tokens
    const cellSize = mapData.grid.size;
    Object.values(tokens).forEach((token) => {
      // If hidden and not GM, don't render
      if (token.isHidden && userRole !== 'gm') return;

      const radius = (token.size * cellSize) / 2;
      const isSelected = selectedTokenId === token.id;

      ctx.save();
      ctx.translate(token.x, token.y);
      ctx.rotate((token.rotation * Math.PI) / 180);

      // Hidden indicator (translucent for GM)
      if (token.isHidden) {
        ctx.globalAlpha = 0.55;
      }

      // Outer Selection Ring or Glow
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Token Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(3, 3, radius, 0, Math.PI * 2);
      ctx.fill();

      // Token Body / Base Circle
      ctx.fillStyle = token.color || '#6366f1';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Facing Direction Indicator Notch
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(-5, -radius + 10);
      ctx.lineTo(5, -radius + 10);
      ctx.closePath();
      ctx.fill();

      // Token Initials / Class Icon
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(14, radius * 0.55)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = token.name.substring(0, 2).toUpperCase();
      ctx.fillText(initial, 0, 0);

      ctx.restore(); // Undo rotation for overlays like HP bar and Name

      // Non-rotated Overlays
      ctx.save();
      ctx.translate(token.x, token.y);

      // HP Bar
      if (token.maxHp > 0) {
        const barWidth = radius * 2;
        const barHeight = 6;
        const hpPct = Math.max(0, Math.min(1, token.hp / token.maxHp));

        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-radius, -radius - 14, barWidth, barHeight);

        // HP Fill (Gradient from Green to Red)
        ctx.fillStyle = hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(-radius, -radius - 14, barWidth * hpPct, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-radius, -radius - 14, barWidth, barHeight);
      }

      // Token Name Tag
      ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      const textWidth = ctx.measureText(token.name).width;
      ctx.fillRect(-textWidth / 2 - 4, radius + 4, textWidth + 8, 16);
      ctx.fillStyle = token.isHidden ? '#fca5a5' : '#f1f5f9';
      ctx.fillText(token.name, 0, radius + 16);

      // Condition Badges
      if (token.conditions && token.conditions.length > 0) {
        token.conditions.forEach((cond, idx) => {
          const badgeX = -radius + idx * 12;
          const badgeY = radius + 24;
          ctx.fillStyle = cond === 'Veil-Touched' ? '#c084fc' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    });

    // 6. Draw Fog of War
    if (fog.enabled) {
      ctx.save();
      // Offscreen canvas or composite operation
      // Draw dark veil across entire map
      if (userRole === 'player') {
        // Player sees pitch black shroud except revealed circles
        // We create an inverse cutout mask
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = mapData.width;
        fogCanvas.height = mapData.height;
        const fCtx = fogCanvas.getContext('2d');
        if (fCtx) {
          fCtx.fillStyle = 'rgba(5, 7, 12, 0.98)';
          fCtx.fillRect(0, 0, mapData.width, mapData.height);
          fCtx.globalCompositeOperation = 'destination-out';
          fog.reveals.forEach((r) => {
            fCtx.beginPath();
            fCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            fCtx.fill();
          });
          ctx.drawImage(fogCanvas, 0, 0);
        }
      } else {
        // GM sees translucent fog so GM can see through!
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fillRect(0, 0, mapData.width, mapData.height);

        // Highlight revealed zones with dashed line
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        fog.reveals.forEach((r) => {
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // 7. Measurement Ruler
    if (activeTool === 'measure' && measureStart && measureCurrent) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(measureStart.x, measureStart.y);
      ctx.lineTo(measureCurrent.x, measureCurrent.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const dx = measureCurrent.x - measureStart.x;
      const dy = measureCurrent.y - measureStart.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const cells = (distPx / mapData.grid.size).toFixed(1);
      const feet = (parseFloat(cells) * 5).toFixed(0);

      // Distance tag
      const midX = (measureStart.x + measureCurrent.x) / 2;
      const midY = (measureStart.y + measureCurrent.y) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      const label = `${feet} ft (${cells} cells)`;
      const w = ctx.measureText(label).width;
      ctx.fillRect(midX - w / 2 - 6, midY - 10, w + 12, 20);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(midX - w / 2 - 6, midY - 10, w + 12, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, midX, midY + 4);
      ctx.restore();
    }

    // 8. Pings
    const now = Date.now();
    activePings.forEach((p) => {
      const age = (now - p.timestamp) / 1000;
      if (age < 3.5) {
        ctx.save();
        const pulse = (age * 1.5) % 1;
        const pingRadius = 15 + pulse * 45;
        const alpha = Math.max(0, 1 - age / 3.5);

        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pingRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Sender label
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        const pTag = p.senderName;
        const pw = ctx.measureText(pTag).width;
        ctx.fillRect(p.x - pw / 2 - 4, p.y + 12, pw + 8, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(pTag, p.x, p.y + 24);

        ctx.restore();
      }
    });

    ctx.restore(); // restore viewport transform
    ctx.restore(); // restore dpr
  }, [
    transform,
    mapData,
    tokens,
    drawings,
    fog,
    userRole,
    activeTool,
    brushSize,
    drawColor,
    currentPath,
    selectedTokenId,
    measureStart,
    measureCurrent,
    activePings,
    mapImage,
  ]);

  // Mouse / Pointer Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Pan with middle click, Space pressed, or activeTool === 'pan'
    if (e.button === 1 || activeTool === 'pan' || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      return;
    }

    // Ping tool
    if (activeTool === 'ping') {
      sounds.playPing();
      onTriggerPing({
        id: 'ping-' + Date.now(),
        x: world.x,
        y: world.y,
        senderName: userName,
        color: userColor,
        timestamp: Date.now(),
      });
      return;
    }

    // Measurement tool
    if (activeTool === 'measure') {
      setMeasureStart(world);
      setMeasureCurrent(world);
      return;
    }

    // Freehand Drawing tool
    if (activeTool === 'draw') {
      setCurrentPath([world]);
      return;
    }

    // Fog of War Brush tools
    if (activeTool === 'fog_reveal') {
      const newReveals = [...fog.reveals, { x: world.x, y: world.y, radius: brushSize * 15 }];
      onUpdateFog({ ...fog, reveals: newReveals });
      return;
    }

    if (activeTool === 'fog_hide') {
      // Remove reveals that intersect
      const radius = brushSize * 15;
      const filtered = fog.reveals.filter(
        (r) => Math.hypot(r.x - world.x, r.y - world.y) > radius
      );
      onUpdateFog({ ...fog, reveals: filtered });
      return;
    }

    // Select / Move tool
    if (activeTool === 'select') {
      const hitToken = getTokenAtPosition(world.x, world.y);
      if (hitToken) {
        setSelectedTokenId(hitToken.id);
        onSelectToken(hitToken);
        setDraggingTokenId(hitToken.id);
        setDragOffset({ x: world.x - hitToken.x, y: world.y - hitToken.y });
      } else {
        setSelectedTokenId(null);
        onSelectToken(null);
        // Start canvas pan if clicking empty area
        setIsPanning(true);
        setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    if (activeTool === 'measure' && measureStart) {
      setMeasureCurrent(world);
      return;
    }

    if (activeTool === 'draw' && currentPath) {
      setCurrentPath((prev) => (prev ? [...prev, world] : [world]));
      return;
    }

    if (activeTool === 'fog_reveal' && e.buttons === 1) {
      const newReveals = [...fog.reveals, { x: world.x, y: world.y, radius: brushSize * 15 }];
      onUpdateFog({ ...fog, reveals: newReveals });
      return;
    }

    // Dragging token
    if (draggingTokenId && tokens[draggingTokenId]) {
      const targetX = world.x - dragOffset.x;
      const targetY = world.y - dragOffset.y;

      const updated = {
        ...tokens,
        [draggingTokenId]: {
          ...tokens[draggingTokenId],
          x: targetX,
          y: targetY,
        },
      };
      onUpdateTokens(updated);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (activeTool === 'measure') {
      setMeasureStart(null);
      setMeasureCurrent(null);
    }

    if (activeTool === 'draw' && currentPath && currentPath.length > 1) {
      onAddDrawing({
        id: 'draw-' + Date.now(),
        color: drawColor,
        width: brushSize,
        points: currentPath,
      });
      setCurrentPath(null);
    }

    if (draggingTokenId && tokens[draggingTokenId]) {
      const token = tokens[draggingTokenId];
      let finalX = token.x;
      let finalY = token.y;

      // Snap to Grid cell center if enabled
      if (mapData.grid.snapToGrid) {
        const sz = mapData.grid.size;
        finalX = Math.round(finalX / sz) * sz + sz / 2;
        finalY = Math.round(finalY / sz) * sz + sz / 2;
      }

      const updated = {
        ...tokens,
        [draggingTokenId]: {
          ...token,
          x: finalX,
          y: finalY,
        },
      };
      sounds.playTokenMove();
      onUpdateTokens(updated);
      setDraggingTokenId(null);
    }
  };

  // Zoom on Wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(3.5, Math.max(0.2, transform.scale * zoomFactor));

    // Anchor zoom at mouse pointer
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({
      scale: newScale,
      x: newX,
      y: newY,
    });
  };

  // Double click token to edit
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const hit = getTokenAtPosition(world.x, world.y);
    if (hit) {
      onEditToken(hit);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-[#090b10]"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Floating Zoom & Center HUD Controls */}
      <div className="absolute bottom-5 left-5 flex items-center space-x-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-1.5 rounded-lg shadow-xl text-xs text-slate-300">
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.2, t.scale * 0.85) }))}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200 transition"
          title="Zoom Out"
        >
          -
        </button>
        <span className="px-2 font-mono">{Math.round(transform.scale * 100)}%</span>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(3.5, t.scale * 1.15) }))}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-200 transition"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setTransform({ x: 100, y: 80, scale: 0.9 })}
          className="px-2 py-1 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 rounded font-medium ml-1 transition"
          title="Reset View"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
