import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  ActiveTool,
  DrawingPath,
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
  onDropImage?: (file: File) => void;
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
  onDropImage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport Transform (Pan and Zoom)
  const [transform, setTransform] = useState({ x: 80, y: 50, scale: 0.85 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Map Background Image Cache
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  // Token Avatar Image Cache
  const [avatarImages, setAvatarImages] = useState<Record<string, HTMLImageElement>>({});

  // Selection & Dragging
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Measurement tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureCurrent, setMeasureCurrent] = useState<{ x: number; y: number } | null>(null);

  // Freehand drawing in-progress path
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[] | null>(null);

  // Drag over state for visual cue
  const [isDragOver, setIsDragOver] = useState(false);

  // Load Map Image
  useEffect(() => {
    let active = true;
    if (!mapData.imageUrl) {
      setMapImage((prev) => (prev ? null : prev));
      return;
    }
    const img = new Image();
    if (!mapData.imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (active) setMapImage(img);
    };
    img.onerror = () => {
      // Retry without crossOrigin if CORS failed
      if (img.crossOrigin && active) {
        const retry = new Image();
        retry.onload = () => {
          if (active) setMapImage(retry);
        };
        retry.src = mapData.imageUrl!;
      }
    };
    img.src = mapData.imageUrl;
    return () => {
      active = false;
    };
  }, [mapData.imageUrl]);

  // Load Token Avatars
  useEffect(() => {
    Object.values(tokens).forEach((t) => {
      if (t.avatarUrl && !avatarImages[t.avatarUrl]) {
        const img = new Image();
        if (!t.avatarUrl.startsWith('data:')) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          setAvatarImages((prev) => ({ ...prev, [t.avatarUrl!]: img }));
        };
        img.src = t.avatarUrl;
      }
    });
  }, [tokens, avatarImages]);

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

      // Reverse order so top tokens are hit first
      for (let i = tokenList.length - 1; i >= 0; i--) {
        const token = tokenList[i];
        if (token.isHidden && userRole !== 'gm') continue;

        const radius = (token.size * cellSize) / 2;
        const dx = worldX - token.x;
        const dy = worldY - token.y;
        if (Math.hypot(dx, dy) <= radius) {
          return token;
        }
      }
      return null;
    },
    [tokens, mapData.grid.size, userRole]
  );

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas Scaling
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

    // 1. Draw Map (Image or Procedural Grid)
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
            const offsetY = rowIndex % 2 === 1 ? hexHeight / 2 : 0;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const hx = x + hexRadius * Math.cos(angle);
              const hy = y + offsetY + hexRadius * Math.sin(angle);
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

    // 3. Draw Completed Drawings
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

    // 4. Draw Current in-progress Drawing
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
      if (token.isHidden && userRole !== 'gm') return;

      const radius = (token.size * cellSize) / 2;
      const isSelected = selectedTokenId === token.id;

      // 5a. Range bands around selected token (unrotated)
      if (isSelected) {
        ctx.save();
        ctx.translate(token.x, token.y);
        const bands = [
          { r: 100, label: 'Very Close (5m)', color: 'rgba(56, 189, 248, 0.35)' },
          { r: 300, label: 'Close (20m)', color: 'rgba(99, 102, 241, 0.28)' },
          { r: 650, label: 'Far (100m)', color: 'rgba(168, 85, 247, 0.2)' },
        ];
        bands.forEach((b) => {
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, b.r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = b.color;
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(b.label, b.r - 20, 0);
        });
        ctx.restore();
      }

      // 5b. Rotated token body & avatar
      ctx.save();
      ctx.translate(token.x, token.y);
      ctx.rotate((token.rotation * Math.PI) / 180);

      if (token.isHidden) {
        ctx.globalAlpha = 0.55;
      }

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(3, 3, radius, 0, Math.PI * 2);
      ctx.fill();

      // Base circle
      ctx.fillStyle = token.color || '#6366f1';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Avatar image if loaded, otherwise initials
      const avImg = token.avatarUrl ? avatarImages[token.avatarUrl] : null;
      if (avImg && avImg.complete && avImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avImg, -radius, -radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(13, radius * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = token.name.substring(0, 2).toUpperCase();
        ctx.fillText(initial, 0, 0);
      }

      // Inner Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Facing Direction Indicator Notch
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(-6, -radius + 10);
      ctx.lineTo(6, -radius + 10);
      ctx.closePath();
      ctx.fill();

      ctx.restore(); // Restores rotated token body

      // 5c. Non-rotated Overlays (Armor Slots, HP Bar, Name, Conditions)
      ctx.save();
      ctx.translate(token.x, token.y);

      // Armor Slots (cyan pips)
      if (token.maxArmorSlots > 0) {
        const slotWidth = Math.min(10, (radius * 2) / token.maxArmorSlots - 2);
        const startX = -((token.maxArmorSlots * (slotWidth + 2)) / 2) + slotWidth / 2;
        for (let i = 0; i < token.maxArmorSlots; i++) {
          const isFilled = i < token.armorSlots;
          ctx.fillStyle = isFilled ? '#38bdf8' : 'rgba(51, 65, 85, 0.8)';
          ctx.fillRect(startX + i * (slotWidth + 2) - slotWidth / 2, -radius - 22, slotWidth, 4);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(startX + i * (slotWidth + 2) - slotWidth / 2, -radius - 22, slotWidth, 4);
        }
      }

      // HP Bar
      const barW = Math.max(40, radius * 2);
      const barH = 5;
      const barY = -radius - 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(-barW / 2, barY, barW, barH);

      const hpPct = Math.max(0, Math.min(1, token.hp / (token.maxHp || 1)));
      ctx.fillStyle = hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW / 2, barY, barW, barH);

      // Name Label
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const textW = ctx.measureText(token.name).width;
      const nameY = radius + 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(-textW / 2 - 4, nameY - 9, textW + 8, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(token.name, 0, nameY + 2);

      // Conditions badges
      if (token.conditions && token.conditions.length > 0) {
        const badgeCount = Math.min(token.conditions.length, 5);
        const bSpacing = 9;
        const bStartX = -((badgeCount - 1) * bSpacing) / 2;
        token.conditions.slice(0, 5).forEach((_, idx) => {
          const badgeX = bStartX + idx * bSpacing;
          const badgeY = nameY + 12;
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore(); // Restores non-rotated overlays
    });

    // 6. Draw Fog of War
    if (fog.enabled) {
      ctx.save();
      if (userRole === 'player') {
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
        // GM sees translucent shroud
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(0, 0, mapData.width, mapData.height);

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
      const distPx = Math.hypot(dx, dy);
      const cells = (distPx / mapData.grid.size).toFixed(1);
      const meters = (parseFloat(cells) * 2).toFixed(1);

      const midX = (measureStart.x + measureCurrent.x) / 2;
      const midY = (measureStart.y + measureCurrent.y) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = `${meters} m (${cells} cells)`;
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
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const pw = ctx.measureText(p.senderName).width;
        ctx.fillRect(p.x - pw / 2 - 4, p.y + 12, pw + 8, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(p.senderName, p.x, p.y + 24);

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
    avatarImages,
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
      const radius = brushSize * 15;
      const filtered = fog.reveals.filter((r) => Math.hypot(r.x - world.x, r.y - world.y) > radius);
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
        // Start canvas pan if clicking empty space
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

  // Zoom on Wheel (Centered at cursor)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(3.5, Math.max(0.15, transform.scale * zoomFactor));

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

  // Drag and Drop Image File onto Canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/') && onDropImage) {
      onDropImage(file);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden bg-[#07090f] select-none ${
        isDragOver ? 'ring-4 ring-indigo-500/80' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${
          activeTool === 'pan' || isPanning
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'draw'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Drag & Drop Visual Overlay Cue */}
      {isDragOver && (
        <div className="absolute inset-0 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center pointer-events-none z-30">
          <div className="p-4 bg-slate-900 border-2 border-dashed border-indigo-400 rounded-2xl text-center text-slate-100 shadow-2xl">
            <div className="text-sm font-bold text-indigo-300">Drop Image Here</div>
            <div className="text-xs text-slate-400 mt-1">Set as battlemap background</div>
          </div>
        </div>
      )}

      {/* Floating Viewport Status & Zoom Bar (Bottom-Right) */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-1.5 bg-slate-900/90 border border-slate-700/80 px-2 py-1 rounded-xl shadow-xl backdrop-blur-md text-xs font-mono text-slate-300">
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.15, t.scale * 0.85) }))}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition"
          title="Zoom Out"
        >
          -
        </button>
        <span className="font-bold text-amber-400 px-1 text-[11px] min-w-[42px] text-center">
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(3.5, t.scale * 1.15) }))}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setTransform({ x: 80, y: 50, scale: 0.85 })}
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition"
          title="Reset Zoom & Pan"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
