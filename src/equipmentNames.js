export const equipmentNameKey = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// A catalog weapon answers to its whole name, to the part in brackets and to each side of
// "English / Español": "Slug Pistol" finds "Pistola Cinética Militar (Slug Pistol)".
export const equipmentNameAliases = value => {
  const raw = String(value ?? '');
  const parts = [raw, raw.replace(/\(.*?\)/g, ''), ...(raw.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1)), ...raw.replace(/\(.*?\)/g, '').split('/')];
  return [...new Set(parts.map(equipmentNameKey).filter(Boolean))];
};
