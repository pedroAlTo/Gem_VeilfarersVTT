// Builds the Hearts in the Void room (v2.62.0, user request: «créame una sala con todo lo necesario
// para correr la partida de Hearts in the Void; yo añadiré los mapas»). Run with
//   node scripts/build-hearts-campaign.mjs
// It writes public/campaigns/hearts-in-the-void.json, validated by the app's own campaign rules;
// the Keeper loads it from Sesiones → «Módulos». The scenes wait for the user's map images.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { PLAYER_DOCS } from './hearts-in-the-void/players.mjs';
import { SCENE_DOCS } from './hearts-in-the-void/scenes.mjs';
import { GUIDE_DOCS } from './hearts-in-the-void/guides.mjs';
import { NPCS, npcDossier } from './hearts-in-the-void/npcs.mjs';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'MutationObserver', 'localStorage', 'Event', 'CustomEvent', 'FormData']) globalThis[key] = dom.window[key];
const { store } = await import('../src/state.js'); await store.ready;
const { createActor } = await import('../src/actors.js');
const { crewPortraitPath } = await import('../src/tokenAvatars.js');
const { bestiaryPortrait } = await import('../src/bestiaryPortraits.js');

// ── Scenes: one per map plate, plus the places without a plate ───────────────────────────────
const scene = (id, name) => ({ id: 'hv_map_' + id, name, imageUrl: '/assets/maps/blank-grid.svg', width: 1200, height: 800, gridSize: 64, gridType: 'square', gridColor: 'rgba(0,243,255,.18)', ambientLight: 1, ambientColor: '#080d18', walls: [], lights: [], effects: [], waterZones: [] });
const maps = [
  scene('nexus', 'Escena 1 · Nexus Inferior (Crossroads)'),
  scene('plate_a', 'Lámina A · Harrow Dock Acquisition Yard'),
  scene('plate_b', 'Lámina B · Dock K-17: hangar de The Collector'),
  scene('transit', 'Tránsito del Velo · a bordo'),
  scene('plate_1', 'Lámina 1 · Charon’s Refuge: vista general'),
  scene('plate_2', 'Lámina 2 · Anillo de atraque y amarres exteriores'),
  scene('plate_3', 'Lámina 3 · Sectores comercial y residencial'),
  scene('plate_4', 'Lámina 4 · Ingeniería y refugios de emergencia'),
  scene('plate_5', 'Lámina 5 · Acceso a Investigación y laboratorios Kurogane'),
  scene('aftermath', 'Escena 8 · Tras la huida'),
];

