// The three source books lay out a profile differently. Only read the narrative
// section. Unstructured Keeper notes may contain information about the encounter.
export function profileDescription(text = '') {
  const blocks = String(text).replaceAll('\r', '').trim().split(/\n\s*\n/);
  const heading = /^\*\*(?:Physical Description|Description|Appearance)[.:]?\*\*:?\s*/i;
  let start = blocks.findIndex(p => heading.test(p));
  let first = '';
  if (start !== -1) first = blocks[start++].replace(heading, '');
  else {
    // Alien Species puts the opening description straight after the stat line.
    start = blocks.findIndex(p => /^\*\*(Evasion|Scale)\*\*\s/i.test(p));
    if (start === -1) return '';
    start++;
  }
  const paragraphs = first ? [first] : [];
  for (const p of blocks.slice(start)) {
    if (/^(?:\*\*|#{1,6}\s|_Tier|\||[-*]\s)/.test(p)) break;
    if (p.trim()) paragraphs.push(p);
  }
  // Some page breaks in the source split a sentence over two paragraphs.
  return paragraphs.join('\n\n').replace(/([^\s.!?…:"'])\n\n(?=[a-z])/g, '$1 ')
    .replace(/\\([.!"'])/g, '$1').trim();
}

export function adversaryDescription(token) {
  return token.description ?? profileDescription(token.featureNotes);
}
