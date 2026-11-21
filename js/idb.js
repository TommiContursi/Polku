// Tiny IndexedDB key–value stores: cached Overpass answers, weather forecast
// cells and saved offline areas.
// Every call can reject (private windows, blocked storage); callers treat the
// store as a nice-to-have.

const STORES = ['overpass', 'offline', 'weather'];
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('polku', 2);
      req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbp = null; }; // let a newer tab upgrade
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      setTimeout(() => reject(new Error('IndexedDB blocked')), 3000); // an old tab holds the previous version
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

export const idb = (store) => ({
  get: (key) => run(store, 'readonly', (s) => s.get(key)),
  // several keys in one transaction; missing ones come back undefined
  getMany: async (keys) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readonly');
      const s = t.objectStore(store);
      const reqs = keys.map((k) => s.get(k));
      t.oncomplete = () => resolve(reqs.map((r) => r.result));
      t.onerror = t.onabort = () => reject(t.error);
    });
  },
  set: (key, value) => run(store, 'readwrite', (s) => s.put(value, key)),
  del: (key) => run(store, 'readwrite', (s) => s.delete(key)),
  all: () => run(store, 'readonly', (s) => s.getAll()),
  // delete every entry whose value fails keep(value)
  prune: (keep) => run(store, 'readwrite', (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      if (!keep(c.value)) c.delete();
      c.continue();
    };
    return null;
  }),
});