// ── Tokens: the people and the module's adversaries, waiting in the reserve ─────────────────
const reserve = (data, id) => ({ ...createActor({ hidden: false, hasLight: false, ...data }, 'reserve'), id: 'tok_hv_' + id, inReserve: true });
const people = NPCS.map(n => reserve({
  actorType: 'npc', isPlayer: false, name: n.name, roleTag: n.role, species: n.species, color: n.color, description: n.text,
  avatarUrl: n.art || (n.bestiary ? bestiaryPortrait(n.bestiary) : crewPortraitPath(n.portrait[0], n.portrait[1], n.portrait[2])), portraitOverride: true,
}, n.key));
const weaverText = `Hearts in the Void 1.0 · Scene 3\n\nHunger Weaver - Tier 1 Standard (Biological, Veil-Touched)\nFeed-Line Lash - Action: Melee or Very Close attack with +2. On a hit, 1d8 Physical.\nHypnotic Illusions - Fear 1: one creature within Close that can see the Weaver makes a Presence Reaction Roll, DC 15; on a failure it becomes Stunned.\nWall-Runner - Passive: moves on vertical and inverted surfaces; can enter through any crawlway, vent or conduit.\n\n— ES —\nLatigazo de alimentación (Acción): ataque cuerpo a cuerpo o Muy Cerca con +2; al impactar, 1d8 Physical.\nIlusiones hipnóticas (Fear 1): una criatura a Cerca que lo vea tira Presence Reaction CD 15; si falla, queda Stunned.\nCorredor de paredes (Pasiva): se mueve por paredes y techos y puede entrar por cualquier conducto o rejilla.`;
const weaver = n => reserve({
  actorType: 'adversary', isPlayer: false, hidden: true, name: 'Hunger Weaver', roleTag: 'Tier 1 · Standard', species: 'Weaver',
  hp: { current: 6, max: 6, majorThreshold: 6, severeThreshold: 12 }, stress: { current: 0, max: 2 }, armor: { current: 1, max: 1 },
  evasion: 10, attackModifier: 2, damageExpression: '1d8 Physical', attackRange: 'Very Close', featureNotes: weaverText,
  avatarUrl: bestiaryPortrait('Hunger Weaver'), portraitOverride: true, color: '#7dd3fc',
}, 'weaver_' + n);
const worker = reserve({
  actorType: 'adversary', isPlayer: false, hidden: true, name: 'Weaver Worker', roleTag: 'Mook · Call the Workers', species: 'Weaver', bestiaryMode: 'minion',
  hp: { current: 1, max: 1, majorThreshold: 1, severeThreshold: 1 }, stress: { current: 0, max: 0 }, armor: { current: 0, max: 0 },
  evasion: 10, attackModifier: 1, damageExpression: '1d6 Physical', featureNotes: `Hearts in the Void 1.0 · Scene 4 · Call the Workers (Fear 1)\nOne worker drops from a crawlway behind or beside the crew: a Mook with 1 HP and 1d6 damage. Never from a sealed route.\n\n— ES —\nUn obrero cae de un conducto detrás o al lado de la tripulación: esbirro de 1 HP y 1d6 de daño. Nunca desde una ruta sellada.\nEl módulo solo imprime 1 HP y 1d6: Evasion 10 y ataque +1 son una propuesta de la sala.\nSin umbrales: cada impacto que cause daño marca 1 HP.`,
  avatarUrl: bestiaryPortrait('Hunger Weaver'), portraitOverride: true, color: '#7dd3fc',
}, 'worker');
const queenPhases = [
  { name: 'La madre defensora · The Defending Mother', trigger: 'objective', hpMode: 'pool', stats: { hp: 10, evasion: 8, armor: 3, damageExpression: '1d10 Physical' },
    notes: 'Feed-Line Sweep (Action): Ranged, Close. 1d10 Physical and push the target one range band.\nCall the Workers (Fear 1): one Weaver Worker (1 HP, 1d6) drops from a crawlway with a fictional entrance.\n\nBarrido (Acción): a distancia, Cerca. 1d10 Physical y empuja al objetivo una banda de alcance.\nLlamar a los obreros (Fear 1): un obrero Weaver (1 HP, 1d6) cae de un conducto con entrada en la ficción.', transition: '' },
  { name: 'La cosa hambrienta · The Starving Thing', trigger: 'hp0', hpMode: 'pool', stats: { hp: 8, evasion: 12, armor: 0, damageExpression: '1d8+2 Physical' },
    notes: 'Desperation (Passive): +2 damage on her attacks.\nRavenous Grasp (Action): Melee, 1d8+2 Physical, Continuous.\nFeed-Line Grip (Fear 1): after Ravenous Grasp causes HP loss, Restrained (Strength DC 15 or an ally’s Action).\nContainment Override (Fear 1): a shutter seals one exit for two rounds, or a crystal frame swings (Agility Reaction DC 10 or 1d8 Physical).\n\nDesesperación (Pasiva): +2 al daño. Agarre voraz (Acción): cuerpo a cuerpo, 1d8+2 Physical, Continuo. Agarre (Fear 1): tras causar pérdida de HP, Restrained (Strength CD 15 o la Acción de un aliado). Anulación de contención (Fear 1): una persiana sella una salida dos rondas, o un marco de cristal oscila (Agility Reaction CD 10 o 1d8 Physical).',
    transition: 'Pausa el Spotlight, limpia sus Condiciones negativas y el Keeper gana 3 Fear (máximo 12). Lee «The Shell Breaks».\nPause the Spotlight, clear her negative Conditions and the Keeper gains 3 Fear (hard maximum 12). Read “The Shell Breaks”.' },
];
const queen = reserve({
  actorType: 'adversary', isPlayer: false, hidden: true, name: 'Weaver Queen', roleTag: 'Tier 1 · Solo (2 fases)', species: 'Weaver', size: 2,
  hp: { current: 10, max: 10, majorThreshold: 6, severeThreshold: 12 }, stress: { current: 0, max: 0 }, armor: { current: 3, max: 3 },
  evasion: 8, attackModifier: 2, damageExpression: '1d10 Physical', attackRange: 'Close',
  featureNotes: `Hearts in the Void 1.0 · Scene 4 · Take It by Force\nAdventure reskin of the Rust-King phased archetype (Keeper’s Companion 12.06, ch. 12). One Fear Ability per Spotlight cycle. The Mercy Window stays open in Phase Two: if the crew removes the cause and gives her a way to stop, end the fight.\n\n— ES —\nReskin del arquetipo Rust-King por fases. Una habilidad de Fear por ciclo de Spotlight. La «ventana de misericordia» sigue abierta en la fase dos: si la tripulación elimina la causa y le da una forma de parar, termina el combate.\nAtaque +2 y umbrales 6/12: no impresos para este chasis; propuesta de la sala (los de los Hunger Weavers).`,
  boss: { index: 0, states: queenPhases, sourceText: 'Hearts in the Void 1.0, Scene 4 (Rust-King chassis, Keeper’s Companion 12.06 ch. 12).' },
  avatarUrl: bestiaryPortrait('Weaver Queen'), portraitOverride: true, color: '#c084fc',
}, 'queen');
const tokens = [...people, weaver(1), weaver(2), worker, queen];

