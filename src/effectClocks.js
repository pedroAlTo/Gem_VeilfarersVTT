import { PATH_TRAITS } from './statePowers.js';
// Effect clocks (V3): the duration of an effect a card starts, kept on the token.
// Path to Nirvana ("a number of Spotlights equal to your Proficiency") makes a clock of
// Proficiency segments; Rapid Regeneration ("Roll 1d4: the result is the number of additional
// turns") rolls the d4 and makes a clock of that many. Each time the token gains the Spotlight
// one segment is marked; when the clock is full the effect ends. A touch on the clock drawn
// beside the token marks one segment by hand; the full sheet edits it.
export const MAX_CLOCKS = 6, MAX_SEGMENTS = 20;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
// Corebook: Tier 1 (Levels 1-4), Tier 2 (Levels 5-7), Tier 3 (Levels 8-10).
export const tierOf = level => { const l = Number(level) || 1; return l <= 4 ? 1 : l <= 7 ? 2 : 3; };
const rollDie = sides => Math.floor(Math.random() * sides) + 1;
const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4 };
const num = v => words[String(v).toLowerCase()] ?? Number(v);

// The duration a card's text sets, or null. `token` gives the Proficiency.
// Sentences of a card that set a duration for the one who plays it or the allies it helps:
// not the branches of a failed roll, and not a condition put on a target or an enemy (those
// depend on the roll and belong to the target's own conditions).
const OTHER_SUBJECT = /^(?:on (?:a )?(?:failure|success)[^:,]*[:,]\s*)?(?:the target|targets|each affected target|they|it|enemies|adversaries|a creature|the revived ally)\b/i;
export function durationSentences(text) {
  return String(text ?? '').replace(/\*+/g, '').split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(?:-\s*)?(?:on (?:a )?failure|failure)\b/i.test(x) && !/\bon (?:a )?failure\b/i.test(x.slice(0, 40)) && !OTHER_SUBJECT.test(x.replace(/^(?:-\s*)?(?:success|on (?:a )?success(?: with (?:hope|fear))?)\s*:\s*/i, '')));
}
// Whether the card's effect may land on someone else (then a marked ally receives the clock).
export const helpsOthers = card => /\byou or an ally\b|\ban ally\b|\banother creature\b|\bthe target recovers\b|\ballies\b/i.test(String(card?.text ?? ''));

// A duration set by a die («Roll 1d4: the result is the number of additional turns»): the match
// (count, sides), or null. The one who plays the card throws it (durationDice).
function durationRoll(text) {
  return text.match(/roll (\d*)d(\d+)\b[^.]*?(?:number of (?:additional )?(?:turns|Spotlights|rounds)|\. [^.]*next that many Spotlights)/i)
    || text.match(/roll (\d*)d(\d+) once\.[^.]*next that many Spotlights/i);
}
export function durationDice(card) {
  const text = String(card?.text ?? '').replace(/\*+/g, '');
  if (/Integrity Die/i.test(text) && /highest face by Tier/i.test(text)) return null;
  if (/Spotlights? equal to (?:your )?Proficiency/i.test(text)) return null;
  const m = durationRoll(text);
  return m ? { qty: clamp(m[1] || 1, 1, 4), sides: clamp(m[2], 2, 20) } : null;
}

