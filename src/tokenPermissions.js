export const isDrone = token => token?.actorType === 'drone';
export const controlsToken = (token, playerId) => !!playerId && !token?.hidden &&
  (isDrone(token) ? token.controllerIds?.includes(playerId) : token?.ownerId !== 'keeper' && token?.ownerId === playerId);

export const isPartyToken = token => !!(token?.isPlayer || token?.actorType === 'player' || (token?.ownerId && token.ownerId !== 'keeper') || (isDrone(token) && token.controllerIds?.length));

// Validate first, then make one atomic update. Un jugador puede estar asignado a varios tokens y los drones pueden tener varios jugadores asignados a la vez.
export function assignControls(tokens, tokenId, playerIds, knownPlayers) {
  const target = tokens.find(t => t.id === tokenId);
  if (!target) throw new Error('Token no longer exists.');
  const ids = [...new Set(playerIds.filter(Boolean))];
  if (ids.some(id => !knownPlayers.includes(id))) throw new Error('Unknown player.');
  if (!isDrone(target) && ids.length > 1) throw new Error('Only drones can have multiple controllers.');
  return tokens.map(token => {
    if (token.id === tokenId) {
      return {
        ...token,
        ownerId: isDrone(token) ? '' : ids[0] || '',
        controllerIds: isDrone(token) ? ids : (token.controllerIds || [])
      };
    }
    // Un jugador puede estar asignado a varios tokens: no se desasignan sus otros tokens
    return token;
  });
}

export function movePartyToScene(tokens, map) {
  let slot = 0;
  return tokens.map(token => {
    if (token.mapId === map.id || !isPartyToken(token) || token.mapId === 'reserve' || token.inReserve) return token;
    const grid = map.gridSize || 70, margin = Math.max(grid, grid * (token.size || 1) / 2);
    const previous = token.scenePositions?.[map.id];
    const point = previous || { x: margin + (slot % 5) * grid * 2, y: margin + Math.floor(slot / 5) * grid * 2 };
    slot++;
    return { ...token, mapId: map.id,
      scenePositions: { ...token.scenePositions, [token.mapId]: { x: token.x, y: token.y } },
      x: Math.max(margin, Math.min((map.width || 2000) - margin, point.x)),
      y: Math.max(margin, Math.min((map.height || 2000) - margin, point.y)) };
  });
}