// ── Arcs ──────────────────────────────────────────────────────────────────────────────────────
const byArc = arc => NPCS.filter(n => n.arcs.includes(arc)).map(n => 'tok_hv_' + n.key);
const weavers = ['tok_hv_weaver_1', 'tok_hv_weaver_2', 'tok_hv_worker', 'tok_hv_queen'];
const arcs = [
  { id: 'hv_arc_crossroads', name: 'Acto I · Crossroads (Escenas 1–2)', description: 'Maya contrata a la tripulación en el Nexus Inferior; luego consiguen transporte: comprar nave, pasaje o robar The Collector. Dossieres: Keeper · Escenas 1 y 2.', sceneIds: ['hv_map_nexus', 'hv_map_plate_a', 'hv_map_plate_b'], tokenIds: byArc('crossroads'), images: [] },
  { id: 'hv_arc_transit', name: 'Acto II · Tránsito del Velo', description: 'Algo se agita en el Velo. No expliques nada. Dossier: Keeper · Tránsito del Velo.', sceneIds: ['hv_map_transit'], tokenIds: [], images: [] },
  { id: 'hv_arc_charon', name: 'Acto III · Charon’s Refuge (Escenas 3–7)', description: 'Llegada, exploración, los Iron Hearts, Silk, la fractura, la elección de despertar y la huida. Láminas 1–5. Relojes ocultos listos.', sceneIds: ['hv_map_plate_1', 'hv_map_plate_2', 'hv_map_plate_3', 'hv_map_plate_4', 'hv_map_plate_5'], tokenIds: [...byArc('charon'), ...weavers], images: [] },
  { id: 'hv_arc_epilogue', name: 'Acto IV · Hearts in the Void (Escena 8)', description: 'Contad a los vivos, resolved el futuro de Alexei y las naves, e informad a Maya. Dossier: Registro de la escena 8.', sceneIds: ['hv_map_aftermath'], tokenIds: byArc('epilogue'), images: [] },
];

// ── Clocks: created hidden and collapsed; the Keeper reveals them when the module says so ─────
// Each clock lives on the scenes where the module uses it (v2.62.3, user request: «los relojes
// deberían ir asociados a cada mapa»).
const clock = (id, title, segments, filled, x, y, plates) => ({ id: 'hv_clock_' + id, title, segments, filled, category: 'danger', isKeeperOnly: true, posX: x, posY: y, collapsed: true, mapIds: plates.map(p => 'hv_map_plate_' + p) });
const clocks = [
  clock('hunger', 'Hambre · Hunger', 4, 0, 80, 70, ['5']),
  clock('escape', 'Ruta de escape · Escape Route', 3, 0, 80, 150, ['5']),
  clock('korren', 'Desesperación de Korren · Korren’s Desperation', 4, 1, 80, 70, ['4', '3']),
  clock('core', 'Sobrecarga del núcleo · Core Overload', 6, 0, 80, 150, ['4']),
  clock('structure', 'Fallo estructural · Structural Failure', 6, 1, 80, 230, ['4', '1', '2', '5']),
  clock('convergence', 'Convergencia Weaver · Weaver Convergence', 4, 0, 80, 310, ['4', '1', '2', '5']),
];

