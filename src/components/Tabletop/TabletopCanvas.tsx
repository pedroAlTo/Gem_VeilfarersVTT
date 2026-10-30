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
  onOpenMapModal?: () => void;
  onToggleFog?: () => void;
  onChangeTool?: (tool: ActiveTool) => void;
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
  onOpenMapModal,
  onToggleFog,
  onChangeTool,
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

  // Tactical Subwindow State & Armed status
  const [isSubwindowOpen, setIsSubwindowOpen] = useState(true);
  const [isArmed, setIsArmed] = useState(true);
  const [canvasTimecode, setCanvasTimecode] = useState('00:01:12:040');

  // Live ticking chronometer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
      setCanvasTimecode(`00:${h}:${m}:${s}:${ms}`);
    }, 75);
    return () => clearInterval(timer);
  }, []);

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

      // If this token is selected, draw subtle range bands around it!
      if (isSelected) {
        ctx.save();
        ctx.translate(token.x, token.y);
        
        // Range bands: Very Close (~100px), Close (~300px), Far (~650px)
        const bands = [
          { r: 100, label: 'Very Close (5m)', color: 'rgba(56, 189, 248, 0.25)' },
          { r: 300, label: 'Close (20m)', color: 'rgba(99, 102, 241, 0.2)' },
          { r: 650, label: 'Far (100m)', color: 'rgba(168, 85, 247, 0.15)' },
        ];

        bands.forEach((b) => {
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, b.r, 0, Math.PI * 2);
          ctx.stroke();

          // Band label
          ctx.fillStyle = b.color;
          ctx.font = '9px system-ui';
          ctx.fillText(b.label, b.r - 20, 0);
        });
        ctx.restore();
      }

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
      ctx.font = `bold ${Math.max(13, radius * 0.5)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = token.name.substring(0, 2).toUpperCase();
      ctx.fillText(initial, 0, 0);

      ctx.restore(); // Undo rotation for overlays like HP bar, Armor Slots, and Name

      // Non-rotated Overlays
      ctx.save();
      ctx.translate(token.x, token.y);

      // 1. Armor Slots (cyan pips above HP bar)
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

      // 2. HP Bar
      if (token.maxHp > 0) {
        const barWidth = radius * 2;
        const barHeight = 5;
        const hpPct = Math.max(0, Math.min(1, token.hp / token.maxHp));

        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-radius, -radius - 14, barWidth, barHeight);

        // HP Fill
        ctx.fillStyle = hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(-radius, -radius - 14, barWidth * hpPct, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-radius, -radius - 14, barWidth, barHeight);
      }

      // 3. Token Name & Major/Severe Threshold Tag
      ctx.fillStyle = 'rgba(10, 12, 20, 0.88)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      const labelText = `${token.name} (${token.majorThreshold}/${token.severeThreshold})`;
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillRect(-textWidth / 2 - 4, radius + 4, textWidth + 8, 15);
      ctx.fillStyle = token.isHidden ? '#fca5a5' : '#f1f5f9';
      ctx.fillText(labelText, 0, radius + 15);

      // 4. Condition Badges
      if (token.conditions && token.conditions.length > 0) {
        token.conditions.forEach((cond, idx) => {
          const badgeX = -radius + idx * 12;
          const badgeY = radius + 24;
          ctx.fillStyle = cond === 'Dazed' ? '#f59e0b' : cond === 'Vulnerable' ? '#ef4444' : cond === 'Stunned' ? '#8b5cf6' : '#ec4899';
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 3.5, 0, Math.PI * 2);
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

  const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;

  return (
    <div className="flex flex-col w-full h-full bg-[#06080d] border border-[#1b2333] relative overflow-hidden select-none font-mono">
      {/* 1. TOP WINDOW BAR (▲ VLV CTRL - 02) */}
      <div className="h-8 bg-[#0a0d14] border-b border-[#1b2333] px-3 flex items-center justify-between text-[11px] z-10">
        <div className="flex items-center space-x-2">
          {/* Amber Chevron & Title */}
          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold tracking-wider flex items-center gap-1 rounded-sm">
            <span className="text-[9px]">▲</span> VLV CTRL - 02
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-500/90 text-[10px] font-bold tracking-wider">▲ L-02:01</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-medium tracking-wide uppercase text-[10px] hidden md:inline">
            SECTOR: {mapData.name} ({mapData.width}×{mapData.height}px)
          </span>
        </div>

        {/* Window controls (minimize, fit, reset) */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-emerald-400 hidden lg:inline mr-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            TELEMETRY: STABLE
          </span>
          <button
            onClick={() => setIsSubwindowOpen(!isSubwindowOpen)}
            className="w-5 h-5 flex items-center justify-center bg-[#101520] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#222c3d] rounded-sm text-[10px] transition"
            title="Toggle Subwindow (L-02:01)"
          >
            _
          </button>
          <button
            onClick={() => setTransform({ x: 100, y: 80, scale: 0.9 })}
            className="w-5 h-5 flex items-center justify-center bg-[#101520] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#222c3d] rounded-sm text-[10px] transition"
            title="Reset Pan & Zoom"
          >
            □
          </button>
          <button
            onClick={() => {
              setSelectedTokenId(null);
              onSelectToken(null);
            }}
            className="w-5 h-5 flex items-center justify-center bg-[#101520] hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-[#222c3d] rounded-sm text-[10px] transition"
            title="Clear Selection"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. MAIN CANVAS VIEWPORT WITH SUBWINDOW OVERLAY & VERTICAL TABS */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#07090f]">
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

        {/* FLOATING SUBWINDOW (▲ L-02:01 - Schematic Status Box) */}
        {isSubwindowOpen && (
          <div className="absolute top-3 left-3 w-64 bg-[#0a0d14]/95 border border-[#222c3e] rounded p-2.5 shadow-2xl backdrop-blur-md z-10 text-[10px]">
            {/* Corner brackets */}
            <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-500" />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-amber-500" />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-amber-500" />

            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#1b2332]">
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-500 font-bold tracking-widest text-[9px]">▲ L-02:01</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-bold text-[9px] uppercase">
                  {selectedToken ? 'TARGET TELEMETRY' : 'SECTOR SENSORS'}
                </span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {selectedToken ? (
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between items-center bg-[#111722] px-1.5 py-1 rounded border border-[#1d273a]">
                  <span className="font-bold text-amber-400">{selectedToken.name}</span>
                  <span className="text-[9px] uppercase px-1 py-0.2 bg-indigo-900/50 text-indigo-300 rounded border border-indigo-700/50">
                    {selectedToken.path}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[9px]">
                  <div className="bg-[#0e131d] p-1 rounded border border-[#1c2434]">
                    <span className="text-slate-500 block">HIT POINTS</span>
                    <span className="font-bold text-emerald-400">
                      {selectedToken.hp} / {selectedToken.maxHp}
                    </span>
                  </div>
                  <div className="bg-[#0e131d] p-1 rounded border border-[#1c2434]">
                    <span className="text-slate-500 block">ARMOR SLOTS</span>
                    <span className="font-bold text-cyan-400">
                      {selectedToken.armorSlots} / {selectedToken.maxArmorSlots}
                    </span>
                  </div>
                  <div className="bg-[#0e131d] p-1 rounded border border-[#1c2434]">
                    <span className="text-slate-500 block">THRESHOLDS</span>
                    <span className="font-bold text-amber-400">
                      M:{selectedToken.majorThreshold} S:{selectedToken.severeThreshold}
                    </span>
                  </div>
                  <div className="bg-[#0e131d] p-1 rounded border border-[#1c2434]">
                    <span className="text-slate-500 block">EVASION</span>
                    <span className="font-bold text-slate-200">{selectedToken.evasion}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1a2130] flex justify-between text-[9px] text-slate-400">
                  <span>CONDITIONS:</span>
                  <span className="font-bold text-amber-300">
                    {selectedToken.conditions.length > 0
                      ? selectedToken.conditions.join(', ')
                      : 'NOMINAL'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-slate-400 text-[9px]">
                <div className="flex justify-between">
                  <span>ATMOSPHERE:</span>
                  <span className="text-slate-200 font-semibold">PRESSURIZED (O2 21%)</span>
                </div>
                <div className="flex justify-between">
                  <span>RADIATION:</span>
                  <span className="text-emerald-400 font-semibold">0.02 mSv/h (SAFE)</span>
                </div>
                <div className="flex justify-between">
                  <span>GRAVITY:</span>
                  <span className="text-slate-200 font-semibold">0.98 G STANDARD</span>
                </div>
                <div className="flex justify-between">
                  <span>GRID SYNC:</span>
                  <span className="text-amber-400 font-bold">{mapData.grid.size}px LOCKED</span>
                </div>
                <div className="pt-1 border-t border-[#1a2130] text-[8px] text-slate-500">
                  CLICK OR DRAG ANY TOKEN TO ENGAGE TARGET LOCK
                </div>
              </div>
            )}
          </div>
        )}

        {/* RIGHT VERTICAL TAB STRIP (F01, F02, F03, F04 - Directly from reference HUD) */}
        <div className="absolute right-2 top-4 flex flex-col space-y-1.5 z-10">
          <button
            onClick={onOpenMapModal}
            className="w-8 h-8 rounded-sm bg-[#0b0e14]/90 border border-[#202738] hover:border-amber-500 text-slate-300 hover:text-amber-400 flex flex-col items-center justify-center transition shadow-lg group"
            title="F01: Sector Maps"
          >
            <span className="text-[9px] font-black text-amber-500 group-hover:text-amber-300">F01</span>
            <span className="text-[7px] text-slate-500">MAP</span>
          </button>

          <button
            onClick={() => onChangeTool?.('measure')}
            className={`w-8 h-8 rounded-sm border flex flex-col items-center justify-center transition shadow-lg group ${
              activeTool === 'measure'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-[#0b0e14]/90 border-[#202738] text-slate-300 hover:text-amber-400'
            }`}
            title="F02: Tactical Ruler"
          >
            <span className={`text-[9px] font-black ${activeTool === 'measure' ? 'text-slate-950' : 'text-amber-500'}`}>
              F02
            </span>
            <span className={`text-[7px] ${activeTool === 'measure' ? 'text-slate-900' : 'text-slate-500'}`}>
              RNG
            </span>
          </button>

          <button
            onClick={onToggleFog}
            className="w-8 h-8 rounded-sm bg-[#0b0e14]/90 border border-[#202738] hover:border-cyan-400 text-slate-300 hover:text-cyan-400 flex flex-col items-center justify-center transition shadow-lg group"
            title="F03: Fog of War"
          >
            <span className="text-[9px] font-black text-cyan-400 group-hover:text-cyan-300">F03</span>
            <span className="text-[7px] text-slate-500">FOG</span>
          </button>

          <button
            onClick={() => {
              sounds.ping();
              onTriggerPing({
                id: 'ping-' + Date.now(),
                x: mapData.width / 2,
                y: mapData.height / 2,
                color: userColor,
                senderName: userName,
                timestamp: Date.now(),
              });
            }}
            className="w-8 h-8 rounded-sm bg-[#0b0e14]/90 border border-[#202738] hover:border-emerald-400 text-slate-300 hover:text-emerald-400 flex flex-col items-center justify-center transition shadow-lg group"
            title="F04: Sonar Scan Ping"
          >
            <span className="text-[9px] font-black text-emerald-400 group-hover:text-emerald-300">F04</span>
            <span className="text-[7px] text-slate-500">PNG</span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM WINDOW BAR (ARMED, RELOAD, TIME, COORDINATES, HAZARD STRIPES) */}
      <div className="h-9 bg-[#090c13] border-t border-[#1b2333] px-3 flex items-center justify-between text-[10px] z-10">
        {/* Left: ARMED indicator and reload buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsArmed(!isArmed)}
            className={`px-2.5 py-1 rounded-sm font-black text-[9px] tracking-wider transition flex items-center space-x-1 ${
              isArmed
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                : 'bg-[#141a26] text-slate-500 border border-[#222c3d]'
            }`}
            title="System Armed State"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isArmed ? 'bg-slate-950 animate-pulse' : 'bg-slate-600'}`} />
            <span>ARMED</span>
          </button>

          <button
            onClick={() => setTransform({ x: 100, y: 80, scale: 0.9 })}
            className="px-2 py-1 bg-[#10141e] hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-[#222c3d] rounded-sm font-bold text-[9px] transition"
            title="Reload & Recenter Viewport"
          >
            RELOAD
          </button>

          <button
            onClick={() => setTransform((t) => ({ ...t, scale: 1.0 }))}
            className="px-2 py-1 bg-[#10141e] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#222c3d] rounded-sm font-medium text-[9px] transition hidden sm:inline"
            title="1:1 Native Pixel Scale"
          >
            RESET
          </button>

          {/* Zoom controls */}
          <div className="flex items-center space-x-1 bg-[#10141e] border border-[#222c3d] px-1.5 py-0.5 rounded-sm text-[9px]">
            <button
              onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.2, t.scale * 0.85) }))}
              className="px-1 text-slate-400 hover:text-slate-200"
            >
              -
            </button>
            <span className="font-bold text-amber-400 px-1">{Math.round(transform.scale * 100)}%</span>
            <button
              onClick={() => setTransform((t) => ({ ...t, scale: Math.min(3.5, t.scale * 1.15) }))}
              className="px-1 text-slate-400 hover:text-slate-200"
            >
              +
            </button>
          </div>
        </div>

        {/* Center: Realtime Chronometer (▲ 00:01:12:040) */}
        <div className="hidden md:flex items-center space-x-1.5 font-bold tracking-widest text-amber-500">
          <span className="text-[8px]">▲</span>
          <span>{canvasTimecode}</span>
        </div>

        {/* Right: Coordinates & Hazard Stripes */}
        <div className="flex items-center space-x-2.5">
          <div className="hidden sm:flex items-center space-x-2 text-slate-400 font-mono text-[9px]">
            <span>POS:</span>
            <span className="text-slate-200 font-bold">
              X:{Math.round(transform.x)} Y:{Math.round(transform.y)}
            </span>
          </div>

          {/* Hazard diagonal stripes widget */}
          <div className="w-16 h-3 bg-hazard-stripes rounded-xs border border-amber-500/30 opacity-70" />
        </div>
      </div>
    </div>
  );
};
