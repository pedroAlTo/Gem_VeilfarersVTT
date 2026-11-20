export function placementMode(entry) {
  if (!Number.isFinite(entry.hp) || entry.hp < 1) return 'narrative';
  if (entry.perHit) return 'minion';
  return [entry.evasion, entry.attack, entry.major, entry.severe].every(Number.isFinite) && entry.damage
    ? 'standard' : 'partial';
}

export const isEncounterMarker = token => token?.bestiaryMode === 'narrative';

export const perHitMinion = token => token?.bestiaryMode === 'minion' &&
  !(token.hp?.majorThreshold > 0 && token.hp?.severeThreshold >= token.hp.majorThreshold);

const statNames = { major: 'Major', severe: 'Severe', armor: 'Armor', stress: 'Stress' };
export const proposalSummary = entry => Object.entries(entry.provisional || {})
  .map(([key, value]) => statNames[key] + ' ' + value).join(' · ');
