// Where the 3 + 5 + rest rule is applied (V3). For now, the player's view: the header, the
// map tools and the character bar. The Keeper's view keeps everything in sight until its phase.
import { store } from './state.js';
import { GroupMenu } from './groupMenu.js';
import { isPlayerView } from './playerActionBar.js';

export const PLAYER_GROUPS = [
  {
    name: 'Cabecera', root: '.header-hud', anchor: '.header-actions', placement: 'below',
    items: [
      { sel: '#quick_scene_select', label: 'Escena' }, { sel: '#session_state', label: 'Sala' }, { sel: '#session_my_tokens' },
      // ⋯
      { sel: '#session_account', label: 'Cuenta' }, { sel: '#network_modal_btn', label: 'Sesiones' }, { sel: '#help_btn', label: 'Ayuda' },
      { sel: '#session_crew' }, { sel: '#session_copy', label: 'Copiar invitación' },
      // Más…
      { sel: '#rules_modal_btn', label: 'Códice' }, { sel: '#home_btn', label: 'Inicio' }, { sel: '#session_join', label: 'Unirse a una sala' },
      { sel: '#audio_toggle_btn', label: 'Audio' }, { sel: '#session_magic_btn', label: 'Copiar enlace de invitación' },
      { sel: '.session-code-label', hideOnly: true },
    ],
  },
  {
    name: 'Herramientas', root: '#main_left_toolbar', placement: 'right',
    items: [
      // In sight: Mover, Área (the player's tool for powers and blasts) and Dibujo; Medir goes
      // into the menu (a distance is also shown when aiming an attack).
      { sel: '#tool_select', label: 'Mover' }, { sel: '#tool_template', label: 'Área' }, { sel: '#tool_draw', label: 'Dibujo' },
      { sel: '#tool_measure', label: 'Medir' }, { sel: '#tool_ping', label: 'Ping' }, { sel: '#tool_fx', label: 'Efectos' },
      { sel: '#tool_undo', label: 'Deshacer' }, { sel: '#toggle_grid', label: 'Rejilla' },
      { sel: '#toggle_snap', label: 'Ajuste a la rejilla' },
    ],
  },
  {
    name: 'Personaje', root: '#token_quickbar_root', anchor: '.tok-qb-actions', placement: 'above',
    items: [
      // Foco stays in view, first (the user's decision, v2.27.5); Equipo goes into ⋯.
      { sel: '#quick_spotlight_btn', label: 'Foco (Spotlight)' }, { sel: '#open_sheet_btn', label: 'Ficha completa' }, { sel: '#open_conditions_btn', label: 'Estados' },
      { sel: '#open_equipment_btn', label: 'Equipo' }, { sel: '#toggle_expand_btn' }, { sel: '#quick_reserve_btn', label: 'Reserva' },
    ],
  },
];

export function mountPlayerGroups() {
  const menus = PLAYER_GROUPS.map(group => new GroupMenu({ ...group, when: () => isPlayerView() }));
  store.subscribe(() => menus.forEach(m => m.refresh()));
  return menus;
}