// The duration a card's text sets, or null. `token` gives the level and the Proficiency.
export function cardDuration(card, token = {}, roll = rollDie) {
  const text = String(card?.text ?? '').replace(/\*+/g, '');
  const base = { name: String(card?.name ?? 'Efecto').slice(0, 80), tick: 'spotlight' };
  // Healing on each of the target's turns (Rapid Regeneration, Nurturing Touch).
  const heal = text.match(/start of (?:the target's|your|their|each of that target's)[^.]*?(?:recover|heal|regain|clears?) \+?(\d+) HP/i);
  const perTick = heal ? { hp: Number(heal[1]) } : null;
  // Integrity Die (Corebook 12.06: Path to Nirvana, Disciplined State): its highest face by Tier
  // (d4 Tier 1, d6 Tier 2, d8 Tier 3); each roll with Fear lowers it by 1; ends at 0 or at the
  // end of the scene.
  if (/Integrity Die/i.test(text) && /highest face by Tier/i.test(text)) {
    const tier = tierOf(token.level), face = [4, 6, 8][tier - 1];
    return { ...base, segments: face, tick: 'fear', scene: true, die: `d${face}`, note: `Integrity Die d${face} (Tier ${tier}): baja 1 cada vez que tiras con Fear (nunca con dados iguales). Termina a 0 o al acabar la escena.`, perTick: null };
  }
  if (/Spotlights? equal to (?:your )?Proficiency/i.test(text)) {
    const p = clamp(token.proficiency ?? 1, 1, MAX_SEGMENTS);
    return { ...base, segments: p, note: `Dura ${p} Spotlight${p > 1 ? 's' : ''} (Proficiency ${p}).`, perTick };
  }
  // A die sets it: "Roll 1d4: the result is the number of additional turns", "roll 1d4 once …
  // each of that target's next that many Spotlights".
  const rolled = durationRoll(text);
  if (rolled) {
    const n = clamp(rolled[1] || 1, 1, 4), sides = clamp(rolled[2], 2, 20);
    const faces = Array.from({ length: n }, () => roll(sides)), total = clamp(faces.reduce((a, b) => a + b, 0), 1, MAX_SEGMENTS);
    return { ...base, segments: total, faces, note: `${n}d${sides} [${faces.join(', ')}]: dura ${total} turno${total > 1 ? 's' : ''}.`, perTick };
  }
  const timedContext = { 'Ecosystem Analysis': '24 horas', 'Perfect Facade': '1 hora' };
  if (Object.hasOwn(timedContext, card?.name)) return { ...base, segments: 1, tick: 'manual', note: 'Dura ' + timedContext[card.name] + '.' };
  const own = durationSentences(text).join(' ');
  const rounds = own.match(/(?:lasts?|lasting|for) (\d+|one|two|three|four|five|six) (?:more |additional )?(?:Spotlights|turns|rounds?)\b/i);
  if (rounds) {
    const n = clamp(num(rounds[1]), 1, MAX_SEGMENTS);
    return { ...base, segments: n, note: `Dura ${n} turno${n > 1 ? 's' : ''}.`, perTick };
  }
  if (/\b(?:until|for|on) (?:the (?:start|end) of )?your next Spotlight\b/i.test(own)) {
    return { ...base, segments: 1, note: 'Dura hasta tu próximo Spotlight.', perTick };
  }
  if (/\b(?:until the end of the scene|for the (?:rest of the )?scene|for one scene|until the scene ends)\b/i.test(own)) {
    return { ...base, segments: 1, tick: 'manual', scene: true, note: 'Dura hasta el final de la escena (toca el reloj para terminarlo antes).', perTick: null };
  }
  return null;
}

