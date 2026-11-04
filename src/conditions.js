// Canonical text: Corebook 12.06, Chapter 10, Conditions → The Standard Conditions.
export const CONDITION_SOURCE = 'Corebook 12.06 · Chapter 10 · Conditions → The Standard Conditions';
export const CONDITIONS = [
  {
    "name": "Bleeding",
    "rule": "Mark 1 Stress at the end of each round until stopped (First Aid, or any healing effect). Targets that do not bleed, including most Synthetics, are immune.",
    "label": "Sangrado",
    "path": "M12 3C10 7 6 10 6 14a6 6 0 0 0 12 0c0-4-4-7-6-11Z"
  },
  {
    "name": "Blinded",
    "rule": "Disadvantage on attacks and Instinct rolls. Cleared by removing the visual obstruction or a successful Long Rest.",
    "label": "Cegado",
    "path": "M3 12q9-12 18 0-9 12-18 0M3 3l18 18"
  },
  {
    "name": "Confused",
    "rule": "On your Spotlight, you act against the nearest creature, ally or enemy, or as the inflicting effect specifies. Cleared at the end of the stated duration, or when an ally spends an action to snap you out of it (Presence or Knowledge, DC 10).",
    "label": "Confundido",
    "path": "M8 7a4 4 0 1 1 6 4l-2 2v2M12 19h.01"
  },
  {
    "name": "Cornered",
    "rule": "Cannot move out of Melee with the attacking character. Disadvantage on Agility and Finesse rolls until the cornering ends. Cleared by moving the cornering character out of Melee, knocking them down, or escaping by a successful Strength or Finesse contest (DC 10).",
    "label": "Acorralado",
    "path": "M3 4v16h18M8 8l8 8M8 16l8-8"
  },
  {
    "name": "Dazed",
    "rule": "Disadvantage on the character's next single action. Cleared after the action resolves.",
    "label": "Aturdimiento leve",
    "path": "M4 12h12M12 6l6 6-6 6M4 6h4M4 18h4"
  },
  {
    "name": "Fleeing",
    "rule": "On your Spotlight, you must move away from the source by the most direct safe route and cannot take aggressive actions against it. Cleared at the end of the stated duration, or when you can no longer see or hear the source.",
    "label": "En fuga",
    "path": "M4 5l7 4-3 5 6 2 2 5M11 9l6-2 3 4M9 3h.01"
  },
  {
    "name": "Frightened",
    "rule": "Disadvantage on rolls made against the source of the fear, and you cannot willingly move closer to it. Cleared at the end of the stated duration, when the source is gone, or by an effect that steadies the mind.",
    "label": "Asustado",
    "path": "M5 8q7-9 14 0v8q-7 9-14 0ZM8 10v3M16 10v3M8 18q4-4 8 0"
  },
  {
    "name": "Hidden",
    "rule": "Cannot be directly targeted by ranged attacks; Advantage on the character's next attack from cover. Broken when the character takes an aggressive action, moves out of cover, or fails an Agility Roll to maintain concealment in changing circumstances.",
    "label": "Oculto",
    "path": "M3 12q9-12 18 0-9 12-18 0M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6"
  },
  {
    "name": "Incapacitated",
    "rule": "Cannot take actions, reactions, or movement; you are unconscious or helpless, but not Dying. Cleared at the end of the stated duration, or when an ally spends an action to rouse you (Knowledge or Instinct, DC 10). Damage dealt to an Incapacitated target hits automatically.",
    "label": "Incapacitado",
    "path": "M5 6l14 12M5 18L19 6M3 12h18"
  },
  {
    "name": "Infected",
    "rule": "A wound or contamination is working against you. The inflicting effect states the symptom (commonly 1 Stress per round, or HP that cannot be healed by normal means). Persists through rests until treated: a Knowledge roll with medical training (DC 15), a specialized antidote, or Tier 2+ medical care.",
    "label": "Infectado",
    "path": "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10"
  },
  {
    "name": "On Fire",
    "rule": "Take 1d4 Energy damage with the Fire tag at the end of each round until extinguished by your Action, an ally's Action, immersion, or a source-specific method. Damage applies to Thresholds normally.",
    "label": "En llamas",
    "path": "M12 3q2 7 6 9 4 9-6 9-10 0-6-9 1 4 4 2Z"
  },
  {
    "name": "Poisoned",
    "rule": "Mark 1 Stress at the end of each round until treated (First Aid DC 10, an antidote, or a Long Rest) or until the stated duration ends. Some poisons state a different effect; the source's text prevails. Synthetics and targets immune to toxins ignore this condition.",
    "label": "Envenenado",
    "path": "M8 3h8M10 3v7L5 19q-1 2 2 2h10q3 0 2-2l-5-9V3M8 15h8"
  },
  {
    "name": "Prone",
    "rule": "Disadvantage on attacks; ranged attackers gain Advantage against you. Cleared by spending a part of an action to stand (free if moving one band).",
    "label": "Derribado",
    "path": "M3 18h18M6 14l5-4 5 4M11 10l-2-4M18 7h.01"
  },
  {
    "name": "Restrained",
    "rule": "Cannot move. Disadvantage on Agility and Strength rolls. Cleared by an ally taking an action to free you, or by a successful Strength roll (DC 15) on your Spotlight.",
    "label": "Restringido",
    "path": "M5 7h6v10H5ZM13 7h6v10h-6ZM9 12h6"
  },
  {
    "name": "Silenced",
    "rule": "Cannot speak, cast verbal-component Domain Powers, or coordinate verbally. Cleared by the silencing effect's stated duration or by removing the source.",
    "label": "Silenciado",
    "path": "M4 10h4l5-5v14l-5-5H4ZM17 8l5 8M22 8l-5 8"
  },
  {
    "name": "Stunned",
    "rule": "Cannot take any action. Cleared after the next round, or when an ally takes an Action to rouse you with a Knowledge or Instinct Roll, DC 10.",
    "label": "Aturdido",
    "path": "M14 2L5 13h6l-1 9 9-13h-6Z"
  },
  {
    "name": "Vulnerable",
    "rule": "Attacks against you have Advantage until the condition ends. Cleared at the end of the stated duration; if the source states none, it ends at the end of your next Spotlight.",
    "label": "Vulnerable",
    "path": "M12 3l9 4v6q-2 6-9 9-7-3-9-9V7ZM12 7v7M12 18h.01"
  },
  {
    "name": "Weakened",
    "rule": "Disadvantage on Strength rolls, and your damage rolls lose your flat modifiers (dice are unaffected). Cleared by the method the source states, or by a Long Rest.",
    "label": "Debilitado",
    "path": "M4 5h16M7 9h10M10 13h4M7 17l5 5 5-5"
  }
];
const key = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function conditionDefinition(name) { return CONDITIONS.find(c => key(c.name) === key(name) || key(c.label) === key(name)); }
export function normalizeConditions(values = []) {
  const seen = new Set();
  return values.filter(v => typeof v === 'string' && v.trim()).map(v => conditionDefinition(v)?.name || v.trim()).filter(v => { const id = key(v); if (seen.has(id)) return false; seen.add(id); return true; });
}
const customPath = 'M12 3l9 9-9 9-9-9ZM12 7v7M12 17h.01';
export function conditionIcon(name) {
  const path = conditionDefinition(name)?.path || customPath;
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
}
export function conditionMarkers(values = []) {
  const list = normalizeConditions(values);
  return list.length <= 4 ? list : [...list.slice(0, 3), { more: list.length - 3 }];
}
const canvasPaths = new Map();
export function drawTokenConditions(ctx, token, radius, zoom = 1) {
  const markers = conditionMarkers(token.conditions);
  if (!markers.length) return;
  const scale = Math.max(1, Math.min(1.8, .9 / zoom));
  ctx.save(); ctx.translate(radius + 13 * scale, 0); ctx.scale(scale, scale);
  markers.forEach((marker, i) => {
    ctx.save(); ctx.translate(0, (i - (markers.length - 1) / 2) * 18);
    ctx.fillStyle = '#101b2b'; ctx.strokeStyle = '#e9c78a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 4); ctx.fill(); ctx.stroke();
    if (marker.more) {
      ctx.fillStyle = '#fff1ce'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+' + marker.more, 0, 0);
    } else {
      const path = conditionDefinition(marker)?.path || customPath;
      if (!canvasPaths.has(path)) canvasPaths.set(path, new Path2D(path));
      ctx.scale(.52, .52); ctx.translate(-12, -12); ctx.lineWidth = 1.8; ctx.stroke(canvasPaths.get(path));
    }
    ctx.restore();
  });
  ctx.restore();
}