// ── The module's own text, chapter by chapter, for the Keeper (English original) ──────────────
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => escape(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
function markdown(text) {
  const out = []; let list = null, quote = null, table = null;
  const flush = () => {
    if (list) { out.push('<ul>' + list.map(i => `<li>${inline(i)}</li>`).join('') + '</ul>'); list = null; }
    if (quote) { out.push('<blockquote>' + quote.map(l => l ? inline(l) : '').join('<br>').replace(/(<br>){2,}/g, '<br><br>') + '</blockquote>'); quote = null; }
    if (table) { out.push('<table>' + table.filter(r => !/^\|[\s|:-]+\|?$/.test(r)).map((r, i) => '<tr>' + r.replace(/^\||\|$/g, '').split('|').map(c => i ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`).join('') + '</tr>').join('') + '</table>'); table = null; }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^@@MAP|^!\[/.test(line)) continue;
    if (/^>/.test(line)) { if (!quote) { flush(); quote = []; } quote.push(line.replace(/^>\s?/, '').replace(/^#+\s*/, '')); continue; }
    if (/^\|/.test(line)) { if (!table) { flush(); table = []; } table.push(line); continue; }
    if (/^\s*[-*] /.test(line)) { if (!list) { flush(); list = []; } list.push(line.replace(/^\s*[-*] /, '')); continue; }
    flush();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) out.push(`<h${Math.min(4, h[1].length + 1)}>${inline(h[2])}</h${Math.min(4, h[1].length + 1)}>`);
    else if (/^---+$/.test(line)) out.push('<hr>');
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('\n');
}
const book = readFileSync(fileURLToPath(new URL('../System/VeilFarers_Hearts_in_the_Void_1_0-Rules_12_06_Corrections_FULL_SOURCE.md', import.meta.url)), 'utf8').replace(/\r/g, '');
const chapters = book.split(/\n(?=# \d{2}[A-Z]?\. )/).slice(1).map(part => {
  const [head, ...rest] = part.split('\n');
  const body = rest.join('\n').split(/\n# MAP PLATES/)[0];
  return { title: head.replace(/^# /, ''), body };
});
const original = chapters.map((c, i) => ({
  id: 'hv_book_' + String(i + 1).padStart(2, '0'), folder: 'Keeper · Texto del módulo (EN)', keeperOnly: true,
  title: '🔒 ' + c.title + ' (EN)', sender: 'Hearts in the Void 1.0 · Rules 12.06', timestamp: 'Original text',
  contentHtml: `<p class="dossier-muted">Texto original del módulo, solo para el Keeper. · Original module text, Keeper only.</p>` + markdown(c.body),
}));

// ── Dossiers ──────────────────────────────────────────────────────────────────────────────────
// The user's art (v2.62.0, «te voy a pasar material gráfico»): public/campaigns/hearts-in-the-void/
// <name>.webp; a dossier shows it when the file is there.
const ART = { hv_p_nexus: 'nexus', hv_p_kurogane_archive: 'experimental-records', hv_p_korren_comm: 'korren-comm', hv_p_signs: 'props', hv_p_commercial: 'props', hv_p_wrist_terminal: 'technician', hv_p_sterilize: 'sterilize', hv_p_core_lost: 'sterilize', hv_p_queen_lair: 'queen-lair',
  hv_p_rec_room: 'last-game', hv_p_poetry: 'notebook', hv_p_dock_k17: 'dock-k17', hv_p_pack: 'pack' };
const art = id => ART[id] && existsSync(fileURLToPath(new URL(`../public/campaigns/hearts-in-the-void/${ART[id]}.webp`, import.meta.url))) ? `/campaigns/hearts-in-the-void/${ART[id]}.webp` : '';
const stamp = d => ({ sharedWithPlayers: false, keeperOnly: false, ...d, imageUrl: d.imageUrl || art(d.id) });
const handouts = [...GUIDE_DOCS, ...SCENE_DOCS, ...NPCS.map(npcDossier), ...PLAYER_DOCS, ...original].map(stamp);

// ── The campaign, through the app's own normalisation and validation ─────────────────────────
const base = structuredClone(store.initialCampaign);
const campaign = store.normalizeCampaign({
  ...base, campaignId: 'hearts-in-the-void', campaignName: 'Hearts in the Void',
  maps, activeMapId: maps[0].id, arcs, tokens, clocks, handouts, logs: [], chatMessages: [], keeperPortrait: '',
  fear: 0, fogOfWar: false, starship: { ...base.starship, name: 'Nave sin asignar', visible: false },
});
delete campaign.savedAt;
const out = fileURLToPath(new URL('../public/campaigns/hearts-in-the-void.json', import.meta.url));
mkdirSync(fileURLToPath(new URL('../public/campaigns/', import.meta.url)), { recursive: true });
writeFileSync(out, JSON.stringify(campaign) + '\n', 'utf8');
console.log(`Hearts in the Void: ${maps.length} escenas, ${arcs.length} arcos, ${tokens.length} tokens, ${clocks.length} relojes, ${handouts.length} dossieres · ${Math.round(JSON.stringify(campaign).length / 1024)} KB`);
process.exit(0);
