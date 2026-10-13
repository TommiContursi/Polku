// Tiny IndexedDB key–value stores: cached Overpass answers and saved offline areas.
// Every call can reject (private windows, blocked storage); callers treat the
// store as a nice-to-have.

const STORES = ['overpass', 'offline'];
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('polku', 1);
      req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
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