export function newClock(duration, { id = `fx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, source = '' } = {}) {
  return { id, name: duration.name, segments: clamp(duration.segments, 1, MAX_SEGMENTS), filled: 0, tick: duration.tick || 'spotlight', ...(duration.perTick ? { perTick: duration.perTick } : {}), ...(duration.scene ? { scene: true } : {}), ...(duration.die ? { die: duration.die } : {}), ...(source ? { source: String(source).slice(0, 80) } : {}) };
}

// Starting the same effect again restarts its clock.
export function addClock(list = [], clock) {
  return [...(list || []).filter(c => c.name !== clock.name), clock].slice(-MAX_CLOCKS);
}

// One segment marked on one clock (or on every Spotlight clock). Full clocks end.
export function tickClocks(list = [], { id = null, kind = null } = {}) {
  const ticked = [], expired = [], kept = [];
  for (const c of list || []) {
    const hit = id ? c.id === id : c.tick === kind;
    if (!hit) { kept.push(c); continue; }
    const next = { ...c, filled: Math.min(c.segments, (c.filled || 0) + 1) };
    ticked.push(next);
    if (next.filled >= next.segments) expired.push(next); else kept.push(next);
  }
  return { list: kept, ticked, expired };
}

export function editClock(list = [], id, patch = {}) {
  return (list || []).map(c => {
    if (c.id !== id) return c;
    const segments = clamp(patch.segments ?? c.segments, 1, MAX_SEGMENTS);
    return { ...c, segments, filled: clamp(patch.filled ?? c.filled, 0, segments), ...(patch.name ? { name: String(patch.name).slice(0, 80) } : {}) };
  });
}

export function validEffectClocks(v) {
  return Array.isArray(v) && v.length <= MAX_CLOCKS && v.every(c => c && typeof c === 'object'
    && typeof c.id === 'string' && c.id.length <= 60 && typeof c.name === 'string' && c.name.length <= 80
    && Number.isInteger(c.segments) && c.segments >= 1 && c.segments <= MAX_SEGMENTS
    && Number.isInteger(c.filled) && c.filled >= 0 && c.filled <= c.segments
    && ['spotlight', 'fear', 'manual'].includes(c.tick)
    && (c.condition === undefined || ['Dazed', 'Stunned'].includes(c.condition))
    && (c.expiry === undefined || ['round','spotlight-end'].includes(c.expiry))
    && (c.seenSpotlight === undefined || typeof c.seenSpotlight === 'boolean')
    && (c.edge === undefined || ['advantage','disadvantage'].includes(c.edge))
    && (c.meleeRound === undefined || typeof c.meleeRound === 'string' && c.meleeRound.length <= 160)
    && (c.trait === undefined || PATH_TRAITS.includes(c.trait))
    && (c.scene === undefined || typeof c.scene === 'boolean') && (c.firstStrikeUsed === undefined || typeof c.firstStrikeUsed === 'boolean') && (c.die === undefined || /^d(4|6|8|10|12)$/.test(c.die))
    && (c.perTick === undefined || (c.perTick && typeof c.perTick === 'object' && Number.isInteger(c.perTick.hp ?? 0) && (c.perTick.hp ?? 0) >= 0 && (c.perTick.hp ?? 0) <= 20))
    && (c.source === undefined || (typeof c.source === 'string' && c.source.length <= 80)));
}

// Where the clocks are drawn beside a token (left side; the conditions are on the right), in
// world units from its centre. The canvas draws them and a touch is tested against them.
export function clockSlots(token, radius, zoom = 1) {
  const list = token?.effectClocks || [];
  const scale = Math.max(1, Math.min(1.8, 0.9 / (zoom || 1)));
  return list.map((clock, i) => ({ clock, dx: -(radius + 14 * scale), dy: (i - (list.length - 1) / 2) * 22 * scale, r: 9 * scale }));
}

export function drawEffectClocks(ctx, token, radius, zoom = 1) {
  for (const { clock, dx, dy, r } of clockSlots(token, radius, zoom)) {
    const left = clock.segments - clock.filled;
    ctx.save(); ctx.translate(dx, dy);
    ctx.fillStyle = 'rgba(13,4,32,.92)'; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.4 * (r / 9);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // Marked segments in violet, the ones left in yellow.
    const step = (Math.PI * 2) / clock.segments;
    for (let s = 0; s < clock.segments; s++) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 1.5, -Math.PI / 2 + s * step + 0.06, -Math.PI / 2 + (s + 1) * step - 0.06); ctx.closePath();
      ctx.fillStyle = s < clock.filled ? 'rgba(124,58,237,.55)' : 'rgba(253,230,138,.9)'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0d0420'; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.font = `bold ${Math.round(r * 0.8)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(left), 0, 0.5);
    ctx.restore();
  }
}

export function clockAt(token, world, radius, zoom = 1) {
  for (const s of clockSlots(token, radius, zoom)) if (Math.hypot(world.x - (token.x + s.dx), world.y - (token.y + s.dy)) <= s.r + 3) return s.clock;
  return null;
}

// A small pie for HTML (the Ficha and the full sheet).
export function clockPieHTML(clock, size = 22) {
  const pct = (clock.filled / clock.segments) * 100;
  return `<span class="fx-pie" style="--fx-pct:${pct.toFixed(1)}%;width:${size}px;height:${size}px" aria-hidden="true"></span>`;
}
