// Small HTML pieces for the Hearts in the Void dossiers. The dossier window shows one language at a
// time when a document has [data-lang] blocks (handoutManager, v2.62.0); data-no-i18n keeps the
// app's automatic translation away from text that is already written in both languages.
export const bi = (es, en) => `<div data-lang="es" data-no-i18n>${es}</div><div data-lang="en" data-no-i18n>${en}</div>`;

const box = (style, body) => `<div style="${style}">${body}</div>`;
export const terminal = text => box('font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;background:#030c09;color:#8dffb8;border:1px solid #1f6f4a;border-radius:6px;padding:12px 14px;white-space:pre-wrap;line-height:1.55;margin:8px 0', text);
export const sign = text => box('font-family:var(--font-hud,system-ui);font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#1a1204;color:#ffcf6b;border:1px dashed #a77a1f;border-radius:4px;padding:10px 12px;margin:8px 0;text-align:center', text);
export const audio = (...lines) => box('font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;background:#0b0618;color:#d9c8ff;border-left:3px solid #8b5cf6;border-radius:4px;padding:10px 14px;margin:8px 0;line-height:1.6', '◉ REC<br>' + lines.map(l => /^\[/.test(l) ? `<span style="opacity:.65">${l}</span>` : l).join('<br>'));
export const note = text => box('background:rgba(0,243,255,.06);border:1px solid rgba(0,243,255,.3);border-radius:6px;padding:8px 12px;margin:8px 0', text);
export const read = text => `<blockquote style="border-left:3px solid #f5b942;background:rgba(245,185,66,.08);padding:8px 12px;margin:10px 0;font-style:italic">${text}</blockquote>`;
export const table = (head, rows) => `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px"><tr>${head.map(h => `<th style="text-align:left;border-bottom:1px solid #3b3561;padding:4px">${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td style="border-bottom:1px solid #241f3d;padding:4px;vertical-align:top">${c}</td>`).join('')}</tr>`).join('')}</table>`;
export const ul = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
