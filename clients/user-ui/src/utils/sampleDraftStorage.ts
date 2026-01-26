export type DraftSample = {
  tempId: string;
  nus: string;
  identity: string;
  geoLat?: number | null;
  geoLng?: number | null;
  photoBlob?: Blob | null;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'simanis_drafts_db';
const DB_VERSION = 1;
const STORE_NAME = 'sampleDrafts';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'userProgressId',
        });
        // value: { userProgressId: string, samples: DraftSample[] }
        store.createIndex('userProgressId', 'userProgressId', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ambil semua draft untuk 1 userProgress
export async function getDraftSamples(
  userProgressId: string,
): Promise<DraftSample[]> {
  if (!userProgressId || typeof window === 'undefined') return [];

  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(userProgressId);

    req.onsuccess = () => {
      const result = req.result as
        | { userProgressId: string; samples: DraftSample[] }
        | undefined;
      resolve(result?.samples ?? []);
    };
    req.onerror = () => reject(req.error);
  });
}

// simpan semua draft untuk 1 userProgress
export async function setDraftSamples(
  userProgressId: string,
  samples: DraftSample[],
): Promise<void> {
  if (!userProgressId || typeof window === 'undefined') return;

  const db = await openDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const data = { userProgressId, samples };
    const req = store.put(data);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// hapus semua draft untuk 1 userProgress
export async function clearDraftSamples(
  userProgressId: string,
): Promise<void> {
  if (!userProgressId || typeof window === 'undefined') return;

  const db = await openDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(userProgressId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
