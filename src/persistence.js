const ACTIVE = 'veilvtt.activeCampaign';
let dbPromise;
export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues)
    throw new Error('This browser cannot create secure session identifiers.');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function activeCampaignId() {
  try {
    const id = localStorage.getItem(ACTIVE) || newId();
    localStorage.setItem(ACTIVE, id);
    return id;
  } catch {
    return newId();
  }
}
function database() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return (dbPromise ||= new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new Error('Storage is busy. Close other campaign tabs and reload.'));
    }, 8000);
    const r = indexedDB.open('veilfarers-campaigns', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('campaigns');
    r.onsuccess = () => {
      clearTimeout(timer);
      if (expired) {
        r.result.close();
        return;
      }
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => {
      clearTimeout(timer);
      reject(r.error);
    };
    r.onblocked = () => {
      clearTimeout(timer);
      expired = true;
      reject(new Error('Storage is blocked by another campaign tab. Close it and reload.'));
    };
  }));
}
export async function readCampaign(id) {
  const db = await database();
  let found;
  if (db)
    found = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Reading the saved campaign timed out. Reload before editing.')),
        8000
      );
      const r = db.transaction('campaigns').objectStore('campaigns').get(id);
      r.onsuccess = () => {
        clearTimeout(timer);
        resolve(r.result);
      };
      r.onerror = () => {
        clearTimeout(timer);
        reject(r.error);
      };
    });
  else {
    const s = globalThis.localStorage?.getItem(`veilvtt.campaign.${id}`);
    if (s) found = JSON.parse(s);
  }
  if (found) return found;
  const old = globalThis.localStorage?.getItem('veilvtt_campaign_data_v1207');
  return old ? JSON.parse(old) : null;
}
export async function writeCampaign(id, data) {
  const db = await database();
  if (!db) {
    localStorage.setItem(`veilvtt.campaign.${id}`, JSON.stringify(data));
    return;
  }
  await new Promise((resolve, reject) => {
    const t = db.transaction('campaigns', 'readwrite');
    t.objectStore('campaigns').put(data, id);
    const timer = setTimeout(() => {
      t.abort();
      reject(new Error('Saving timed out. Export a backup and reload.'));
    }, 8000);
    t.oncomplete = () => {
      clearTimeout(timer);
      resolve();
    };
    t.onerror = () => {
      clearTimeout(timer);
      reject(t.error);
    };
    t.onabort = () => {
      clearTimeout(timer);
      reject(t.error || new Error('Save cancelled'));
    };
  });
}
export function selectCampaign(id) {
  localStorage.setItem(ACTIVE, id);
}
