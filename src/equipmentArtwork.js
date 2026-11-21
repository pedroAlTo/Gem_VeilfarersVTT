import extras from './extraEquipmentArt.json' with { type: 'json' };
import { EQUIPMENT_CATALOG } from './equipmentLibrary.js';

const illustratedEquipment = EQUIPMENT_CATALOG.filter(item => /Common|Military|Tier [12]\b/.test(item.tier));
const equipmentPictures = new Map(illustratedEquipment.flatMap(item => [item.id, item.name, ...item.name.split(' / ')].map(key => [key.toLowerCase(), item.id])));
export function equipmentThumbnail(item) {
  const id = equipmentPictures.get(String(item.id).toLowerCase()) || equipmentPictures.get(String(item.name).toLowerCase()) || extras[String(item.name).toLowerCase()];
  return typeof id === 'string' ? `<img src="/assets/equipment/${id}.webp" width="54" height="54" loading="lazy" alt="" style="object-fit:cover;border-radius:5px;flex:none" />` : '';
}
