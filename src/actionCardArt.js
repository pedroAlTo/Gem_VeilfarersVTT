// Row-major positions in the painted 3 × 3 action sheets. Keep slots stable when adding cards.
const sheets = [
  ["Force of Presence", "Read the Table", "Common Ground", "The Ledger Remembers", "Leverage", "Field Improvisation", "Hot-Wire", "Ghost in the Logs", "Safe Handling"],
  ["Stabilize", "Find a Way", "Read the Ground", "Perfect Recall of Place", "Endure", "Run It Down", "Calibrated Minor Ritual", "Uncanny Power", "Never Tell Me the Odds"],
  ["Hold Together", "Lose the Tail", "Gun Run", "Reroute Power", "Analyze Weakness", "I Have Read About This", "Know the Beast", "Dig-Site Discipline", "Signal in the Noise"],
  ["Vanish", "The Long Con", "Killing Window", "Never Was Here", "False Bottom", "Take the Hit", "Disciplined Strike", "Bulwark", "Order the Line"],
  ["Stand Down", "The Weightless Art", "Falling Star", "Stillness", "Shockwave", "Burning Focus", "Bear Down", "Steady Hands", "Read the Room"],
  ["Push Through", "The Opening", "Try Again", "Brace", "Cover the Angle", "Second Wind", "Seize the Moment", "Spell", "Physical Ability"],
  ["Physical Attack", "Defense", "Magical Attack", "Control", "Support", "Utility", "Spotlight Enemies", "Declare a Complication", "Interrupt an Action"],
  ["Ancestry Complication"],
];
const slots = new Map(sheets.flatMap((sheet, i) => sheet.map((name, cell) =>
  [name, { illustration: '/assets/cards/actions/sheet-' + (i + 1) + '.webp', cell }])));

export function actionArt(name, frame = { flag: '', band: '/assets/cards/plain-band.png', layout: 'band' }) {
  return { ...frame, ...slots.get(name) };
}
