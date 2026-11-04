import { dossierDialog } from './dossierUI.js';
import { store } from './state.js';
import { escapeHTML as esc, notify } from './ui.js';

const keeper = () => store.sessionRole !== 'player' && store.state.userRole === 'keeper';
const label = entry => [entry.tier && 'Tier ' + entry.tier, entry.role].filter(Boolean).join(' · ');
const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const inline = value => esc(value).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/_([^_\n]+)_/g, '<em>$1</em>');
function bookText(value) {
  return value.split(/\n\s*\n/).map(block => {
    if (block.startsWith('|')) {
      const rows = block.split('\n').filter(line => line.startsWith('|') && !/^\|[\s|:-]+$/.test(line));
      return '<table>' + rows.map((row, i) => '<tr>' + row.replace(/^\||\|$/g, '').split('|').map(cell => i ? '<td>' + inline(cell.trim()) + '</td>' : '<th>' + inline(cell.trim()) + '</th>').join('') + '</tr>').join('') + '</table>';
    }
    if (/^#{1,5} /.test(block)) return '<h4>' + inline(block.replace(/^#{1,5} /, '')) + '</h4>';
    return '<p>' + inline(block).replaceAll('\n', '<br>') + '</p>';
  }).join('');
}

export function deployAdversary(entry, { hidden = true } = {}) {
  if (!keeper()) throw new Error('Solo el Keeper puede desplegar adversarios.');
  if (!entry.deployable) throw new Error('Este encuentro requiere el procedimiento descrito en el libro.');
  const canvas = window.veilCanvas;
  const center = canvas?.screenToWorld(canvas.displayWidth / 2, canvas.displayHeight / 2) ?? { x: 600, y: 400 };
  const map = store.getActiveMap();
  const token = store.addToken({
    actorType: 'adversary', isPlayer: false, hidden, name: entry.name, roleTag: label(entry),
    x: Math.max(0, Math.min(map.width || Infinity, center.x)), y: Math.max(0, Math.min(map.height || Infinity, center.y)),
    avatarUrl: '/assets/tokens/adversary-marker.svg', hasLight: false,
    hp: { current: entry.hp, max: entry.hp, majorThreshold: entry.major, severeThreshold: entry.severe },
    stress: { current: 0, max: entry.stress ?? 0 }, armor: { current: entry.armor ?? 0, max: entry.armor ?? 0 },
    evasion: entry.evasion, attackModifier: entry.attack, damageExpression: entry.damage,
    ...(entry.traits ? { traits: entry.traits } : {}),
    featureNotes: [entry.book + ' 12.06 · ' + entry.section, entry.name, entry.text].join('\n\n'),
  });
  if (!token) throw new Error('No se pudo colocar el token en la escena.');
  store.update({ selectedTokenId: token.id });
  return token;
}

export async function openAdversaryLibrary(catalog) {
  if (!keeper()) return;
  const entries = catalog ?? (await import('virtual:veil-adversaries')).default;
  if (!keeper()) return;
  const modal = dossierDialog('Biblioteca de adversarios', `
    <div class="bestiary-filters">
      <label class="dossier-field">Buscar<input type="search" class="hud-input" data-search placeholder="Nombre, habilidad o tipo"></label>
      <label class="dossier-field">Libro<vf-select class="hud-select" data-book><option value="">Todos</option>${[...new Set(entries.map(e => e.book))].map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}</vf-select></label>
      <label class="dossier-field">Tier<vf-select class="hud-select" data-tier><option value="">Todos</option>${[1,2,3,4,5].map(t => `<option value="${t}">${t}</option>`).join('')}</vf-select></label>
    </div>
    <p class="dossier-muted" data-count aria-live="polite"></p>
    <div class="bestiary-browser"><div data-list aria-label="Adversarios"></div><article data-detail></article></div>
    <footer class="bestiary-footer"><label><input type="checkbox" data-hidden checked> Oculto para los jugadores</label><button class="hud-btn hud-btn-primary" data-deploy>Colocar en la escena</button></footer>`);
  const find = selector => modal.querySelector(selector);
  const search = find('[data-search]'), book = find('[data-book]'), tier = find('[data-tier]');
  const list = find('[data-list]'), detail = find('[data-detail]'), deploy = find('[data-deploy]');
  const terms = new Map(entries.map(e => [e, fold([e.name, label(e), e.book, e.text].join(' '))]));
  let selected;
  function show(entry) {
    selected = entry;
    for (const button of list.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.key === selected?.id));
    deploy.disabled = !entry?.deployable;
    detail.scrollTop = 0;
    if (!entry) { detail.textContent = 'Prueba con otro nombre, libro o tier.'; return; }
    const stats = [['HP',entry.hp], ['Evasion',entry.evasion], ['Ataque',entry.attack == null ? null : (entry.attack >= 0 ? '+' : '') + entry.attack], ['Major / Severe',entry.major != null && entry.severe != null ? entry.major + ' / ' + entry.severe : null], ['Stress',entry.stress], ['Armor',entry.armor]];
    detail.innerHTML = `<span class="dossier-eyebrow">${esc(entry.book)} · 12.06</span><h3>${esc(entry.name)}</h3><p>${esc(label(entry))}</p>
      <p class="dossier-muted">${esc(entry.section)} · línea ${entry.line}</p>
      <div class="bestiary-stats">${stats.filter(([,v]) => v != null).map(([k,v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join('')}</div>
      ${entry.damage ? `<p><strong>Daño</strong> ${esc(entry.damage)}</p>` : ''}
      ${!entry.deployable ? '<p class="import-warning">Ficha de consulta. Usa el procedimiento impreso: este perfil no tiene todos los valores numéricos del token estándar.</p>' : ''}
      <div class="bestiary-source">${bookText(entry.text)}</div>`;
  }
  function filter() {
    const words = fold(search.value.trim()).split(/\s+/).filter(Boolean);
    const matches = entries.filter(e => (!book.value || e.book === book.value) && (!tier.value || String(e.tier) === tier.value) && words.every(w => terms.get(e).includes(w)));
    find('[data-count]').textContent = `${matches.length} perfiles · ${matches.filter(e => e.deployable).length} desplegables`;
    list.replaceChildren();
    for (const entry of matches) {
      const button = document.createElement('button');
      button.className = 'bestiary-item'; button.dataset.key = entry.id;
      button.innerHTML = `<strong>${esc(entry.name)}</strong><small>${esc(entry.book)}${entry.tier ? ' · T' + entry.tier : ''}${entry.deployable ? '' : ' · Consulta'}</small>`;
      button.onclick = () => show(entry); list.append(button);
    }
    show(matches.includes(selected) ? selected : matches[0]);
  }
  search.oninput = book.onchange = tier.onchange = filter;
  deploy.onclick = () => {
    try { const token = deployAdversary(selected, { hidden: find('[data-hidden]').checked }); modal.remove(); notify((token.hidden ? 'Colocado en oculto: ' : 'Colocado: ') + token.name); }
    catch (error) { notify(error.message, 'error'); }
  };
  filter(); search.focus();
  return modal;
}
